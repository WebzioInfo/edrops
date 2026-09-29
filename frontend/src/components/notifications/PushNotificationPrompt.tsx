import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, Sparkles, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import {
  isPushNotificationSupported,
  getBrowserNotificationPermission,
  subscribeToPushNotifications,
  syncPushSubscriptionIfGranted,
} from '../../utils/pushManager';

const DISMISS_KEY = 'edrops_push_prompt_dismissed_at';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export default function PushNotificationPrompt() {
  const { user } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isPostInstall, setIsPostInstall] = useState(false);

  useEffect(() => {
    // Only prompt authenticated users
    if (!user) return;
    if (!isPushNotificationSupported()) return;

    const permission = getBrowserNotificationPermission();

    // CASE D / CASE B: Permission is already granted
    if (permission === 'granted') {
      // Sync subscription in background without nagging popup
      syncPushSubscriptionIfGranted();
      return;
    }

    // CASE C: Permission is already denied
    if (permission === 'denied') {
      // Do not nag the user repeatedly
      return;
    }

    // Listen for PWA installation event (Section 7)
    const handleAppInstalled = () => {
      setIsPostInstall(true);
      setIsVisible(true);
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    // CASE A: Permission is default (undetermined)
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const timeSinceDismiss = Date.now() - parseInt(dismissedAt, 10);
      if (timeSinceDismiss < SEVEN_DAYS_MS) {
        return () => window.removeEventListener('appinstalled', handleAppInstalled);
      }
    }

    // Show native-styled banner with a 2.5s polite delay
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 2500);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [user]);

  const handleEnable = async () => {
    setIsSubscribing(true);
    try {
      const res = await subscribeToPushNotifications();
      if (res.success) {
        toast.custom(
          (t) => (
            <div
              className={`${
                t.visible ? 'animate-enter' : 'animate-leave'
              } max-w-md w-full bg-white shadow-lg rounded-2xl pointer-events-auto flex ring-1 ring-black ring-opacity-5 p-4 border border-emerald-100`}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Notifications Enabled</p>
                  <p className="text-xs text-slate-500">You will receive live order updates on your phone.</p>
                </div>
              </div>
            </div>
          ),
          { duration: 4000 }
        );
        setIsVisible(false);
      } else if (res.state === 'DENIED') {
        toast.error('Notifications were blocked. You can enable them anytime from browser settings.');
        setIsVisible(false);
      } else {
        setIsVisible(false);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Could not enable notifications.');
      setIsVisible(false);
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setIsVisible(false);
  };

  if (!isVisible || !user) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 260 }}
        className="fixed bottom-20 left-4 right-4 md:left-auto md:right-6 md:bottom-6 z-50 md:max-w-sm"
      >
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 p-4 sm:p-5 relative overflow-hidden backdrop-blur-xl">
          {/* Subtle brand glow accent */}
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-[#00AEEF]/10 rounded-full blur-xl pointer-events-none" />

          {/* Dismiss button */}
          <button
            onClick={handleDismiss}
            aria-label="Dismiss notification prompt"
            className="absolute top-3.5 right-3.5 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>

          <div className="flex items-start gap-3.5">
            <div className="relative shrink-0 mt-0.5">
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#2D79A8] to-[#1E5C82] flex items-center justify-center text-white shadow-md shadow-[#2D79A8]/20">
                <Bell className="h-5 w-5 animate-bounce-subtle" />
              </div>
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#33BFD0] text-white ring-2 ring-white">
                <Sparkles size={9} />
              </span>
            </div>

            <div className="flex-1 pr-4">
              <h4 className="text-sm font-bold text-[#0F172A] leading-tight">
                {isPostInstall ? 'Enable notifications' : 'Stay updated'}
              </h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {isPostInstall
                  ? 'Get order, delivery and account updates on your phone.'
                  : 'Get order and delivery updates directly on your phone.'}
              </p>

              <div className="flex items-center gap-2.5 mt-3.5">
                <button
                  type="button"
                  onClick={handleEnable}
                  disabled={isSubscribing}
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-[#2D79A8] hover:bg-[#245361] rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSubscribing ? 'Enabling...' : 'Enable Notifications'}
                </button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  disabled={isSubscribing}
                  className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100/70 rounded-xl transition-all cursor-pointer"
                >
                  Not Now
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
