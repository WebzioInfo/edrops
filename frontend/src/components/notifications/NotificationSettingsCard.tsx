import { useState, useEffect } from 'react';
import { Bell, BellOff, BellRing, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  getPushNotificationStatus,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  type PushPermissionState,
} from '../../utils/pushManager';

export default function NotificationSettingsCard() {
  const [status, setStatus] = useState<PushPermissionState>('DEFAULT');
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const checkStatus = async () => {
    try {
      const currentStatus = await getPushNotificationStatus();
      setStatus(currentStatus);
    } catch {
      setStatus('ERROR');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const handleEnable = async () => {
    setActionLoading(true);
    try {
      const res = await subscribeToPushNotifications();
      if (res.success) {
        setStatus('SUBSCRIBED');
        toast.success('Real-time notifications enabled for this device!');
      } else if (res.state === 'DENIED') {
        setStatus('DENIED');
        toast.error('Notifications are blocked in your browser settings.');
      } else {
        setStatus(res.state);
        if (res.error) toast.error(res.error);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to enable notifications');
      setStatus('ERROR');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisable = async () => {
    setActionLoading(true);
    try {
      const res = await unsubscribeFromPushNotifications();
      if (res.success) {
        setStatus('DEFAULT');
        toast.success('Push notifications disabled for this device.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to unsubscribe');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/85 shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-[#EBF5FB] text-[#2D79A8]">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#0F172A]">Phone Notifications</h3>
            <p className="text-xs text-slate-500">Get order, delivery, and account updates directly on your device</p>
          </div>
        </div>

        {loading ? (
          <RefreshCw className="h-4 w-4 animate-spin text-slate-400" />
        ) : (
          <div className="flex items-center gap-2">
            {status === 'SUBSCRIBED' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Enabled
              </span>
            ) : status === 'DENIED' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                Blocked
              </span>
            ) : status === 'NOT_SUPPORTED' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                Not Supported
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Disabled
              </span>
            )}
          </div>
        )}
      </div>

      <div className="pt-1">
        {status === 'SUBSCRIBED' && (
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-100 text-emerald-800 text-xs leading-relaxed">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-emerald-900">Notifications are active on this device</p>
                <p className="text-emerald-700 mt-0.5">
                  You will receive real-time push alerts when orders are placed, accepted, out for delivery, and completed.
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleDisable}
                disabled={actionLoading}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 border border-slate-200 hover:bg-slate-50 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
              >
                {actionLoading ? 'Updating...' : 'Disable Notifications'}
              </button>
            </div>
          </div>
        )}

        {(status === 'DEFAULT' || status === 'GRANTED') && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Stay in the loop without having to keep the app open. Real-time push alerts keep you updated even when the screen is locked.
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleEnable}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#2D79A8] hover:bg-[#245361] rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                <BellRing className="h-3.5 w-3.5" />
                {actionLoading ? 'Connecting...' : 'Enable Notifications'}
              </button>
            </div>
          </div>
        )}

        {status === 'DENIED' && (
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-rose-50/60 border border-rose-100 text-rose-800 text-xs leading-relaxed">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-900">Notifications are blocked in your browser</p>
              <p className="text-rose-700 mt-0.5">
                To receive device notifications, tap the lock/settings icon in your browser address bar and change Notification permission to "Allow".
              </p>
            </div>
          </div>
        )}

        {status === 'NOT_SUPPORTED' && (
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-xs">
            <BellOff className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
            <p>Web push notifications are not supported by this browser. Try using Chrome or Edge, or install our PWA.</p>
          </div>
        )}

        {status === 'ERROR' && (
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-amber-50/60 border border-amber-200 text-amber-800 text-xs">
            <span>Unable to verify notification status.</span>
            <button
              onClick={checkStatus}
              className="text-xs font-semibold underline hover:text-amber-900 cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
