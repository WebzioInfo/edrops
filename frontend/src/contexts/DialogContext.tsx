import React, { createContext, useState, useCallback, type ReactNode } from 'react';
import { DialogContainer } from '../components/dialogs/DialogContainer';

export type DialogVariant = 'primary' | 'danger' | 'warning' | 'success' | 'info';

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: DialogVariant;
}

export interface PromptOptions extends ConfirmOptions {
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
}

export interface AlertOptions {
  title: string;
  description?: string;
  confirmText?: string;
  variant?: DialogVariant;
}

export interface ToastOptions {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

export interface Toast extends ToastOptions {
  id: string;
}

export interface DialogState {
  type: 'confirm' | 'alert' | 'prompt' | null;
  options: any;
  resolve: (value: any) => void;
}

interface DialogContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  alert: (options: AlertOptions) => Promise<void>;
  prompt: (options: PromptOptions) => Promise<string | null>;
  toast: {
    success: (msg: string, duration?: number) => void;
    error: (msg: string, duration?: number) => void;
    warning: (msg: string, duration?: number) => void;
    info: (msg: string, duration?: number) => void;
    show: (options: ToastOptions) => void;
  }
}

export const DialogContext = createContext<DialogContextType | undefined>(undefined);

export const DialogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setDialog({ type: 'confirm', options, resolve });
    });
  }, []);

  const alert = useCallback((options: AlertOptions) => {
    return new Promise<void>((resolve) => {
      setDialog({ type: 'alert', options, resolve });
    });
  }, []);

  const prompt = useCallback((options: PromptOptions) => {
    return new Promise<string | null>((resolve) => {
      setDialog({ type: 'prompt', options, resolve });
    });
  }, []);

  const showToast = useCallback((options: ToastOptions) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...options, id }]);
    
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, options.duration || 3000);
  }, []);

  const toast = {
    show: showToast,
    success: (msg: string, duration?: number) => showToast({ message: msg, type: 'success', duration }),
    error: (msg: string, duration?: number) => showToast({ message: msg, type: 'error', duration }),
    warning: (msg: string, duration?: number) => showToast({ message: msg, type: 'warning', duration }),
    info: (msg: string, duration?: number) => showToast({ message: msg, type: 'info', duration }),
  };

  const handleClose = useCallback((value: any) => {
    if (dialog) {
      dialog.resolve(value);
      setDialog(null);
    }
  }, [dialog]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <DialogContext.Provider value={{ confirm, alert, prompt, toast }}>
      {children}
      <DialogContainer dialog={dialog} onClose={handleClose} toasts={toasts} removeToast={removeToast} />
    </DialogContext.Provider>
  );
};
