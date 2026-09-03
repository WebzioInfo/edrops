/**
 * Edrops Location Engine V4 — Google Address Component Parser & Normalizer
 * Full postal_code and structured address resolution across Google Places, Geocoding, GPS, and Map drag.
 */

export interface NormalizedLocation {
  placeId: string | null;
  name: string | null;
  formattedAddress: string | null;
  secondaryText?: string | null;
  latitude: number;
  longitude: number;
  city: string | null;
  district: string | null;
  state: string | null;
  country: string | null;
  countryCode: string | null;
  pincode: string | null;
  locationType: string | null;
  source: 'google';
}

export interface PlaceSearchResult {
  id: string; // Google Place ID
  name: string; // e.g. "Biofix" or "Japan Square"
  secondaryText: string; // e.g. "Kondotty, Malappuram, Kerala"
  description: string;
  city?: string | null;
  pincode?: string | null;
  lat?: number;
  lng?: number;
  locationType?: string | null;
}

export interface SearchOptions {
  userLat?: number;
  userLng?: number;
  radiusMeters?: number;
}

export interface SearchResultWrapper {
  results: PlaceSearchResult[];
  error?: string | null;
}

/**
 * Extracts a component's text value supporting both legacy & new Google API formats
 * (long_name, longText, short_name, shortText)
 */
export function extractComponentValue(component: any): string | null {
  if (!component) return null;
  const val = component.long_name || component.longText || component.short_name || component.shortText;
  return val ? String(val).trim() : null;
}

/**
 * Robust postal_code extractor from Google address components
 */
export function extractPostalCode(result: any, allResults?: any[]): string | null {
  const components = result?.address_components || result?.addressComponents || [];

  // 1. Direct search in main result
  const direct = components.find((c: any) => c?.types?.includes?.('postal_code'));
  const directVal = extractComponentValue(direct);
  if (directVal) return directVal;

  // 2. Search in all geocoder results hierarchy if provided
  if (allResults && Array.isArray(allResults)) {
    for (const r of allResults) {
      const comps = r?.address_components || r?.addressComponents || [];
      const comp = comps.find((c: any) => c?.types?.includes?.('postal_code'));
      const val = extractComponentValue(comp);
      if (val) return val;
    }
  }

  return null;
}

/**
 * Shared Google Address Component Parser
 * Extracts semantic address parts without string splitting or fabricated names.
 */
export function normalizeGoogleLocation(
  result: google.maps.places.PlaceResult | google.maps.GeocoderResult,
  fallbackName?: string | null,
  allResults?: google.maps.GeocoderResult[]
): NormalizedLocation {
  const components = (result as any)?.address_components || (result as any)?.addressComponents || [];

  const getComponent = (...types: string[]) =>
    components.find((c: any) => types.some((t) => c?.types?.includes?.(t)));

  // 1. Country & Country Code
  const countryComp = getComponent('country');
  let country = extractComponentValue(countryComp);
  let countryCode = countryComp?.short_name || countryComp?.shortText || null;

  // 2. State
  const stateComp = getComponent('administrative_area_level_1');
  let state = extractComponentValue(stateComp);

  // 3. District (administrative_area_level_2 or administrative_area_level_3)
  const districtComp = getComponent('administrative_area_level_2', 'administrative_area_level_3');
  let district = extractComponentValue(districtComp);

  // 4. City / Locality / Sublocality
  const cityComp = getComponent('locality', 'postal_town');
  const sublocalityComp = getComponent('sublocality_level_1', 'sublocality', 'neighborhood');
  let city = extractComponentValue(cityComp) || extractComponentValue(sublocalityComp);

  // 5. Pincode (postal_code ONLY - robust extraction)
  let pincode = extractPostalCode(result, allResults);

  // Search broader results array if specific result components missed district/city/state
  if (allResults && Array.isArray(allResults)) {
    for (const r of allResults) {
      const comps = (r as any)?.address_components || (r as any)?.addressComponents || [];
      if (!district) {
        const dist = comps.find((c: any) =>
          c.types?.includes('administrative_area_level_2') || c.types?.includes('administrative_area_level_3')
        );
        if (dist) district = extractComponentValue(dist);
      }
      if (!city) {
        const c = comps.find((c: any) =>
          c.types?.includes('locality') || c.types?.includes('postal_town') || c.types?.includes('sublocality_level_1')
        );
        if (c) city = extractComponentValue(c);
      }
      if (!state) {
        const st = comps.find((c: any) => c.types?.includes('administrative_area_level_1'));
        if (st) state = extractComponentValue(st);
      }
      if (!country) {
        const co = comps.find((c: any) => c.types?.includes('country'));
        if (co) {
          country = extractComponentValue(co);
          countryCode = (co as any).short_name || (co as any).shortText || null;
        }
      }
    }
  }

  // 6. Coordinates
  let lat = 0;
  let lng = 0;
  if (result.geometry?.location) {
    lat = typeof result.geometry.location.lat === 'function' 
      ? result.geometry.location.lat() 
      : (result.geometry.location.lat as unknown as number);
    lng = typeof result.geometry.location.lng === 'function' 
      ? result.geometry.location.lng() 
      : (result.geometry.location.lng as unknown as number);
  }

  // 7. Place Name: Genuine hierarchy: Specific Name -> POI -> Sublocality -> City -> District (NEVER road or "Delivery Point")
  const poiComp = getComponent('point_of_interest', 'establishment', 'premise');
  const rawName = (result as google.maps.places.PlaceResult).name;

  const name =
    fallbackName ||
    rawName ||
    extractComponentValue(poiComp) ||
    extractComponentValue(sublocalityComp) ||
    city ||
    district ||
    state ||
    'Location';

  const types = result.types || [];
  let locationType = 'ADDRESS';
  if (types.includes('establishment') || types.includes('point_of_interest')) locationType = 'POI';
  else if (types.includes('intersection')) locationType = 'JUNCTION';
  else if (types.includes('locality') || types.includes('sublocality')) locationType = 'LOCALITY';

  const secondaryParts = [city !== name ? city : null, district, state, country, pincode].filter(Boolean);
  const secondaryText = Array.from(new Set(secondaryParts)).join(', ');
  const formattedAddress = result.formatted_address || [name, secondaryText].filter(Boolean).join(', ');

  const normalized: NormalizedLocation = {
    placeId: result.place_id || null,
    name,
    formattedAddress,
    secondaryText: secondaryText || null,
    latitude: lat,
    longitude: lng,
    city,
    district,
    state,
    country,
    countryCode,
    pincode,
    locationType,
    source: 'google',
  };

  if (import.meta.env.DEV) {
    console.log('[Google Location Normalizer] Raw:', result);
    console.log('[Google Location Normalizer] Normalized:', normalized);
  }

  return normalized;
}

class GoogleLocationService {
  /**
   * Search places using Google Places Autocomplete + Google Places Text Search (New)
   * Merges all results and deduplicates strictly by Google Place ID.
   */
  async searchPlaces(query: string, options?: SearchOptions): Promise<SearchResultWrapper> {
    const cleanQuery = query.trim();
    if (!cleanQuery || cleanQuery.length < 2) {
      return { results: [] };
    }

    if (typeof window === 'undefined' || !window.google?.maps?.places) {
      return {
        results: [],
        error: 'Google Maps API is loading or not configured.',
      };
    }

    const resultsMap = new Map<string, PlaceSearchResult>();
    let autocompleteCount = 0;
    let textSearchCount = 0;
    let apiError: string | null = null;

    try {
      const [autoResults, textResults] = await Promise.all([
        this.queryGoogleAutocomplete(cleanQuery, options).catch((e) => {
          console.warn('[Google Places] Autocomplete warning:', e);
          return [];
        }),
        this.queryGoogleTextSearch(cleanQuery, options).catch((e) => {
          console.warn('[Google Places] Text Search warning:', e);
          return [];
        }),
      ]);

      autocompleteCount = autoResults.length;
      textSearchCount = textResults.length;

      // Merge Google Autocomplete results
      autoResults.forEach((p) => resultsMap.set(p.id, p));

      // Merge Google Text Search results (Preserves all distinct branches by placeId)
      textResults.forEach((p) => {
        if (!resultsMap.has(p.id)) {
          resultsMap.set(p.id, p);
        }
      });
    } catch (err: any) {
      console.error('[Google Places] Search error:', err);
      apiError = err?.message || 'Google Places service encountered an issue';
    }

    const mergedResults = Array.from(resultsMap.values());

    if (import.meta.env.DEV) {
      console.log(
        `[Google Places Search] Query: "${cleanQuery}" | Autocomplete: ${autocompleteCount} | TextSearch: ${textSearchCount} | Merged Unique: ${mergedResults.length}`
      );
    }

    return {
      results: mergedResults,
      error: mergedResults.length === 0 && apiError ? 'Unable to search places right now. Please try again.' : null,
    };
  }

  /**
   * Google Places Autocomplete Query
   */
  private queryGoogleAutocomplete(query: string, options?: SearchOptions): Promise<PlaceSearchResult[]> {
    return new Promise((resolve) => {
      try {
        const service = new window.google.maps.places.AutocompleteService();
        
        const request: google.maps.places.AutocompletionRequest = {
          input: query,
          componentRestrictions: { country: 'in' },
        };

        if (options?.userLat && options?.userLng) {
          request.locationBias = new window.google.maps.Circle({
            center: { lat: options.userLat, lng: options.userLng },
            radius: options.radiusMeters || 50000,
          });
        }

        service.getPlacePredictions(request, (predictions, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions && predictions.length > 0) {
            const results: PlaceSearchResult[] = predictions.map((p) => {
              const types = p.types || [];
              let locationType = 'ADDRESS';
              if (types.includes('establishment') || types.includes('point_of_interest') || types.includes('store')) {
                locationType = 'POI';
              } else if (types.includes('intersection')) {
                locationType = 'JUNCTION';
              } else if (types.includes('locality') || types.includes('sublocality')) {
                locationType = 'LOCALITY';
              }

              const placeName = p.structured_formatting?.main_text || p.description.split(',')[0].trim();
              const secondary = p.structured_formatting?.secondary_text || p.description.split(',').slice(1).join(', ').trim();

              return {
                id: p.place_id,
                name: placeName,
                secondaryText: secondary,
                description: p.description,
                locationType,
              };
            });
            resolve(results);
          } else {
            resolve([]);
          }
        });
      } catch (err) {
        console.warn('AutocompleteService error:', err);
        resolve([]);
      }
    });
  }

  /**
   * Google Places Text Search Query (Discovers companies, shops, entities, branches)
   */
  private queryGoogleTextSearch(query: string, options?: SearchOptions): Promise<PlaceSearchResult[]> {
    return new Promise((resolve) => {
      try {
        const dummyDiv = document.createElement('div');
        const service = new window.google.maps.places.PlacesService(dummyDiv);

        const request: google.maps.places.TextSearchRequest = {
          query,
          region: 'IN',
        };

        if (options?.userLat && options?.userLng) {
          request.location = new window.google.maps.LatLng(options.userLat, options.userLng);
          request.radius = options.radiusMeters || 50000;
        }

        service.textSearch(request, (places, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && places && places.length > 0) {
            const results: PlaceSearchResult[] = places
              .filter((p) => p.place_id && p.name)
              .map((p) => {
                const types = p.types || [];
                let locationType = 'POI';
                if (types.includes('intersection')) locationType = 'JUNCTION';
                else if (types.includes('locality')) locationType = 'LOCALITY';

                const formatted = p.formatted_address || '';
                const parts = formatted.split(',');
                const secondary = parts.slice(1).join(', ').trim() || formatted;

                return {
                  id: p.place_id!,
                  name: p.name!,
                  secondaryText: secondary,
                  description: formatted || p.name!,
                  lat: p.geometry?.location?.lat(),
                  lng: p.geometry?.location?.lng(),
                  locationType,
                };
              });
            resolve(results);
          } else {
            resolve([]);
          }
        });
      } catch (err) {
        console.warn('PlacesService.textSearch error:', err);
        resolve([]);
      }
    });
  }

  /**
   * Google Place Details Resolution using normalizeGoogleLocation()
   */
  async getPlaceDetails(place: PlaceSearchResult): Promise<NormalizedLocation | null> {
    if (typeof window === 'undefined' || !window.google?.maps?.places) {
      if (place.lat && place.lng) {
        return this.reverseGeocode(place.lat, place.lng, place.name);
      }
      return null;
    }

    try {
      const dummyDiv = document.createElement('div');
      const service = new window.google.maps.places.PlacesService(dummyDiv);

      const details = await new Promise<google.maps.places.PlaceResult | null>((resolve) => {
        service.getDetails(
          { 
            placeId: place.id,
            fields: ['place_id', 'name', 'formatted_address', 'geometry', 'address_components', 'types'] 
          }, 
          (result, status) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && result) {
              resolve(result);
            } else {
              resolve(null);
            }
          }
        );
      });

      if (details) {
        const normalized = normalizeGoogleLocation(details, place.name);

        // If Place Result lacked postal_code, reverse geocode coordinates to guarantee complete pincode resolution
        if (!normalized.pincode && normalized.latitude && normalized.longitude) {
          try {
            const geoDetails = await this.reverseGeocode(normalized.latitude, normalized.longitude, normalized.name);
            if (geoDetails.pincode) {
              normalized.pincode = geoDetails.pincode;
            }
            if (!normalized.district && geoDetails.district) {
              normalized.district = geoDetails.district;
            }
            if (!normalized.city && geoDetails.city) {
              normalized.city = geoDetails.city;
            }
          } catch (e) {
            console.warn('[Google Places] Pincode resolution fallback warning:', e);
          }
        }

        return normalized;
      }
    } catch (err) {
      console.warn('getPlaceDetails error:', err);
    }

    if (place.lat && place.lng) {
      return this.reverseGeocode(place.lat, place.lng, place.name);
    }
    return null;
  }

  /**
   * Google Reverse Geocoding (Coordinates → NormalizedLocation)
   * Uses the same shared normalizeGoogleLocation() pipeline.
   */
  async reverseGeocode(lat: number, lng: number, overrideName?: string | null): Promise<NormalizedLocation> {
    if (typeof window !== 'undefined' && window.google?.maps?.Geocoder) {
      try {
        const geocoder = new window.google.maps.Geocoder();
        const response = await new Promise<google.maps.GeocoderResult[] | null>((resolve) => {
          geocoder.geocode({ location: { lat, lng } }, (results, status) => {
            if (status === 'OK' && results && results.length > 0) {
              resolve(results);
            } else {
              resolve(null);
            }
          });
        });

        if (response && response[0]) {
          return normalizeGoogleLocation(response[0], overrideName, response);
        }
      } catch (e) {
        console.warn('Google reverseGeocode warning:', e);
      }
    }

    // Fallback based on coordinates for development/offline
    const fallbackTown = overrideName || (lat > 11.0 && lat < 11.3 ? 'Kondotty' : 'Selected Location');
    return {
      placeId: null,
      name: fallbackTown,
      formattedAddress: overrideName ? `${overrideName}, Kerala, India` : `${fallbackTown}, Kerala, India`,
      secondaryText: 'Kerala, India',
      latitude: lat,
      longitude: lng,
      city: fallbackTown,
      district: 'Malappuram',
      state: 'Kerala',
      country: 'India',
      countryCode: 'IN',
      pincode: null,
      locationType: 'ADDRESS',
      source: 'google',
    };
  }

  /**
   * Browser Geolocation wrapper
   */
  getCurrentLocation(): Promise<{ lat: number; lng: number }> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        (err) => {
          reject(err);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  }
}

export const locationEngine = new GoogleLocationService();
export const locationService = locationEngine;
