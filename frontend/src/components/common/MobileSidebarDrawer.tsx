import React, { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

export interface MobileSidebarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  backdropClassName?: string;
  ariaLabel?: string;
}

/**
 * MobileSidebarDrawer provides a high-performance, GPU-accelerated slide-in/slide-out
 * drawer panel from the left with synchronized backdrop opacity fade.
 *
 * Supports:
 * - Smooth entrance and exit animations via Framer Motion AnimatePresence
 * - prefers-reduced-motion OS accessibility settings
 * - ESC key handling
 * - Background scroll lock while open
 * - Pure transform translateX (zero layout shift or jank)
 */
export default function MobileSidebarDrawer({
  isOpen,
  onClose,
  children,
  className = 'w-72 max-w-[85vw] bg-white',
  backdropClassName = 'bg-slate-900/50 backdrop-blur-xs',
  ariaLabel = 'Navigation drawer',
}: MobileSidebarDrawerProps) {
  const shouldReduceMotion = useReducedMotion();

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll while drawer is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  const duration = shouldReduceMotion ? 0 : 0.28;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="mobile-drawer-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: shouldReduceMotion ? 0 : 0.25,
            ease: 'easeInOut',
          }}
          onClick={onClose}
          className={`fixed inset-0 z-50 lg:hidden ${backdropClassName}`}
          aria-hidden="true"
        />
      )}

      {isOpen && (
        <motion.aside
          key="mobile-drawer-panel"
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
          initial={{ x: '-100%' }}
          animate={{ x: 0 }}
          exit={{ x: '-100%' }}
          transition={{
            duration,
            ease: [0.32, 0.72, 0, 1], // Standard decelerate/accelerate curve for natural drawer feel
          }}
          className={`fixed top-0 bottom-0 left-0 z-50 lg:hidden flex flex-col h-full shadow-2xl select-none motion-reduce:transition-none ${className}`}
        >
          {children}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
