import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { EdropsLogo } from '../Logo';
import { useIsPullGestureActive } from '../pwa/PullToRefresh';

// Global subscriber registry for multi-source loading coordination
let globalLoaders = new Set<string>();
let listeners = new Set<() => void>();

function registerLoader(id: string) {
  globalLoaders.add(id);
  listeners.forEach((fn) => fn());
}

function unregisterLoader(id: string) {
  globalLoaders.delete(id);
  listeners.forEach((fn) => fn());
}

function isGloballyLoading(): boolean {
  return globalLoaders.size > 0;
}

/**
 * Hook to signal to the global centered loader that an async operation / page is loading.
 * Multiple components can call this simultaneously; only one synchronized indicator is rendered.
 */
export function usePageLoader(isLoading: boolean = true) {
  const idRef = useRef<string | null>(null);

  if (!idRef.current) {
    idRef.current = 'loader_' + Math.random().toString(36).substring(2, 9);
  }

  useEffect(() => {
    const id = idRef.current!;
    if (isLoading) {
      registerLoader(id);
    } else {
      unregisterLoader(id);
    }
    return () => {
      unregisterLoader(id);
    };
  }, [isLoading]);
}

// Backward-compatible alias
export const useTopPageLoader = usePageLoader;

export interface CenteredPageLoaderProps {
  isLoading?: boolean;
}

/**
 * Standalone centered loader component.
 */
export const CenteredPageLoader: React.FC<CenteredPageLoaderProps> = ({ isLoading = true }) => {
  usePageLoader(isLoading);
  return null;
};

// Backward-compatible alias
export const TopSwipeLoader = CenteredPageLoader;

/**
 * Global Centered Page Loader
 *
 * Distinct from PullToRefresh:
 * - Triggered by route transitions (forward/back navigation) and any async data fetches.
 * - Displays horizontally and vertically centered on the screen (not top-anchored).
 * - Uses the spinning eDrops icon in a glassmorphic circular pill.
 * - Suppressed automatically if a manual pull-to-refresh gesture is active so they never conflict.
 */
export const GlobalCenteredPageLoader: React.FC = () => {
  const location = useLocation();
  const [routeLoading, setRouteLoading] = useState(false);
  const [, setTick] = useState(0);
  const isInitialMount = useRef(true);
  const isPullGestureActive = useIsPullGestureActive();

  // Subscribe to page loader changes
  useEffect(() => {
    const handleChange = () => setTick((t) => t + 1);
    listeners.add(handleChange);
    return () => {
      listeners.delete(handleChange);
    };
  }, []);

  // Trigger centered loader on every route navigation (forward or back navigation)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    setRouteLoading(true);
    const timer = setTimeout(() => {
      setRouteLoading(false);
    }, 450);

    return () => clearTimeout(timer);
  }, [location.pathname, location.search]);

  // Cleanly isolate: if manual pull-to-refresh is active, do not show the centered loader
  const active = !isPullGestureActive && (routeLoading || isGloballyLoading());

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {active && (
        <div
          role="status"
          aria-live="polite"
          aria-label="Loading..."
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 99998,
            pointerEvents: 'none',
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{
              opacity: 1,
              scale: 1,
              transition: { type: 'spring', stiffness: 450, damping: 30 },
            }}
            exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2, ease: 'easeInOut' } }}
            className="flex flex-col justify-center items-center pointer-events-none"
          >
            <div className="w-14 h-14 rounded-full bg-white/95 backdrop-blur-md shadow-[0_12px_36px_rgba(0,136,204,0.28)] border border-sky-100 flex items-center justify-center">
              <div className="flex items-center justify-center animate-spin">
                <EdropsLogo variant="icon" size={28} className="h-7 w-7 pointer-events-none" />
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

// Backward-compatible alias
export const GlobalTopSwipeLoader = GlobalCenteredPageLoader;

export default CenteredPageLoader;
