import React, { useState } from 'react';
import { MapPin } from 'lucide-react';
import MapDialog from './MapDialog';
import { GeocodedAddress } from '../hooks/useReverseGeocoding';

interface LocationPickerProps {
  onLocationSelected: (lat: number, lng: number, address: GeocodedAddress, googleMapsUrl: string) => void;
  defaultLat?: number;
  defaultLng?: number;
}

export default function LocationPicker({ onLocationSelected, defaultLat, defaultLng }: LocationPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleConfirm = (data: { lat: number; lng: number; address: GeocodedAddress }) => {
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${data.lat},${data.lng}`;
    onLocationSelected(data.lat, data.lng, data.address, googleMapsUrl);
  };

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center justify-center space-x-2 py-3.5 px-4 bg-[#F2F8FB] hover:bg-[#E5F3FA] text-[#245361] border border-[#7EBFE4] border-dashed rounded-xl font-medium transition-all group"
      >
        <MapPin className="w-5 h-5 group-hover:scale-110 transition-transform" />
        <span>Select Location on Map</span>
      </button>

      {isOpen && (
        <MapDialog
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onConfirm={handleConfirm}
          initialLat={defaultLat}
          initialLng={defaultLng}
        />
      )}
    </div>
  );
}
