import { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  MapPin, 
  LocateFixed, 
  X, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Building2,
  Milestone
} from 'lucide-react';
import { 
  locationEngine, 
  type NormalizedLocation, 
  type PlaceSearchResult 
} from '../services/LocationEngine';
import InteractiveMap from './InteractiveMap';

interface LocationPickerFieldProps {
  initialLat?: number | null;
  initialLng?: number | null;
  initialName?: string;
  initialFormattedAddress?: string;
  onLocationChange: (data: NormalizedLocation) => void;
  error?: string | null;
}

const DEFAULT_CENTER = { lat: 11.1455, lng: 75.9647 }; // Kondotty, Kerala default

export default function LocationPickerField({
  initialLat,
  initialLng,
  initialName,
  initialFormattedAddress,
  onLocationChange,
  error,
}: LocationPickerFieldProps) {
  // Center coordinates for map
  const [center, setCenter] = useState<{ lat: number; lng: number }>(() => {
    if (initialLat && initialLng && !isNaN(initialLat) && !isNaN(initialLng)) {
      return { lat: initialLat, lng: initialLng };
    }
    return DEFAULT_CENTER;
  });

  // Selected normalized location
  const [selectedLocation, setSelectedLocation] = useState<NormalizedLocation | null>(() => {
    if (initialLat && initialLng && !isNaN(initialLat) && !isNaN(initialLng)) {
      const parts = (initialFormattedAddress || '').split(',').map((p) => p.trim());
      return {
        placeId: `init_${initialLat}_${initialLng}`,
        name: initialName || (parts[0] || 'Saved Location'),
        formattedAddress: initialFormattedAddress || 'Saved delivery location',
        secondaryText: parts.slice(1).join(', ') || null,
        latitude: initialLat,
        longitude: initialLng,
        city: parts[1] || parts[0] || 'Kondotty',
        district: 'Malappuram',
        state: 'Kerala',
        country: 'India',
        countryCode: 'IN',
        pincode: null,
        locationType: 'ADDRESS',
        source: 'google',
      };
    }
    return null;
  });

  // Search input state
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Status & action states
  const [locating, setLocating] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'info' | 'error' | 'success'>('info');

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync initial props
  useEffect(() => {
    if (initialLat && initialLng && !isNaN(initialLat) && !isNaN(initialLng)) {
      const coords = { lat: initialLat, lng: initialLng };
      setCenter(coords);
      const parts = (initialFormattedAddress || '').split(',').map((p) => p.trim());
      setSelectedLocation({
        placeId: `init_${initialLat}_${initialLng}`,
        name: initialName || (parts[0] || 'Saved Location'),
        formattedAddress: initialFormattedAddress || 'Saved delivery location',
        secondaryText: parts.slice(1).join(', ') || null,
        latitude: initialLat,
        longitude: initialLng,
        city: parts[1] || parts[0] || 'Kondotty',
        district: 'Malappuram',
        state: 'Kerala',
        country: 'India',
        countryCode: 'IN',
        pincode: null,
        locationType: 'ADDRESS',
        source: 'google',
      });
    } else {
      setSelectedLocation(null);
      setSearchQuery('');
      setStatusMessage(null);
    }
  }, [initialLat, initialLng, initialName, initialFormattedAddress]);

  // Debounced search query
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setSearchError(null);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!val.trim() || val.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    setShowSuggestions(true);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const { results, error } = await locationEngine.searchPlaces(val, {
          userLat: center.lat,
          userLng: center.lng,
        });
        setSuggestions(results);
        setSearchError(error || null);
      } catch (err) {
        console.warn('[Places Search] searchPlaces error:', err);
        setSuggestions([]);
        setSearchError('Unable to search places right now. Please try again.');
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  };

  // Handle Suggestion Selection
  const handleSelectSuggestion = async (place: PlaceSearchResult) => {
    setSearchQuery(place.name);
    setShowSuggestions(false);
    setResolving(true);
    setStatusMessage('Loading place details...');
    setStatusType('info');

    try {
      const details = await locationEngine.getPlaceDetails(place);
      if (details) {
        setSelectedLocation(details);
        setCenter({ lat: details.latitude, lng: details.longitude });
        onLocationChange(details);
        setStatusMessage(`Location selected: ${details.name}`);
        setStatusType('success');
      } else {
        setStatusMessage('Could not retrieve full coordinates for this place.');
        setStatusType('error');
      }
    } catch (err: any) {
      setStatusMessage('Error retrieving place details. Try another location.');
      setStatusType('error');
    } finally {
      setResolving(false);
    }
  };

  // Map Click handler
  const handleMapClick = async (lat: number, lng: number) => {
    setCenter({ lat, lng });
    setResolving(true);
    setStatusMessage('Resolving address from map...');
    setStatusType('info');

    try {
      const loc = await locationEngine.reverseGeocode(lat, lng);
      setSelectedLocation(loc);
      onLocationChange(loc);
      setStatusMessage(`Location pinned: ${loc.name}`);
      setStatusType('success');
    } catch (err) {
      console.warn('Reverse geocode error:', err);
    } finally {
      setResolving(false);
    }
  };

  // "Use Current Location" handler
  const handleUseCurrentLocation = async () => {
    setLocating(true);
    setStatusMessage('Detecting current GPS location...');
    setStatusType('info');

    try {
      const coords = await locationEngine.getCurrentLocation();
      setCenter(coords);

      const loc = await locationEngine.reverseGeocode(coords.lat, coords.lng);
      setSelectedLocation(loc);
      onLocationChange(loc);

      setStatusMessage(`Current location found: ${loc.name}`);
      setStatusType('success');
    } catch (err: any) {
      let msg = 'Unable to determine your current location. Please search manually.';
      if (err?.code === 1 || err?.message?.includes('denied')) {
        msg = 'Location permission was denied. Allow location access or search manually.';
      } else if (err?.code === 3) {
        msg = 'Location request timed out. Please try again or search manually.';
      }
      setStatusMessage(msg);
      setStatusType('error');
    } finally {
      setLocating(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Search Input & Dynamic Suggestions Dropdown */}
      <div className="space-y-2">
        <div ref={searchContainerRef} className="relative z-30">
          <div className="relative flex items-center bg-white border border-[#E2E8F0] rounded-xl focus-within:border-[#1677C8] focus-within:ring-2 focus-within:ring-[#1677C8]/10 transition-all shadow-2xs">
            <Search className="w-4 h-4 text-gray-400 ml-3.5 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              placeholder="Search company, shop, landmark, town, or area..."
              className="w-full px-3 py-2.5 text-xs sm:text-sm bg-transparent outline-none text-[#16324F] placeholder:text-gray-400 font-medium"
            />
            {searchLoading && (
              <Loader2 className="w-4 h-4 text-[#1677C8] animate-spin mr-2.5 shrink-0" />
            )}
            {searchQuery && !searchLoading && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSuggestions([]);
                  setShowSuggestions(false);
                }}
                className="p-1.5 mr-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Dynamic Place Suggestions Dropdown with Branch & Locality Differentiation */}
          {showSuggestions && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl border border-[#E2E8F0] overflow-hidden z-50 max-h-72 overflow-y-auto animate-in fade-in">
              {suggestions.length > 0 ? (
                <div>
                  <div className="px-3.5 py-1.5 bg-slate-50 border-b border-gray-100 text-[11px] font-semibold text-[#64748B] flex items-center justify-between">
                    <span>Matching Places</span>
                    <span className="text-[10px] text-[#1677C8] font-bold">{suggestions.length} found</span>
                  </div>
                  <ul className="divide-y divide-gray-50">
                    {suggestions.map((item) => {
                      const isJunction = item.locationType === 'JUNCTION';
                      const isPOI = item.locationType === 'POI';

                      return (
                        <li
                          key={item.id}
                          onClick={() => handleSelectSuggestion(item)}
                          className="px-3.5 py-2.5 hover:bg-blue-50/70 cursor-pointer flex items-start gap-2.5 transition-colors"
                        >
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#1677C8] mt-0.5">
                            {isJunction ? (
                              <Milestone className="w-3.5 h-3.5" />
                            ) : isPOI ? (
                              <Building2 className="w-3.5 h-3.5" />
                            ) : (
                              <MapPin className="w-3.5 h-3.5" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs sm:text-sm font-bold text-[#16324F] truncate">
                              {item.name}
                            </p>
                            {item.secondaryText && (
                              <p className="text-[11px] text-[#64748B] truncate">
                                {item.secondaryText}
                              </p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : searchError ? (
                <div className="px-4 py-3 text-xs text-amber-700 bg-amber-50 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{searchError}</span>
                </div>
              ) : (
                <div className="px-4 py-3 text-xs text-[#64748B] text-center">
                  No places found for "{searchQuery}". Try searching with a different landmark, shop, or area.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Use Current Location Action Button */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={locating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1677C8] bg-blue-50/80 hover:bg-blue-100/70 border border-blue-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            {locating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1677C8]" />
            ) : (
              <LocateFixed className="w-3.5 h-3.5 text-[#1677C8]" />
            )}
            <span>{locating ? 'Detecting location...' : 'Use Current Location'}</span>
          </button>

          {resolving && (
            <span className="text-[11px] text-[#64748B] flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin text-[#1677C8]" />
              <span>Resolving address...</span>
            </span>
          )}
        </div>
      </div>

      {/* Interactive Map Component */}
      <InteractiveMap
        center={center}
        zoom={16}
        onLocationSelect={handleMapClick}
      />

      {/* Selected Location Summary Card - Clean Place Name + Secondary Address Hierarchy */}
      {selectedLocation ? (
        <div className="p-3.5 bg-blue-50/60 border border-blue-100 rounded-xl space-y-1 animate-in fade-in">
          <div className="flex items-center gap-1.5 text-[#1677C8] font-bold text-xs">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Location Selected</span>
          </div>
          <p className="text-sm font-bold text-[#16324F] leading-tight">
            {selectedLocation.name}
          </p>
          <p className="text-xs text-[#64748B] leading-relaxed">
            {selectedLocation.secondaryText || selectedLocation.formattedAddress}
          </p>
        </div>
      ) : (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-[#64748B] flex items-center gap-2">
          <MapPin className="w-4 h-4 text-[#1677C8] shrink-0" />
          <span>Select a place or move the map to pinpoint the delivery location.</span>
        </div>
      )}

      {/* Status Messages */}
      {statusMessage && (
        <div
          className={`text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1.5 ${
            statusType === 'error'
              ? 'bg-red-50 text-red-600 border border-red-100'
              : statusType === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
              : 'bg-blue-50 text-[#1677C8] border border-blue-100'
          }`}
        >
          {statusType === 'error' ? (
            <AlertCircle className="w-3 h-3 shrink-0" />
          ) : (
            <CheckCircle className="w-3 h-3 shrink-0" />
          )}
          <span>{statusMessage}</span>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-500 font-medium">{error}</p>
      )}
    </div>
  );
}
