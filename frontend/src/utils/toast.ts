import { toast as hotToast, type ToastOptions } from 'react-hot-toast';

// Debounce map for identical toast notifications within 1.5s window
const recentToasts = new Map<string, number>();

function shouldThrottle(key: string, cooldownMs = 1500): boolean {
  if (!key) return false;
  const now = Date.now();
  const lastTime = recentToasts.get(key);
  if (lastTime && now - lastTime < cooldownMs) {
    return true; // Throttle duplicate toast
  }
  recentToasts.set(key, now);
  setTimeout(() => recentToasts.delete(key), cooldownMs * 2);
  return false;
}

const baseToast = (message: string | ((t: any) => React.ReactElement), options?: ToastOptions) => {
  const key = options?.id || (typeof message === 'string' ? `default:${message}` : '');
  if (key && shouldThrottle(key)) return key;
  return hotToast(message as any, { id: key || undefined, ...options });
};

baseToast.success = (message: string | ((t: any) => React.ReactElement), options?: ToastOptions) => {
  const key = options?.id || (typeof message === 'string' ? `success:${message}` : '');
  if (key && shouldThrottle(key)) return key;
  return hotToast.success(message as any, { id: key || undefined, ...options });
};

baseToast.error = (message: string | ((t: any) => React.ReactElement), options?: ToastOptions) => {
  const key = options?.id || (typeof message === 'string' ? `error:${message}` : '');
  if (key && shouldThrottle(key)) return key;
  return hotToast.error(message as any, { id: key || undefined, ...options });
};

baseToast.info = (message: string | ((t: any) => React.ReactElement), options?: ToastOptions) => {
  const key = options?.id || (typeof message === 'string' ? `info:${message}` : '');
  if (key && shouldThrottle(key)) return key;
  return hotToast(message as any, { id: key || undefined, ...options });
};

baseToast.custom = (render: (t: any) => React.ReactElement, options?: ToastOptions) => {
  const key = options?.id || '';
  if (key && shouldThrottle(key)) return key;
  return hotToast.custom(render, options);
};

baseToast.dismiss = (toastId?: string) => hotToast.dismiss(toastId);

export const showToast = baseToast;
export const toast = baseToast;
export default showToast;
