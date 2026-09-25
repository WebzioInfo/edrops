import React, { createContext, useState, useCallback, type ReactNode } from 'react';
import { DialogContainer } from '../components/dialogs/DialogContainer';
import { showToast as globalToast } from '../utils/toast';

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
  title?: string;
  description?: string;
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
  };
}

export const DialogContext = createContext<DialogContextType | undefined>(undefined);

export const DialogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [dialog, setDialog] = useState<DialogState | null>(null);

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

  const toast = {
    show: (options: ToastOptions) => {
      const type = options.type || 'info';
      const duration = options.duration;
      const desc = options.description;
      if (type === 'success') globalToast.success(options.message, { duration, description: desc });
      else if (type === 'error') globalToast.error(options.message, { duration, description: desc });
      else if (type === 'warning') globalToast.warning(options.message, { duration, description: desc });
      else globalToast.info(options.message, { duration, description: desc });
    },
    success: (msg: string, duration?: number) => globalToast.success(msg, { duration }),
    error: (msg: string, duration?: number) => globalToast.error(msg, { duration }),
    warning: (msg: string, duration?: number) => globalToast.warning(msg, { duration }),
    info: (msg: string, duration?: number) => globalToast.info(msg, { duration }),
  };

  const handleClose = useCallback((value: any) => {
    if (dialog) {
      dialog.resolve(value);
      setDialog(null);
    }
  }, [dialog]);

  return (
    <DialogContext.Provider value={{ confirm, alert, prompt, toast }}>
      {children}
      <DialogContainer dialog={dialog} onClose={handleClose} />
    </DialogContext.Provider>
  );
};
