import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Sparkles } from 'lucide-react';
import usePWAInstall from '../../hooks/usePWAInstall';
import IOSInstallInstructions from './IOSInstallInstructions';

export default function PWAInstallPrompt() {
  const { isInstallable, isIOS, showInstallPrompt, dismissPrompt } = usePWAInstall();
  const [isVisible, setIsVisible] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isInstallable) {
      // 3-second delay on initial load for premium user experience
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [isInstallable]);

  // Handle escape key listener for accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    if (isVisible) {
      window.addEventListener('keydown', handleKeyDown);
      // Focus the close button when prompt opens for keyboard users
      setTimeout(() => closeButtonRef.current?.focus(), 100);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible]);

  if (!isVisible) return null;

  const handleInstallClick = async () => {
    if (isIOS) return; // iOS doesn't support native triggers, they follow the guide
    const outcome = await showInstallPrompt();
    if (outcome === 'accepted') {
      setIsVisible(false);
    }
  };

  const handleClose = () => {
    dismissPrompt();
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center p-4">
        {/* Backdrop Blur Overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        />

        {/* Responsive Dialog (Desktop: Modal, Mobile: Bottom Sheet) */}
        <motion.div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-title"
          aria-describedby="pwa-install-description"
          initial={{ 
            opacity: 0, 
            y: window.innerWidth >= 768 ? 20 : '100%',
            scale: window.innerWidth >= 768 ? 0.95 : 1
          }}
          animate={{ 
            opacity: 1, 
            y: 0,
            scale: 1
          }}
          exit={{ 
            opacity: 0, 
            y: window.innerWidth >= 768 ? 20 : '100%',
            scale: window.innerWidth >= 768 ? 0.95 : 1
          }}
          transition={{ type: 'spring', damping: 25, stiffness: 220 }}
          className="relative w-full max-w-md bg-white rounded-t-2xl md:rounded-2xl shadow-xl overflow-hidden border border-slate-200/80 p-6 flex flex-col gap-5 max-h-[90vh] overflow-y-auto no-scrollbar"
        >
          {/* Close Button */}
          <button
            ref={closeButtonRef}
            onClick={handleClose}
            aria-label="Dismiss installation prompt"
            className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors focus:ring-2 focus:ring-[#2D79A8] outline-none"
          >
            <X size={18} />
          </button>

          {isIOS ? (
            /* iOS Custom Screen Flow */
            <IOSInstallInstructions />
          ) : (
            /* Android/Desktop Standard Flow */
            <div className="flex flex-col items-center text-center gap-4 py-2">
              {/* App Icon Circle */}
              <div className="relative h-20 w-20 rounded-2xl bg-[#EBF5FB] border border-[#BBDFF2]/60 shadow-sm flex items-center justify-center p-3">
                <img 
                  src="/icon-192.png" 
                  alt="Edrops App Icon" 
                  className="h-full w-full object-contain rounded-xl"
                  onError={(e) => {
                    // Fallback to inline SVG logo if asset fails to load
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>

              {/* Title & Description */}
              <div className="flex flex-col gap-1.5">
                <h3 id="pwa-install-title" className="text-xl font-bold text-[#245361] flex items-center justify-center gap-1.5">
                  Install Edrops <Sparkles size={16} className="text-[#33BFD0] fill-[#33BFD0]/20" />
                </h3>
                <p id="pwa-install-description" className="text-sm text-slate-500 leading-relaxed max-w-sm">
                  Add Edrops to your home screen or desktop. Get instant updates, full-screen offline workspace support, and streamlined logistics tracking.
                </p>
              </div>

              {/* CTA Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 w-full mt-3">
                <button
                  onClick={handleClose}
                  className="order-2 sm:order-1 flex-1 py-3 px-4 border border-[#BBDFF2] text-[#2D79A8] hover:bg-slate-50 text-sm font-semibold rounded-xl transition-all cursor-pointer outline-none focus:ring-2 focus:ring-[#2D79A8]/40"
                >
                  Not Now
                </button>
                <button
                  onClick={handleInstallClick}
                  className="order-1 sm:order-2 flex-1 py-3 px-4 bg-[#2D79A8] text-white hover:bg-[#245361] text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-md shadow-[#2D79A8]/20 cursor-pointer outline-none focus:ring-2 focus:ring-[#2D79A8] focus:ring-offset-2"
                >
                  <Download size={16} />
                  Install App
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
