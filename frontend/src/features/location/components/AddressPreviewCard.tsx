import type { GeocodedAddress } from '../hooks/useReverseGeocoding';

interface AddressPreviewCardProps {
  address: GeocodedAddress | null;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function AddressPreviewCard({ address, loading, onConfirm, onCancel }: AddressPreviewCardProps) {
  return (
    <div className="bg-white rounded-t-2xl md:rounded-b-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.08)] md:shadow-lg border-t md:border border-gray-100 p-5 md:p-6 w-full max-w-md mx-auto md:absolute md:bottom-6 md:left-1/2 md:-translate-x-1/2 z-20 transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-800">Confirm Location</h3>
      </div>
      
      <div className="min-h-[80px]">
        {loading ? (
          <div className="flex flex-col space-y-3 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
          </div>
        ) : address ? (
          <div>
            <p className="text-gray-800 font-medium mb-1">
              {address.street || address.area || 'Unknown Location'}
            </p>
            <p className="text-sm text-gray-500 line-clamp-2">
              {[address.area, address.city, address.state, address.zipCode].filter(Boolean).join(', ')}
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm italic">
            Move map to select location
          </div>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="w-full px-4 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 font-medium rounded-xl transition-colors border border-gray-200"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading || !address}
          className="w-full px-4 py-2.5 bg-[#245361] hover:bg-[#1a3c46] text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
        >
          Confirm
        </button>
      </div>
    </div>
  );
}
