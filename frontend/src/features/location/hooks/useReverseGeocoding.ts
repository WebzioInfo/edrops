import { useState, useCallback } from 'react';

export interface GeocodedAddress {
  street: string;
  area: string;
  city: string;
  district: string;
  state: string;
  zipCode: string;
  country: string;
}

export function useReverseGeocoding() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reverseGeocode = useCallback(async (lat: number, lng: number): Promise<GeocodedAddress | null> => {
    if (!window.google || !window.google.maps) {
      setError('Google Maps API is not loaded.');
      return null;
    }

    setLoading(true);
    setError(null);

    const geocoder = new window.google.maps.Geocoder();

    return new Promise((resolve) => {
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        setLoading(false);
        if (status === 'OK' && results && results[0]) {
          const components = results[0].address_components;
          const address: GeocodedAddress = {
            street: '',
            area: '',
            city: '',
            district: '',
            state: '',
            zipCode: '',
            country: 'India',
          };

          components.forEach((component) => {
            const types = component.types;
            if (types.includes('route')) address.street = component.long_name;
            if (types.includes('sublocality_level_1') || types.includes('sublocality_level_2')) {
              address.area = address.area ? `${address.area}, ${component.long_name}` : component.long_name;
            }
            if (types.includes('locality')) address.city = component.long_name;
            if (types.includes('administrative_area_level_3')) address.district = component.long_name;
            if (types.includes('administrative_area_level_1')) address.state = component.long_name;
            if (types.includes('postal_code')) address.zipCode = component.long_name;
            if (types.includes('country')) address.country = component.long_name;
          });

          // Fallback logic if street is empty but we have a premise or sublocality
          if (!address.street) {
             const premise = components.find(c => c.types.includes('premise'))?.long_name;
             if (premise) address.street = premise;
             else address.street = address.area || results[0].formatted_address.split(',')[0];
          }

          resolve(address);
        } else {
          setError('Failed to reverse geocode location.');
          resolve(null);
        }
      });
    });
  }, []);

  return { reverseGeocode, loading, error };
}
