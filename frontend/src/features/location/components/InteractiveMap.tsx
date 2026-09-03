import { useEffect, useRef } from 'react';
import L from 'leaflet';

interface InteractiveMapProps {
  center: { lat: number; lng: number };
  zoom?: number;
  onLocationSelect: (lat: number, lng: number) => void;
  className?: string;
}

export default function InteractiveMap({
  center,
  zoom = 16,
  onLocationSelect,
  className = 'h-72 sm:h-80',
}: InteractiveMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const isProgrammaticMoveRef = useRef(false);
  const hasUserMovedMapRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [center.lat, center.lng],
        zoom,
        zoomControl: false, // Clean UI without floating zoom controls
        attributionControl: false,
      });

      // Standard OSM Tile Layer with fast CDN
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      // Track when user actively interacts with the map
      map.on('dragstart', () => {
        hasUserMovedMapRef.current = true;
      });

      // On Drag / Pan End: extract center coordinates and trigger callback with debounce
      map.on('moveend', () => {
        if (isProgrammaticMoveRef.current) {
          isProgrammaticMoveRef.current = false;
          return;
        }

        // Only fire if the user actually dragged/interacted with the map
        if (!hasUserMovedMapRef.current) {
          return;
        }

        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
          const newCenter = map.getCenter();
          onLocationSelect(newCenter.lat, newCenter.lng);
        }, 350);
      });

      // On Map Click: pan to clicked spot and trigger selection
      map.on('click', (e: L.LeafletMouseEvent) => {
        hasUserMovedMapRef.current = true;
        isProgrammaticMoveRef.current = false;
        map.panTo(e.latlng);
        
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        onLocationSelect(e.latlng.lat, e.latlng.lng);
      });

      // Fix map rendering inside dynamic/modal container
      setTimeout(() => {
        map.invalidateSize();
      }, 200);

      mapInstanceRef.current = map;
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update center when programmatic props change (from search or GPS)
  useEffect(() => {
    if (mapInstanceRef.current) {
      const current = mapInstanceRef.current.getCenter();
      const distance = Math.hypot(current.lat - center.lat, current.lng - center.lng);
      
      // Only pan if coordinate difference is noticeable
      if (distance > 0.0001) {
        isProgrammaticMoveRef.current = true;
        hasUserMovedMapRef.current = false; // Programmatic move, not manual drag
        mapInstanceRef.current.setView([center.lat, center.lng], zoom, {
          animate: true,
        });
      }
    }
  }, [center.lat, center.lng, zoom]);

  return (
    <div className={`relative w-full rounded-2xl border border-[#E2E8F0] overflow-hidden bg-slate-100 shadow-2xs ${className}`}>
      {/* Draggable Map Container */}
      <div 
        ref={mapContainerRef} 
        className="w-full h-full cursor-grab active:cursor-grabbing z-0"
      />

      {/* Fixed Center Delivery Pin Crosshair */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full pointer-events-none z-20">
        <div className="relative">
          <svg
            className="w-10 h-10 text-[#1677C8] filter drop-shadow-md animate-bounce-short"
            viewBox="0 0 24 24"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2ZM12 11.5C10.62 11.5 9.5 10.38 9.5 9C9.5 7.62 10.62 6.5 12 6.5C13.38 6.5 14.5 7.62 14.5 9C14.5 10.38 13.38 11.5 12 11.5Z" />
          </svg>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1 w-3 h-1 bg-black/25 rounded-full blur-[1px]"></div>
        </div>
      </div>

      {/* Touch/Pan helper tag */}
      <div className="absolute bottom-2 left-2 bg-white/95 backdrop-blur-xs border border-gray-200 px-2.5 py-1 rounded-md shadow-xs text-[11px] text-[#64748B] flex items-center gap-1.5 z-10 pointer-events-none">
        <span>Drag map to adjust exact delivery point</span>
      </div>

      <style>{`
        @keyframes bounce-short {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .animate-bounce-short {
          animation: bounce-short 0.25s ease-in-out;
        }
      `}</style>
    </div>
  );
}
