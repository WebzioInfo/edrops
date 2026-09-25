import React from 'react';
import { toast as hotToast, type ToastOptions } from 'react-hot-toast';

export interface EdropsToastOptions extends ToastOptions {
  description?: string;
  variant?: 'success' | 'error' | 'info';
}

export type ToastInput = 
  | string 
  | { title: string; description?: string }
  | React.ReactElement
  | ((t: any) => React.ReactElement);

// Registry for deduplicating identical toasts within 1500ms
const recentToasts = new Map<string, number>();

function extractKey(message: any, options?: EdropsToastOptions): string {
  if (options?.id) return options.id;
  if (typeof message === 'string') {
    const desc = options?.description || '';
    return `${message}::${desc}`.trim();
  }
  if (typeof message === 'object' && message !== null && 'title' in message) {
    return `${message.title}::${message.description || ''}`.trim();
  }
  return '';
}

function shouldThrottle(key: string, cooldownMs = 1500): boolean {
  if (!key) return false;
  const now = Date.now();
  const lastTime = recentToasts.get(key);
  if (lastTime && now - lastTime < cooldownMs) {
    return true; // Duplicate call detected within cooldown
  }
  recentToasts.set(key, now);
  setTimeout(() => {
    if (recentToasts.get(key) === now) {
      recentToasts.delete(key);
    }
  }, cooldownMs * 2);
  return false;
}

function formatMessage(message: any, options?: EdropsToastOptions): any {
  if (React.isValidElement(message) || typeof message === 'function') {
    return message;
  }
  const title = typeof message === 'object' && message !== null ? message.title : String(message ?? '');
  const description = options?.description || (typeof message === 'object' && message !== null ? message.description : undefined);

  if (description) {
    return React.createElement(
      'div',
      { className: 'flex flex-col min-w-0' },
      React.createElement('span', { className: 'font-medium text-white leading-snug' }, title),
      React.createElement('span', { className: 'text-xs text-white/85 font-normal mt-0.5 leading-relaxed' }, description)
    );
  }

  return title;
}

// Preserve original hotToast references
const origHotToast = hotToast;
const origHotSuccess = hotToast.success;
const origHotError = hotToast.error;

// Monkey-patch hotToast directly so calls project-wide (even from 'react-hot-toast')
// go through a SINGLE layer of throttling and formatting with zero dropped calls.
hotToast.success = (message: any, options?: ToastOptions) => {
  const key = extractKey(message, options as EdropsToastOptions);
  if (key && shouldThrottle(`success:${key}`)) return key;
  return origHotSuccess(formatMessage(message, options as EdropsToastOptions), {
    id: options?.id,
    duration: 3000,
    ...options,
  });
};

hotToast.error = (message: any, options?: ToastOptions) => {
  const key = extractKey(message, options as EdropsToastOptions);
  if (key && shouldThrottle(`error:${key}`)) return key;
  return origHotError(formatMessage(message, options as EdropsToastOptions), {
    id: options?.id,
    duration: 5500,
    ...options,
  });
};

// Global Toast Controller
export const showToast = (message: ToastInput, options?: EdropsToastOptions) => {
  const key = extractKey(message, options);
  if (key && shouldThrottle(`blank:${key}`)) return key;
  return origHotToast(formatMessage(message, options), {
    id: options?.id,
    ...options,
  });
};

showToast.success = (message: ToastInput, options?: EdropsToastOptions) => {
  return hotToast.success(message as any, options);
};

showToast.error = (message: ToastInput, options?: EdropsToastOptions) => {
  return hotToast.error(message as any, options);
};

// Warning mapped to info per requirements (no warning toast type)
showToast.warning = (message: ToastInput, options?: EdropsToastOptions) => {
  return showToast.info(message, options);
};

showToast.info = (message: ToastInput, options?: EdropsToastOptions) => {
  const key = extractKey(message, options);
  if (key && shouldThrottle(`info:${key}`)) return key;
  return origHotToast(formatMessage(message, options), {
    id: options?.id,
    duration: 3500,
    ...options,
  });
};

showToast.loading = (message: ToastInput, options?: EdropsToastOptions) => {
  return origHotToast.loading(formatMessage(message, options), {
    id: options?.id,
    ...options,
  });
};

showToast.dismiss = (toastId?: string) => origHotToast.dismiss(toastId);
showToast.remove = (toastId?: string) => origHotToast.remove(toastId);
showToast.custom = (render: (t: any) => React.ReactElement, options?: EdropsToastOptions) => {
  return origHotToast.custom(render, options);
};

(hotToast as any).warning = showToast.warning;
(hotToast as any).info = showToast.info;

if (typeof window !== 'undefined') {
  (window as any).toast = showToast;
  (window as any).showToast = showToast;
}

export const toast = showToast;
export default showToast;
