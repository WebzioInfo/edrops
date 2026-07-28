import React, { useCallback, useRef, useState, useEffect } from 'react';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { useLocationPicker } from '../hooks/useLocationPicker';
import { useCurrentLocation } from '../hooks/useCurrentLocation';
import { useReverseGeocoding, GeocodedAddress } from '../hooks/useReverseGeocoding';
import { useAddressSearch } from '../hooks/useAddressSearch';
import AddressSearch from './AddressSearch';
import CurrentLocationButton from './CurrentLocationButton';
import MapMarker from './MapMarker';
import AddressPreviewCard from './AddressPreviewCard';

const libraries: ("places" | "geometry" | "drawing" | "visualization")[] = ['places'];
const mapContainerStyle = { width: '100%', height: '100%' };
const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 }; // Center of India

interface MapDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: { lat: number; lng: number; address: GeocodedAddress }) => void;
  initialLat?: number;
  initialLng?: number;
}

export default function MapDialog({ isOpen, onClose, onConfirm, initialLat, initialLng }: MapDialogProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries,
  });

  const [currentAddress, setCurrentAddress] = useState<GeocodedAddress | null>(null);
  
  const { map, center, setCenter, onLoad, onUnmount, panTo } = useLocationPicker(
    initialLat && initialLng ? { lat: initialLat, lng: initialLng } : DEFAULT_CENTER
  );
  
  const { getCurrentLocation, lat: userLat, lng: userLng, loading: locLoading, error: locError } = useCurrentLocation();
  const { reverseGeocode, loading: geoLoading } = useReverseGeocoding();
  const searchHook = useAddressSearch();

  // Handle Current Location Updates
  useEffect(() => {
    if (userLat && userLng) {
      panTo(userLat, userLng);
      handleReverseGeocode(userLat, userLng);
    }
  }, [userLat, userLng]);

  // Initial load or when initial coordinates change
  useEffect(() => {
    if (isOpen && isLoaded) {
      if (initialLat && initialLng) {
        handleReverseGeocode(initialLat, initialLng);
      } else if (!currentAddress) {
        // Automatically try to get location on open if no initial location provided
        getCurrentLocation();
      }
    }
  }, [isOpen, isLoaded]);

  const handleReverseGeocode = async (lat: number, lng: number) => {
    const address = await reverseGeocode(lat, lng);
    setCurrentAddress(address);
  };

  const handleDragEnd = useCallback(() => {
    if (map) {
      const newCenter = map.getCenter();
      if (newCenter) {
        const lat = newCenter.lat();
        const lng = newCenter.lng();
        setCenter({ lat, lng });
        handleReverseGeocode(lat, lng);
      }
    }
  }, [map, setCenter]);

  const handleSearchSelect = async (description: string) => {
    const result = await searchHook.handleSelect(description);
    if (result) {
      panTo(result.lat, result.lng);
      handleReverseGeocode(result.lat, result.lng);
    }
  };

  const handleConfirm = () => {
    if (currentAddress) {
      onConfirm({ lat: center.lat, lng: center.lng, address: currentAddress });
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity">
      <div className="relative w-full h-[90vh] md:h-[80vh] md:max-w-4xl bg-white md:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-300">
        
        {/* Header - Mobile Only (Hidden on desktop as we have X button overlay) */}
        <div className="md:hidden flex items-center justify-between p-4 border-b bg-white z-10 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800">Select Location</h2>
          <button onClick={onClose} className="p-2 -mr-2 text-gray-500 rounded-full hover:bg-gray-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Close Button - Desktop Only */}
        <button 
          onClick={onClose} 
          className="hidden md:flex absolute top-6 right-6 z-20 p-2.5 bg-white rounded-full shadow-lg hover:bg-gray-50 hover:scale-105 transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="relative flex-grow h-full w-full">
          {loadError ? (
            <div className="flex items-center justify-center h-full bg-red-50 text-red-600 p-6 text-center">
              Failed to load Google Maps. Please check your API key and network connection.
            </div>
          ) : !isLoaded ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
              <div className="w-10 h-10 border-4 border-[#7EBFE4] border-t-[#245361] rounded-full animate-spin"></div>
              <p className="text-gray-500 font-medium">Loading Map...</p>
            </div>
          ) : (
            <>
              <AddressSearch
                value={searchHook.value}
                setValue={searchHook.setValue}
                suggestions={searchHook.suggestions}
                status={searchHook.status}
                onSelect={handleSearchSelect}
                clearSuggestions={searchHook.clearSuggestions}
                disabled={searchHook.loading}
              />
              
              <GoogleMap
                mapContainerStyle={mapContainerStyle}
                center={center}
                zoom={initialLat && initialLng ? 17 : 5}
                onLoad={onLoad}
                onUnmount={onUnmount}
                onDragEnd={handleDragEnd}
                options={{
                  disableDefaultUI: true,
                  zoomControl: false,
                  gestureHandling: 'greedy', // Better mobile touch handling
                }}
              />
              
              <MapMarker />
              
              <CurrentLocationButton onClick={getCurrentLocation} loading={locLoading} />
              
              {locError && (
                <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-20">
                  {locError}
                </div>
              )}
            </>
          )}
        </div>

        {/* Desktop Absolute overlay / Mobile flex child */}
        <div className="w-full">
          <AddressPreviewCard 
            address={currentAddress} 
            loading={geoLoading} 
            onConfirm={handleConfirm} 
            onCancel={onClose} 
          />
        </div>
      </div>
    </div>
  );
}
