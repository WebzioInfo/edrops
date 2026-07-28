import React from 'react';

export default function MapMarker() {
  return (
    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-full z-10 pointer-events-none">
      <div className="relative">
        <svg
          className="w-10 h-10 text-red-500 filter drop-shadow-md animate-bounce-short"
          viewBox="0 0 24 24"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2ZM12 11.5C10.62 11.5 9.5 10.38 9.5 9C9.5 7.62 10.62 6.5 12 6.5C13.38 6.5 14.5 7.62 14.5 9C14.5 10.38 13.38 11.5 12 11.5Z" />
        </svg>
        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1 w-2 h-1 bg-black/20 rounded-full blur-[2px]"></div>
      </div>
      <style>{`
        @keyframes bounce-short {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .animate-bounce-short {
          animation: bounce-short 0.3s ease-in-out;
        }
      `}</style>
    </div>
  );
}
