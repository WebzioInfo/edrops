export default function IOSInstallInstructions() {
  return (
    <div className="flex flex-col gap-6 py-2">
      <div className="text-center">
        <h3 className="text-lg font-bold text-[#245361]">Install Edrops on iOS</h3>
        <p className="text-sm text-slate-500 mt-1">
          Safari on iPhone/iPad does not support automatic installation. Follow these steps to add it manually:
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {/* Step 1 */}
        <div className="flex items-start gap-4 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm border border-slate-200 text-slate-600">
            {/* Safari Share Icon */}
            <svg
              className="h-6 w-6 text-blue-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="5" y="10" width="14" height="11" rx="2" />
              <line x1="12" y1="13" x2="12" y2="2" />
              <path d="M9 5l3-3 3 3" />
            </svg>
          </div>
          <div>
            <span className="text-xs font-black text-[#2D79A8] uppercase tracking-wider block mb-0.5">Step 1</span>
            <p className="text-sm font-semibold text-slate-700">
              Tap the <span className="text-blue-500 font-bold">Share</span> button in Safari's bottom toolbar.
            </p>
          </div>
        </div>

        {/* Step 2 */}
        <div className="flex items-start gap-4 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm border border-slate-200 text-slate-600">
            {/* Add to Home Screen Icon */}
            <svg
              className="h-6 w-6 text-slate-800"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="4" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
          </div>
          <div>
            <span className="text-xs font-black text-[#2D79A8] uppercase tracking-wider block mb-0.5">Step 2</span>
            <p className="text-sm font-semibold text-slate-700">
              Scroll down the share menu and select <span className="font-bold">"Add to Home Screen"</span>.
            </p>
          </div>
        </div>

        {/* Step 3 */}
        <div className="flex items-start gap-4 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm border border-slate-200">
            <span className="text-xs font-bold text-blue-500 uppercase">Add</span>
          </div>
          <div>
            <span className="text-xs font-black text-[#2D79A8] uppercase tracking-wider block mb-0.5">Step 3</span>
            <p className="text-sm font-semibold text-slate-700">
              Tap <span className="text-blue-500 font-bold">Add</span> in the top right corner to complete the installation.
            </p>
          </div>
        </div>
      </div>

      <div className="text-center text-xs text-slate-400 mt-2 bg-slate-100/60 p-2.5 rounded-lg border border-dashed border-slate-200">
        Once installed, open **Edrops** directly from your home screen for offline support and full-screen workspace mode.
      </div>
    </div>
  );
}
