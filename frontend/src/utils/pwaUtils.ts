/**
 * Detects if the current user agent is iOS (iPhone/iPad/iPod).
 */
export const isIOS = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  // Standard iPhone/iPad detection
  const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
  
  // iPadOS 13+ detection (displays as MacIntel but supports touch)
  const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  
  return isIOSDevice || isIPadOS;
};

/**
 * Detects if the app is currently running in standalone (PWA) mode.
 */
export const isStandalone = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true || // iOS Safari custom field
    document.referrer.includes('android-app://') // Android Trusted Web Activities (TWA)
  );
};

/**
 * Detects the current browser name to customize user guides and installation behavior.
 */
export const getBrowserName = (): 'Chrome' | 'Edge' | 'Safari' | 'Firefox' | 'Samsung Internet' | 'Other' => {
  if (typeof window === 'undefined') return 'Other';
  
  const ua = navigator.userAgent;
  
  if (/samsungbrowser/i.test(ua)) return 'Samsung Internet';
  if (/edg/i.test(ua)) return 'Edge';
  if (/chrome|crios/i.test(ua)) return 'Chrome';
  if (/firefox|fxios/i.test(ua)) return 'Firefox';
  if (/safari/i.test(ua) && !/chrome|crios|edg|firefox/i.test(ua)) return 'Safari';
  
  return 'Other';
};

/**
 * Dispatches PWA event details for logging and analytical integration.
 */
export const trackPWAEvent = (eventName: string, details?: any) => {
  if (typeof window === 'undefined') return;
  
  // High contrast custom log styling for developer visibility
  console.log(
    `%c[PWA Analytics] ${eventName}`,
    'color: #2D79A8; font-weight: bold; background: #BBDFF2; padding: 2px 6px; border-radius: 4px; border: 1px solid #2D79A8;',
    details ? JSON.stringify(details) : ''
  );

  // Dispatch custom browser event for integration with third-party tracking (e.g. Google Analytics)
  const pwaEvent = new CustomEvent('pwa-analytics', {
    detail: {
      event: eventName,
      data: details || null,
      timestamp: new Date().toISOString()
    }
  });
  window.dispatchEvent(pwaEvent);
};
