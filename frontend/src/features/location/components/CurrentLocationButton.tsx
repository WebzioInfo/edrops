import { LocateFixed } from 'lucide-react';

interface CurrentLocationButtonProps {
  onClick: () => void;
  loading: boolean;
}

export default function CurrentLocationButton({ onClick, loading }: CurrentLocationButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`absolute bottom-6 right-6 p-3 bg-white rounded-full shadow-lg border border-gray-100 transition-all z-10 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#7EBFE4] ${
        loading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-gray-50 hover:shadow-xl active:scale-95'
      }`}
      aria-label="Use current location"
      title="Use current location"
    >
      <LocateFixed className={`w-6 h-6 text-[#245361] ${loading ? 'animate-pulse' : ''}`} strokeWidth={2} />
    </button>
  );
}
