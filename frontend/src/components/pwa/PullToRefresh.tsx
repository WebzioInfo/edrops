import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EdropsLogo } from '../Logo';

export interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh: () => Promise<any> | void;
  disabled?: boolean;
  threshold?: number;
  maxPull?: number;
  className?: string;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  children,
  onRefresh,
  disabled = false,
  threshold = 75,
  maxPull = 115,
  className = '',
}) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const isDraggingRef = useRef(false);
  const isRefreshingRef = useRef(false);

  useEffect(() => {
    isRefreshingRef.current = isRefreshing;
  }, [isRefreshing]);

  const getScrollTop = useCallback((): number => {
    if (typeof window === 'undefined') return 0;
    const containerScroll = containerRef.current ? containerRef.current.scrollTop : 0;
    const windowScroll = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    return Math.max(containerScroll, windowScroll);
  }, []);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (disabled || isRefreshingRef.current) return;
      if (getScrollTop() <= 0) {
        startYRef.current = e.touches[0].clientY;
        isDraggingRef.current = true;
      }
    },
    [disabled, getScrollTop]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isDraggingRef.current || disabled || isRefreshingRef.current) return;

      const currentY = e.touches[0].clientY;
      const rawPull = currentY - startYRef.current;

      if (rawPull > 0 && getScrollTop() <= 0) {
        if (e.cancelable) {
          e.preventDefault();
        }

        // Bidirectional responsive travel distance with damping curve (maxPull ~115px)
        const visualPull = Math.max(0, Math.min(maxPull, rawPull * 0.55));
        setPullDistance(visualPull);
        setIsPulling(true);
      } else if (rawPull <= 0) {
        setPullDistance(0);
        setIsPulling(false);
      }
    },
    [disabled, maxPull, getScrollTop]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!isDraggingRef.current || disabled || isRefreshingRef.current) {
      isDraggingRef.current = false;
      return;
    }

    isDraggingRef.current = false;
    setIsPulling(false);

    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      setPullDistance(threshold);

      try {
        const startTime = Date.now();
        await Promise.resolve(onRefresh());
        const elapsed = Date.now() - startTime;
        if (elapsed < 650) {
          await new Promise((resolve) => setTimeout(resolve, 650 - elapsed));
        }
      } catch (err) {
        console.error('Pull to refresh failed', err);
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [disabled, pullDistance, threshold, onRefresh]);

  useEffect(() => {
    const el = containerRef.current || window;

    const onTouchStart = (e: any) => handleTouchStart(e);
    const onTouchMove = (e: any) => handleTouchMove(e);
    const onTouchEnd = () => handleTouchEnd();
    const onTouchCancel = () => handleTouchEnd();

    el.addEventListener('touchstart', onTouchStart as any, { passive: true });
    el.addEventListener('touchmove', onTouchMove as any, { passive: false });
    el.addEventListener('touchend', onTouchEnd as any, { passive: true });
    el.addEventListener('touchcancel', onTouchCancel as any, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart as any);
      el.removeEventListener('touchmove', onTouchMove as any);
      el.removeEventListener('touchend', onTouchEnd as any);
      el.removeEventListener('touchcancel', onTouchCancel as any);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  // Real-time bidirectional rotation bound directly to pull distance (0° to 360°)
  const rotation = Math.min(360, (pullDistance / threshold) * 360);
  const opacity = Math.min(1, Math.max(0.2, pullDistance / (threshold * 0.6)));
  const scale = Math.min(1, Math.max(0.65, 0.65 + (pullDistance / threshold) * 0.35));

  return (
    <div ref={containerRef} className={`relative w-full min-h-full ${className}`}>
      {/* Pull Indicator Pill */}
      <AnimatePresence>
        {(pullDistance > 0 || isRefreshing) && (
          <motion.div
            initial={{ opacity: 0, y: -25 }}
            animate={{
              opacity: isRefreshing ? 1 : opacity,
              y: isRefreshing ? 55 : pullDistance,
              transition: isPulling ? { duration: 0 } : { type: 'spring', stiffness: 450, damping: 32 },
            }}
            exit={{ opacity: 0, y: -25, transition: { duration: 0.2 } }}
            className="fixed top-0 inset-x-0 z-50 flex justify-center items-center pointer-events-none"
            style={{ height: '0px' }}
          >
            <div
              className="w-12 h-12 rounded-full bg-white/95 backdrop-blur-md shadow-[0_8px_25px_rgba(0,136,204,0.3)] border border-sky-100 flex items-center justify-center transition-transform duration-75"
              style={{
                transform: `scale(${scale})`,
              }}
            >
              <div
                className={`flex items-center justify-center ${isRefreshing ? 'animate-spin' : ''}`}
                style={{
                  transform: isRefreshing ? undefined : `rotate(${rotation}deg)`,
                  transition: isPulling ? 'none' : 'transform 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
                }}
              >
                <EdropsLogo variant="icon" size={26} className="h-6.5 w-6.5 pointer-events-none" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content visual travel */}
      <motion.div
        animate={{
          y: isRefreshing ? 45 : isPulling ? pullDistance * 0.38 : 0,
          transition: isPulling ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 30 },
        }}
        className="w-full min-h-full flex flex-col flex-1"
      >
        {children}
      </motion.div>
    </div>
  );
};

export default PullToRefresh;
