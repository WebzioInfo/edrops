import React, { useState, useRef, useEffect, useCallback, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { EdropsLogo } from '../Logo';

interface PullToRefreshContextType {
  registerHandler: (handler: () => Promise<any> | void) => () => void;
}

const PullToRefreshContext = createContext<PullToRefreshContextType | null>(null);

/**
 * Hook to register a custom refresh handler on any page or component.
 * When pull-to-refresh is triggered, this handler will be executed.
 */
export function useRegisterRefreshHandler(handler?: () => Promise<any> | void) {
  const context = useContext(PullToRefreshContext);
  useEffect(() => {
    if (!context || !handler) return;
    return context.registerHandler(handler);
  }, [context, handler]);
}

let isPullGestureActive = false;
const pullActiveListeners = new Set<(active: boolean) => void>();

export function setPullGestureActive(active: boolean) {
  if (isPullGestureActive !== active) {
    isPullGestureActive = active;
    pullActiveListeners.forEach((fn) => fn(active));
  }
}

/**
 * Hook to check if manual pull-to-refresh gesture or refresh is currently active.
 */
export function useIsPullGestureActive(): boolean {
  const [active, setActive] = useState(isPullGestureActive);
  useEffect(() => {
    pullActiveListeners.add(setActive);
    return () => {
      pullActiveListeners.delete(setActive);
    };
  }, []);
  return active;
}

export interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh?: () => Promise<any> | void;
  disabled?: boolean;
  threshold?: number;
  maxPull?: number;
  className?: string;
  isRoot?: boolean;
}

/**
 * Helper to find the scrollable ancestor element (e.g. <main overflow-y-auto> in Admin/Delivery Partner,
 * or window for customer pages).
 */
function getScrollParent(element: HTMLElement | null): HTMLElement | Window {
  let current = element;
  while (current && current !== document.body && current !== document.documentElement) {
    const style = window.getComputedStyle(current);
    const overflowY = style.overflowY;
    if ((overflowY === 'auto' || overflowY === 'scroll') && current.scrollHeight > current.clientHeight) {
      return current;
    }
    current = current.parentElement;
  }
  return window;
}

function getScrollTop(target: HTMLElement | Window | null): number {
  if (!target || typeof window === 'undefined') return 0;
  if (target instanceof HTMLElement) {
    return target.scrollTop;
  }
  return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  children,
  onRefresh,
  disabled = false,
  threshold = 75,
  maxPull = 115,
  className = '',
  isRoot = false,
}) => {
  const parentContext = useContext(PullToRefreshContext);

  // If this is a nested PullToRefresh (e.g. on Shop page) and a root provider exists,
  // register the onRefresh callback with the root provider and avoid duplicate listeners.
  if (parentContext && !isRoot) {
    return <NestedPullToRefresh onRefresh={onRefresh}>{children}</NestedPullToRefresh>;
  }

  return (
    <RootPullToRefresh
      onRefresh={onRefresh}
      disabled={disabled}
      threshold={threshold}
      maxPull={maxPull}
      className={className}
    >
      {children}
    </RootPullToRefresh>
  );
};

const NestedPullToRefresh: React.FC<{ children: React.ReactNode; onRefresh?: () => Promise<any> | void }> = ({
  children,
  onRefresh,
}) => {
  useRegisterRefreshHandler(onRefresh);
  return <>{children}</>;
};

const RootPullToRefresh: React.FC<PullToRefreshProps> = ({
  children,
  onRefresh,
  disabled = false,
  threshold = 75,
  maxPull = 115,
  className = '',
}) => {
  const queryClient = useQueryClient();
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const isDraggingRef = useRef(false);
  const isRefreshingRef = useRef(false);
  const activeScrollTargetRef = useRef<HTMLElement | Window | null>(null);

  // Registry for page-specific handlers
  const registeredHandlersRef = useRef<Set<() => Promise<any> | void>>(new Set());

  const registerHandler = useCallback((handler: () => Promise<any> | void) => {
    registeredHandlersRef.current.add(handler);
    return () => {
      registeredHandlersRef.current.delete(handler);
    };
  }, []);

  useEffect(() => {
    if (onRefresh) {
      return registerHandler(onRefresh);
    }
  }, [onRefresh, registerHandler]);

  useEffect(() => {
    isRefreshingRef.current = isRefreshing;
  }, [isRefreshing]);

  useEffect(() => {
    setPullGestureActive(pullDistance > 0 || isRefreshing);
    return () => {
      setPullGestureActive(false);
    };
  }, [pullDistance, isRefreshing]);

  // Handle Touch Gesture
  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (disabled || isRefreshingRef.current) return;
      const target = e.touches[0].target as HTMLElement;
      activeScrollTargetRef.current = getScrollParent(target);

      if (getScrollTop(activeScrollTargetRef.current) <= 0) {
        startYRef.current = e.touches[0].clientY;
        isDraggingRef.current = true;
      }
    },
    [disabled]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isDraggingRef.current || disabled || isRefreshingRef.current) return;

      const currentY = e.touches[0].clientY;
      const rawPull = currentY - startYRef.current;

      if (rawPull > 0 && getScrollTop(activeScrollTargetRef.current) <= 0) {
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
    [disabled, maxPull]
  );

  // Handle Mouse Gesture (for desktop testing)
  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      if (disabled || isRefreshingRef.current) return;
      if (e.button !== 0) return; // Only primary button
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(target.tagName) || target.closest('button, a')) {
        return;
      }

      activeScrollTargetRef.current = getScrollParent(target);
      if (getScrollTop(activeScrollTargetRef.current) <= 0 && e.clientY < 200) {
        startYRef.current = e.clientY;
        isDraggingRef.current = true;
      }
    },
    [disabled]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDraggingRef.current || disabled || isRefreshingRef.current) return;

      const currentY = e.clientY;
      const rawPull = currentY - startYRef.current;

      if (rawPull > 0 && getScrollTop(activeScrollTargetRef.current) <= 0) {
        const visualPull = Math.max(0, Math.min(maxPull, rawPull * 0.55));
        setPullDistance(visualPull);
        setIsPulling(true);
      } else if (rawPull <= 0) {
        setPullDistance(0);
        setIsPulling(false);
      }
    },
    [disabled, maxPull]
  );

  // Handle Gesture Release
  const handleGestureEnd = useCallback(async () => {
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

        // 1. Run all registered page refresh handlers
        const handlerPromises = Array.from(registeredHandlersRef.current).map((fn) => {
          try {
            return Promise.resolve(fn());
          } catch {
            return Promise.resolve();
          }
        });

        // 2. Refetch active React Query queries for the current view
        const queryPromise = queryClient.refetchQueries({ type: 'active' });

        // 3. Dispatch global custom event
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('edrops:refresh'));
        }

        await Promise.allSettled([...handlerPromises, queryPromise]);

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
  }, [disabled, pullDistance, threshold, queryClient]);

  useEffect(() => {
    const el = window;

    const onTouchStart = (e: any) => handleTouchStart(e);
    const onTouchMove = (e: any) => handleTouchMove(e);
    const onTouchEnd = () => handleGestureEnd();
    const onTouchCancel = () => handleGestureEnd();

    const onMouseDown = (e: any) => handleMouseDown(e);
    const onMouseMove = (e: any) => handleMouseMove(e);
    const onMouseUp = () => handleGestureEnd();

    el.addEventListener('touchstart', onTouchStart as any, { passive: true });
    el.addEventListener('touchmove', onTouchMove as any, { passive: false });
    el.addEventListener('touchend', onTouchEnd as any, { passive: true });
    el.addEventListener('touchcancel', onTouchCancel as any, { passive: true });

    el.addEventListener('mousedown', onMouseDown as any);
    el.addEventListener('mousemove', onMouseMove as any);
    el.addEventListener('mouseup', onMouseUp as any);

    return () => {
      el.removeEventListener('touchstart', onTouchStart as any);
      el.removeEventListener('touchmove', onTouchMove as any);
      el.removeEventListener('touchend', onTouchEnd as any);
      el.removeEventListener('touchcancel', onTouchCancel as any);

      el.removeEventListener('mousedown', onMouseDown as any);
      el.removeEventListener('mousemove', onMouseMove as any);
      el.removeEventListener('mouseup', onMouseUp as any);
    };
  }, [handleTouchStart, handleTouchMove, handleMouseDown, handleMouseMove, handleGestureEnd]);

  // Real-time bidirectional rotation bound directly to pull distance (0° to 360°)
  const rotation = Math.min(360, (pullDistance / threshold) * 360);
  const opacity = Math.min(1, Math.max(0.2, pullDistance / (threshold * 0.6)));
  const scale = Math.min(1, Math.max(0.65, 0.65 + (pullDistance / threshold) * 0.35));

  // Portal indicator into document.body to break free of any stacking contexts (header/topbar)
  const indicatorPortal =
    typeof document !== 'undefined'
      ? createPortal(
          <AnimatePresence>
            {(pullDistance > 0 || isRefreshing) && (
              <div
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  width: '100vw',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'flex-start',
                  zIndex: 99999,
                  pointerEvents: 'none',
                }}
              >
                <motion.div
                  initial={{ opacity: 0, y: -30 }}
                  animate={{
                    opacity: isRefreshing ? 1 : opacity,
                    y: isRefreshing ? 60 : Math.max(pullDistance - 30, 8),
                    transition: isPulling ? { duration: 0 } : { type: 'spring', stiffness: 450, damping: 32 },
                  }}
                  exit={{ opacity: 0, y: -30, transition: { duration: 0.2 } }}
                  className="flex justify-center items-center pointer-events-none"
                >
                  <div
                    className="w-12 h-12 rounded-full bg-white/95 backdrop-blur-md shadow-[0_10px_30px_rgba(0,136,204,0.35)] border border-sky-100 flex items-center justify-center transition-transform duration-75 mt-2"
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
              </div>
            )}
          </AnimatePresence>,
          document.body
        )
      : null;

  return (
    <PullToRefreshContext.Provider value={{ registerHandler }}>
      <div ref={containerRef} className={`relative w-full min-h-full ${className}`}>
        {indicatorPortal}

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
    </PullToRefreshContext.Provider>
  );
};

export default PullToRefresh;
