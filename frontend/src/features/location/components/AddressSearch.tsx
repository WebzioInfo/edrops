import React, { useRef, useEffect } from 'react';
import { Search, X, MapPin } from 'lucide-react';

interface AddressSearchProps {
  value: string;
  setValue: (val: string) => void;
  suggestions: google.maps.places.AutocompletePrediction[];
  status: string;
  onSelect: (address: string) => void;
  clearSuggestions: () => void;
  disabled?: boolean;
}

export default function AddressSearch({
  value,
  setValue,
  suggestions,
  status,
  onSelect,
  clearSuggestions,
  disabled = false,
}: AddressSearchProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        clearSuggestions();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [clearSuggestions]);

  return (
    <div ref={containerRef} className="absolute top-6 left-1/2 transform -translate-x-1/2 w-11/12 max-w-md z-20">
      <div className="relative flex items-center bg-white rounded-full shadow-lg border border-gray-100 px-4 py-3">
        <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={disabled}
          placeholder="Search area, landmark, or street..."
          className="w-full ml-3 bg-transparent outline-none text-gray-700 placeholder-gray-400 disabled:opacity-50"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              setValue('');
              clearSuggestions();
            }}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        )}
      </div>

      {status === 'OK' && suggestions.length > 0 && (
        <ul className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-30 max-h-60 overflow-y-auto">
          {suggestions.map((suggestion) => {
            const { place_id, structured_formatting: { main_text, secondary_text } } = suggestion;
            return (
              <li
                key={place_id}
                onClick={() => onSelect(suggestion.description)}
                className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b last:border-0 border-gray-50 flex items-start space-x-3 transition-colors"
              >
                <div className="mt-0.5 bg-gray-100 p-1.5 rounded-full flex-shrink-0">
                  <MapPin className="w-4 h-4 text-gray-500" />
                </div>
                <div className="flex-grow min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{main_text}</p>
                  <p className="text-xs text-gray-500 truncate">{secondary_text}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
