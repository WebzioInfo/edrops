import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as https from 'https';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { CreateAddressDto } from './dto/address.dto';

// Edrops base delivery location — Kondotty, Kerala
const BASE_PINCODE = '673638';
const DEFAULT_BASE_LAT = 11.1267;
const DEFAULT_BASE_LON = 75.9627;
const DEFAULT_SERVICE_RADIUS_KM = 25;

export interface ServiceabilityResult {
  serviceable: boolean;
  /** false when the pincode could not be resolved at all (unknown/not in any registry) */
  found: boolean;
  pincode: string;
  distanceKm: number | null;
  serviceRadiusKm: number;
  city?: string;
  state?: string;
}

interface ResolvedLocation {
  lat: number;
  lon: number;
  city?: string;
  state?: string;
}

@Injectable()
export class AddressService {
  private readonly logger = new Logger(AddressService.name);

  constructor(
    private prisma: PrismaService,
    private settingsService: SettingsService,
  ) {}

  // ────────────────────────────────────────────────────────────────
  //  SERVICEABILITY ENGINE
  // ────────────────────────────────────────────────────────────────

  /** Haversine great-circle distance in km */
  private haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Generic HTTPS GET with custom headers and 8-second timeout.
   * Uses https.request so we can set headers (required by Nominatim).
   */
  private httpGet(url: string, extraHeaders: Record<string, string> = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const u = new URL(url);
      const req = https.request(
        {
          hostname: u.hostname,
          path: u.pathname + u.search,
          method: 'GET',
          timeout: 8000,
          headers: { Accept: 'application/json', ...extraHeaders },
        },
        (res) => {
          let body = '';
          res.on('data', (chunk: Buffer) => (body += chunk.toString()));
          res.on('end', () => {
            try { resolve(JSON.parse(body)); }
            catch { reject(new Error('Invalid JSON from ' + u.hostname)); }
          });
        },
      );
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
      req.end();
    });
  }

  /**
   * Resolve a 6-digit Indian pincode to geographic coordinates.
   *
   * Strategy 1 — Nominatim (OpenStreetMap): most reliable, returns accurate
   *   lat/lon for the vast majority of Indian pincodes. Free, no API key.
   *
   * Strategy 2 — India Post API (api.postalpincode.in): fallback. Note: this API
   *   often returns "NA" for Latitude/Longitude (the original bug), so coordinates
   *   are only used when they are valid non-zero numbers.
   *
   * Strategy 3 — District geocoding: if strategy 2 has the district name but no
   *   coordinates, geocode the district via Nominatim as a last resort.
   */
  private async resolveCoordinates(pincode: string): Promise<ResolvedLocation | null> {
    const UA = 'Edrops-DeliveryApp/1.0 (support@edrops.in)';

    // ── Strategy 1: Nominatim ──────────────────────────────────────
    try {
      const data = await this.httpGet(
        `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(pincode)}&countrycodes=in&format=json&limit=1&addressdetails=1`,
        { 'User-Agent': UA },
      );
      if (Array.isArray(data) && data.length > 0) {
        const hit = data[0];
        const lat = parseFloat(hit.lat);
        const lon = parseFloat(hit.lon);
        if (!isNaN(lat) && !isNaN(lon)) {
          const addr = hit.address || {};
          this.logger.log(`[Nominatim] resolved ${pincode}: (${lat}, ${lon})`);
          return {
            lat,
            lon,
            city: addr.county || addr.city || addr.town || addr.village,
            state: addr.state,
          };
        }
      }
    } catch (e: any) {
      this.logger.warn(`[Nominatim] lookup failed for ${pincode}: ${e.message}`);
    }

    // ── Strategy 2: India Post API ─────────────────────────────────
    // WARNING: this API frequently returns "NA" for Latitude/Longitude.
    // Coordinates are only trusted when they are valid finite non-zero numbers.
    try {
      const data = await this.httpGet(`https://api.postalpincode.in/pincode/${pincode}`);
      if (
        Array.isArray(data) &&
        data[0]?.Status === 'Success' &&
        Array.isArray(data[0]?.PostOffice) &&
        data[0].PostOffice.length > 0
      ) {
        const po = data[0].PostOffice[0];
        const lat = parseFloat(po.Latitude);
        const lon = parseFloat(po.Longitude);

        if (!isNaN(lat) && !isNaN(lon) && isFinite(lat) && isFinite(lon) && lat !== 0 && lon !== 0) {
          this.logger.log(`[PostalAPI] resolved ${pincode}: (${lat}, ${lon})`);
          return { lat, lon, city: po.District || po.Name, state: po.State };
        }

        // Strategy 3: Coordinates missing ("NA") — geocode the district name
        const district = po.Division || po.District;
        const state = po.State;
        if (district && state) {
          try {
            const geoData = await this.httpGet(
              `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(district + ', ' + state + ', India')}&format=json&limit=1`,
              { 'User-Agent': UA },
            );
            if (Array.isArray(geoData) && geoData.length > 0) {
              const lat2 = parseFloat(geoData[0].lat);
              const lon2 = parseFloat(geoData[0].lon);
              if (!isNaN(lat2) && !isNaN(lon2)) {
                this.logger.log(`[DistrictGeo] resolved ${pincode} via "${district}": (${lat2}, ${lon2})`);
                return { lat: lat2, lon: lon2, city: po.District, state: po.State };
              }
            }
          } catch (e: any) {
            this.logger.warn(`[DistrictGeo] failed for "${district}": ${e.message}`);
          }
        }
      }
    } catch (e: any) {
      this.logger.warn(`[PostalAPI] lookup failed for ${pincode}: ${e.message}`);
    }

    this.logger.warn(`All coordinate strategies exhausted for pincode ${pincode}`);
    return null;
  }

  /**
   * Check whether a pincode falls within the Edrops delivery radius.
   * Configurable via SettingsService keys:
   *   delivery.serviceRadiusKm  (default 25)
   *   delivery.baseLat          (default 11.1267 — Kondotty)
   *   delivery.baseLon          (default 75.9627 — Kondotty)
   */
  async checkServiceability(pincode: string): Promise<ServiceabilityResult> {
    if (!/^\d{6}$/.test(pincode)) {
      throw new BadRequestException('Invalid pincode format — must be 6 digits');
    }

    const serviceRadiusKm = await this.settingsService.getSettingNumber(
      'delivery.serviceRadiusKm', DEFAULT_SERVICE_RADIUS_KM,
    );
    const baseLat = await this.settingsService.getSettingNumber(
      'delivery.baseLat', DEFAULT_BASE_LAT,
    );
    const baseLon = await this.settingsService.getSettingNumber(
      'delivery.baseLon', DEFAULT_BASE_LON,
    );

    // Base pincode is always serviceable at distance 0
    if (pincode === BASE_PINCODE) {
      return { serviceable: true, found: true, pincode, distanceKm: 0, serviceRadiusKm, city: 'Kondotty', state: 'Kerala' };
    }

    const resolved = await this.resolveCoordinates(pincode);

    if (!resolved) {
      this.logger.warn(`Serviceability denied (unresolvable): pincode=${pincode}`);
      return { serviceable: false, found: false, pincode, distanceKm: null, serviceRadiusKm };
    }

    const distanceKm =
      Math.round(this.haversineDistance(baseLat, baseLon, resolved.lat, resolved.lon) * 10) / 10;

    const serviceable = distanceKm <= serviceRadiusKm;

    this.logger.log(
      `Serviceability: pincode=${pincode} resolved=(${resolved.lat},${resolved.lon}) ` +
      `base=(${baseLat},${baseLon}) distance=${distanceKm}km ` +
      `radius=${serviceRadiusKm}km → ${serviceable ? 'SERVICEABLE' : 'NOT SERVICEABLE'}`,
    );

    return {
      serviceable,
      found: true,
      pincode,
      distanceKm,
      serviceRadiusKm,
      city: resolved.city,
      state: resolved.state,
    };
  }

  // ────────────────────────────────────────────────────────────────
  //  ADDRESS CRUD
  // ────────────────────────────────────────────────────────────────

  async create(customerId: string, createAddressDto: CreateAddressDto) {
    // 1. Validate pincode format
    const zipCode = (createAddressDto.zipCode || '').trim();
    if (!/^\d{6}$/.test(zipCode)) {
      throw new BadRequestException('Invalid pincode — must be a 6-digit number');
    }

    // 2. Backend-enforced serviceability check — never trust the client
    const serviceability = await this.checkServiceability(zipCode);
    if (!serviceability.serviceable) {
      throw new BadRequestException(
        `Delivery is not available for pincode ${zipCode}. ` +
          `Edrops delivers within ${serviceability.serviceRadiusKm} km of our service area.`,
      );
    }

    if (createAddressDto.isDefault) {
      await this.prisma.address.updateMany({
        where: { customerId },
        data: { isDefault: false },
      });
    }

    // Check if duplicate address already exists for customer
    const existing = await this.prisma.address.findFirst({
      where: {
        customerId,
        street: createAddressDto.street?.trim(),
        city: createAddressDto.city?.trim(),
        zipCode,
      },
    });

    if (existing) {
      return this.prisma.address.update({
        where: { id: existing.id },
        data: {
          ...createAddressDto,
          zipCode,
          isDefault: createAddressDto.isDefault ?? existing.isDefault,
        },
      });
    }

    return this.prisma.address.create({
      data: {
        customerId,
        ...createAddressDto,
        zipCode,
      },
    });
  }

  async findAll(customerId: string) {
    const list = await this.prisma.address.findMany({
      where: {
        customerId,
        NOT: {
          label: {
            startsWith: 'Order Delivery Location (',
          },
        },
      },
      orderBy: { isDefault: 'desc' },
    });

    // Fallback: If customer only had snapshot addresses, fetch them
    const sourceList =
      list.length > 0
        ? list
        : await this.prisma.address.findMany({
            where: { customerId },
            orderBy: { isDefault: 'desc' },
          });

    // Deduplicate by ID and address content
    const seenIds = new Set<string>();
    const seenContent = new Set<string>();
    const deduplicated: typeof sourceList = [];

    for (const addr of sourceList) {
      if (!addr || !addr.id || seenIds.has(addr.id)) continue;
      seenIds.add(addr.id);

      const contentKey = `${(addr.street || '').trim().toLowerCase()}_${(addr.city || '').trim().toLowerCase()}_${(addr.zipCode || '').trim()}`;
      if (contentKey && contentKey !== '__' && seenContent.has(contentKey)) {
        continue;
      }
      if (contentKey && contentKey !== '__') {
        seenContent.add(contentKey);
      }

      deduplicated.push(addr);
    }

    return deduplicated;
  }

  async remove(customerId: string, id: string) {
    const address = await this.prisma.address.findFirst({
      where: { id, customerId },
    });
    if (!address) throw new NotFoundException('Address not found');

    return this.prisma.address.delete({ where: { id } });
  }

  async setDefault(customerId: string, id: string) {
    await this.prisma.address.updateMany({
      where: { customerId },
      data: { isDefault: false },
    });

    return this.prisma.address.update({
      where: { id, customerId },
      data: { isDefault: true },
    });
  }
}
