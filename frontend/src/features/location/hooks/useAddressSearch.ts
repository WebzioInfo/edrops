import usePlacesAutocomplete, { getGeocode, getLatLng } from 'use-places-autocomplete';
import { useCallback, useState } from 'react';

export function useAddressSearch() {
  const {
    ready,
    value,
    suggestions: { status, data },
    setValue,
    clearSuggestions,
  } = usePlacesAutocomplete({
    requestOptions: {
      componentRestrictions: { country: 'in' }, // Restrict to India for Edrops, can be customized
    },
    debounce: 300,
  });

  const [loading, setLoading] = useState(false);

  const handleSelect = useCallback(
    async (address: string): Promise<{ lat: number; lng: number; address: string } | null> => {
      setValue(address, false);
      clearSuggestions();
      setLoading(true);

      try {
        const results = await getGeocode({ address });
        const { lat, lng } = await getLatLng(results[0]);
        setLoading(false);
        return { lat, lng, address: results[0].formatted_address };
      } catch (error) {
        console.error('Error fetching geocode:', error);
        setLoading(false);
        return null;
      }
    },
    [setValue, clearSuggestions]
  );

  return {
    ready,
    value,
    setValue,
    suggestions: data,
    status,
    clearSuggestions,
    handleSelect,
    loading,
  };
}
