import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EdropsLogo } from '../Logo';

interface SplashScreenProps {
  onComplete?: () => void;
  forceShow?: boolean;
}

export default function SplashScreen({ onComplete, forceShow = false }: SplashScreenProps) {
  const [isVisible, setIsVisible] = useState(() => {
    if (forceShow) return true;
    return !sessionStorage.getItem('edrops_splash_shown');
  });

  useEffect(() => {
    if (!isVisible) {
      onComplete?.();
      return;
    }

    // Sequence: 900ms reveal + 600ms hold = 1500ms before triggering exit animation
    const timer = setTimeout(() => {
      sessionStorage.setItem('edrops_splash_shown', 'true');
      setIsVisible(false);
      setTimeout(() => {
        onComplete?.();
      }, 500); // Wait for exit animation to complete
    }, 1600);

    return () => clearTimeout(timer);
  }, [isVisible, onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="splash-screen"
          initial={{ opacity: 1 }}
          exit={{
            opacity: 0,
            scale: 1.05,
            filter: 'blur(8px)',
            transition: { duration: 0.5, ease: [0.76, 0, 0.24, 1] },
          }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-[#0088CC] via-[#006EAA] to-[#0B3B5C] select-none overflow-hidden"
        >
          {/* Subtle Water Topography Watermark */}
          <div className="absolute inset-0 opacity-[0.07] pointer-events-none">
            <svg
              className="w-full h-full object-cover"
              viewBox="0 0 1000 1000"
              xmlns="http://www.w3.org/2000/svg"
              preserveAspectRatio="none"
            >
              <path
                d="M0,300 C300,200 700,400 1000,250 L1000,1000 L0,1000 Z"
                fill="white"
              />
              <path
                d="M0,500 C400,350 600,600 1000,450 L1000,1000 L0,1000 Z"
                fill="white"
                opacity="0.5"
              />
            </svg>
          </div>

          {/* Ambient Glowing Orbs */}
          <div className="absolute w-72 h-72 bg-sky-300/20 rounded-full blur-[90px] pointer-events-none animate-glow-1" />
          <div className="absolute w-72 h-72 bg-white/15 rounded-full blur-[90px] pointer-events-none animate-glow-2" />

          {/* Logo Reveal Animation (Curtain Wipe Left-to-Right) */}
          <motion.div
            initial={{ clipPath: 'inset(0 100% 0 0)' }}
            animate={{ clipPath: 'inset(0 0% 0 0)' }}
            transition={{ duration: 0.9, ease: [0.76, 0, 0.24, 1] }}
            className="relative z-10 flex flex-col items-center"
          >
            <EdropsLogo variant="white" className="h-10 sm:h-12 w-auto drop-shadow-md" />
            <span className="text-white/80 text-xs sm:text-sm font-semibold tracking-widest uppercase mt-3">
              Pure Water • Delivered
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
