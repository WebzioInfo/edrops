import { useState, useEffect } from 'react';
import type { BeforeInstallPromptEvent } from '../types/pwa';
import { isIOS, isStandalone as checkStandalone, trackPWAEvent } from '../utils/pwaUtils';

const DISMISSAL_KEY = 'edrops-pwa-dismissed-at';
const DISMISSAL_COOLDOWN = 7 * 24 * 60 * 60 * 1000; // 7-day cooldown before showing prompt again

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

// Setup global listener early to capture beforeinstallprompt before React mounts
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent Chrome's minibar prompt from popping up on mobile
    e.preventDefault();
    deferredPrompt = e;
    trackPWAEvent('Install prompt shown', { type: 'beforeinstallprompt' });
    listeners.forEach((l) => l());
  });

  window.addEventListener('appinstalled', () => {
    trackPWAEvent('Installation accepted', { trigger: 'native_complete' });
    deferredPrompt = null;
    listeners.forEach((l) => l());
  });
}

export const usePWAInstall = () => {
  const [isPromptReady, setIsPromptReady] = useState(!!deferredPrompt);
  const [isStandalone, setIsStandaloneState] = useState(checkStandalone());
  const [isDismissed, setIsDismissed] = useState(false);

  // An app is installed if it's currently running in standalone display mode
  const isInstalled = isStandalone;

  useEffect(() => {
    // Check if user previously dismissed the prompt within the cooldown period
    const dismissedAt = localStorage.getItem(DISMISSAL_KEY);
    if (dismissedAt) {
      const timeElapsed = Date.now() - parseInt(dismissedAt, 10);
      if (timeElapsed < DISMISSAL_COOLDOWN) {
        setIsDismissed(true);
      } else {
        localStorage.removeItem(DISMISSAL_KEY);
      }
    }

    // Subscribe to updates when deferredPrompt is captured or cleared
    const handlePromptChange = () => {
      setIsPromptReady(!!deferredPrompt);
    };

    listeners.add(handlePromptChange);

    // Initial check of standalone mode
    if (checkStandalone()) {
      trackPWAEvent('App launched in standalone mode');
    }

    return () => {
      listeners.delete(handlePromptChange);
    };
  }, []);

  // Listen to media query changes to detect standalone display modes dynamically
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      setIsStandaloneState(e.matches);
      if (e.matches) {
        trackPWAEvent('App launched in standalone mode', { trigger: 'media_change' });
      }
    };

    mediaQuery.addEventListener('change', handleMediaChange);
    return () => mediaQuery.removeEventListener('change', handleMediaChange);
  }, []);

  /**
   * Triggers the native browser install dialog.
   */
  const showInstallPrompt = async (): Promise<'accepted' | 'dismissed' | 'unsupported'> => {
    if (!deferredPrompt) {
      trackPWAEvent('Install prompt failed', { reason: 'prompt_not_available' });
      return 'unsupported';
    }

    trackPWAEvent('Install button clicked');
    
    // Trigger the prompt
    deferredPrompt.prompt();

    // Await choice
    const choiceResult = await deferredPrompt.userChoice;
    
    if (choiceResult.outcome === 'accepted') {
      trackPWAEvent('Installation accepted');
      deferredPrompt = null;
      setIsPromptReady(false);
      listeners.forEach((l) => l());
    } else {
      trackPWAEvent('Installation dismissed');
    }

    return choiceResult.outcome;
  };

  /**
   * Dismisses the prompt and stores timestamp in localStorage.
   */
  const dismissPrompt = () => {
    localStorage.setItem(DISMISSAL_KEY, Date.now().toString());
    setIsDismissed(true);
    trackPWAEvent('Installation dismissed', { trigger: 'user_dismiss' });
  };

  // Installable condition:
  // (beforeinstallprompt is ready OR is iOS Safari) AND not already installed AND not dismissed
  const ios = isIOS();
  const installable = (isPromptReady || ios) && !isInstalled && !isDismissed;

  return {
    isInstallable: installable,
    isInstalled,
    isIOS: ios,
    isStandalone,
    isDismissed,
    showInstallPrompt,
    dismissPrompt,
  };
};
export default usePWAInstall;
