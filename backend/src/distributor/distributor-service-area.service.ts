import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceAreaDto } from './dto/create-service-area.dto';

@Injectable()
export class DistributorServiceAreaService {
  constructor(private prisma: PrismaService) {}

  async findAll(distributorId: string) {
    return this.prisma.distributorPincode.findMany({
      where: { distributorId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async lookupPincode(pincode: string) {
    const cleanPincode = (pincode || '').trim();
    if (!/^\d{6}$/.test(cleanPincode)) {
      throw new BadRequestException('Pincode must be exactly 6 digits');
    }

    // 1. Check existing database records
    const local = await this.prisma.distributorPincode.findFirst({
      where: { pincode: cleanPincode },
      select: { location: true, district: true, state: true },
    });

    if (local && (local.location || local.district)) {
      return {
        found: true,
        pincode: cleanPincode,
        location: local.location || '',
        district: local.district || '',
        state: local.state || 'Kerala',
      };
    }

    // 2. Parallel multi-source resolution across Indian postal providers
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const fetchIndiaPost = async () => {
      const r = await fetch(`https://api.postalpincode.in/pincode/${cleanPincode}`, {
        signal: controller.signal,
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      if (Array.isArray(data) && data[0]?.Status === 'Success' && data[0]?.PostOffice?.length > 0) {
        const poList = data[0].PostOffice;
        const sub = poList.find((p: any) => p.BranchType?.includes('Sub') || p.BranchType?.includes('Head'));
        const primary = sub || poList.find((p: any) => p.DeliveryStatus === 'Delivery') || poList[0];
        return {
          found: true,
          location: primary.Name || '',
          district: primary.District || '',
          state: primary.State || '',
          source: 'IndiaPost',
        };
      }
      if (Array.isArray(data) && data[0]?.Status === 'Error') {
        return { found: false, notFound: true, message: 'Pincode not found.' };
      }
      throw new Error('No post office');
    };

    const fetchNominatim = async () => {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?postalcode=${cleanPincode}&country=India&format=json&addressdetails=1`,
        {
          headers: { 'User-Agent': 'EdropsApp/1.0' },
          signal: controller.signal,
        },
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const list = await r.json();
      if (Array.isArray(list) && list.length > 0) {
        const addr = list[0].address || {};
        const loc = addr.suburb || addr.town || addr.village || addr.city_district || addr.county || '';
        const dist = addr.state_district || addr.county || addr.city || '';
        const state = addr.state || '';
        return {
          found: true,
          location: loc,
          district: dist,
          state: state,
          source: 'Nominatim',
        };
      }
      return { found: false, notFound: true, message: 'Pincode not found.' };
    };

    const fetchZippo = async () => {
      const r = await fetch(`https://api.zippopotam.us/in/${cleanPincode}`, { signal: controller.signal });
      if (r.status === 404) return { found: false, notFound: true, message: 'Pincode not found.' };
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      if (d.places && d.places.length > 0) {
        const p = d.places[0];
        return {
          found: true,
          location: (p['place name'] || '').replace(/ B\.O$/, ''),
          district: '',
          state: p.state || '',
          source: 'Zippo',
        };
      }
      throw new Error('No places');
    };

    try {
      const settled = await Promise.allSettled([
        fetchIndiaPost(),
        fetchNominatim(),
        fetchZippo(),
      ]);
      clearTimeout(timeoutId);

      const successful = settled
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && r.value?.found)
        .map((r) => r.value);

      if (successful.length > 0) {
        const best =
          successful.find((s) => s.source === 'IndiaPost') ||
          successful.find((s) => s.source === 'Nominatim') ||
          successful[0];

        const second = successful.find((s) => s !== best);
        return {
          found: true,
          pincode: cleanPincode,
          location: best.location || second?.location || '',
          district: best.district || second?.district || '',
          state: best.state || second?.state || 'Kerala',
        };
      }

      const notFound = settled.some(
        (r) => r.status === 'fulfilled' && r.value?.notFound,
      );
      if (notFound) {
        return {
          found: false,
          notFound: true,
          pincode: cleanPincode,
          message: 'Pincode not found.',
        };
      }

      return {
        found: false,
        error: true,
        pincode: cleanPincode,
        message: "Location details couldn't be fetched. You can enter them manually.",
      };
    } catch {
      clearTimeout(timeoutId);
      return {
        found: false,
        error: true,
        pincode: cleanPincode,
        message: "Location details couldn't be fetched. You can enter them manually.",
      };
    }
  }

  async create(distributorId: string, dto: CreateServiceAreaDto) {
    const cleanPincode = (dto.pincode || '').trim();
    if (!/^\d{6}$/.test(cleanPincode)) {
      throw new BadRequestException('Pincode must be exactly 6 digits');
    }

    // Duplicate check for this distributor
    const existing = await this.prisma.distributorPincode.findUnique({
      where: {
        distributorId_pincode: {
          distributorId,
          pincode: cleanPincode,
        },
      },
    });

    if (existing && existing.isActive) {
      throw new BadRequestException(`Pincode ${cleanPincode} is already configured in your active delivery areas.`);
    }

    return this.prisma.distributorPincode.upsert({
      where: {
        distributorId_pincode: {
          distributorId,
          pincode: cleanPincode,
        },
      },
      create: {
        distributorId,
        pincode: cleanPincode,
        location: dto.location?.trim() || null,
        district: dto.district?.trim() || null,
        state: dto.state?.trim() || null,
        isActive: true,
      },
      update: {
        location: dto.location?.trim() || undefined,
        district: dto.district?.trim() || undefined,
        state: dto.state?.trim() || undefined,
        isActive: true,
      },
    });
  }

  async remove(distributorId: string, id: string) {
    const existing = await this.prisma.distributorPincode.findFirst({
      where: { id, distributorId },
    });
    if (!existing) {
      throw new NotFoundException('Service area not found');
    }

    return this.prisma.distributorPincode.delete({
      where: { id },
    });
  }

  async toggleActive(distributorId: string, id: string) {
    const existing = await this.prisma.distributorPincode.findFirst({
      where: { id, distributorId },
    });
    if (!existing) {
      throw new NotFoundException('Service area not found');
    }

    return this.prisma.distributorPincode.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });
  }
}
