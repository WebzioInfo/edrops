import React, { useEffect } from 'react';
import { showToast } from '../utils/toast';

export interface ToastProps {
  message: string;
  type?: 'info' | 'success' | 'warning' | 'auth';
  duration?: number;
  isOpen?: boolean;
  onClose?: () => void;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'auth',
  duration = 3000,
  isOpen = true,
  onClose,
}) => {
  useEffect(() => {
    if (isOpen && message) {
      if (type === 'success') {
        showToast.success(message, { duration });
      } else if (type === 'warning') {
        showToast.warning(message, { duration });
      } else {
        showToast.info(message, { duration });
      }
      onClose?.();
    }
  }, [isOpen, message, type, duration, onClose]);

  return null;
};

export default Toast;
