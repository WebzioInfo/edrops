import { useState, useCallback } from 'react';

export function useLocationPicker(defaultCenter = { lat: 20.5937, lng: 78.9629 }) {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [center, setCenter] = useState(defaultCenter);
  
  const onLoad = useCallback(function callback(map: google.maps.Map) {
    setMap(map);
  }, []);

  const onUnmount = useCallback(function callback() {
    setMap(null);
  }, []);

  const panTo = useCallback((lat: number, lng: number) => {
    if (map) {
      map.panTo({ lat, lng });
      map.setZoom(17); // Zoom in when moving to a specific location
    }
    setCenter({ lat, lng });
  }, [map]);

  return { map, center, setCenter, onLoad, onUnmount, panTo };
}
