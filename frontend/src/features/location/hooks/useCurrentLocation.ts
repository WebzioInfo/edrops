import { useState, useCallback } from 'react';

interface LocationState {
  lat: number | null;
  lng: number | null;
  loading: boolean;
  error: string | null;
}

export function useCurrentLocation() {
  const [state, setState] = useState<LocationState>({
    lat: null,
    lng: null,
    loading: false,
    error: null,
  });

  const getCurrentLocation = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    if (!navigator.geolocation) {
      setState({
        lat: null,
        lng: null,
        loading: false,
        error: 'Geolocation is not supported by your browser.',
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          loading: false,
          error: null,
        });
      },
      (error) => {
        let errorMessage = 'Unable to retrieve your location.';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied. Please enable it in your browser settings.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable.';
            break;
          case error.TIMEOUT:
            errorMessage = 'The request to get user location timed out.';
            break;
        }
        setState({
          lat: null,
          lng: null,
          loading: false,
          error: errorMessage,
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, []);

  return { ...state, getCurrentLocation };
}
