import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Info, CheckCircle2, AlertTriangle, X } from 'lucide-react';

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
  const [visible, setVisible] = useState(isOpen);

  useEffect(() => {
    setVisible(isOpen);
  }, [isOpen]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      setVisible(false);
      onClose?.();
    }, duration);
    return () => clearTimeout(timer);
  }, [visible, duration, onClose]);

  if (typeof document === 'undefined') return null;

  const Icon =
    type === 'auth'
      ? Lock
      : type === 'success'
      ? CheckCircle2
      : type === 'warning'
      ? AlertTriangle
      : Info;

  return createPortal(
    <AnimatePresence>
      {visible && (
        <div
          style={{
            position: 'fixed',
            top: '16px',
            left: 0,
            right: 0,
            width: '100vw',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            zIndex: 999999,
            pointerEvents: 'none',
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.95 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
            }}
            exit={{
              opacity: 0,
              y: -20,
              scale: 0.95,
              transition: { duration: 0.25, ease: [0.4, 0, 1, 1] },
            }}
            className="pointer-events-auto mx-4 max-w-md w-auto flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-white/95 backdrop-blur-md border border-sky-100 shadow-[0_12px_36px_rgba(0,136,204,0.2)] text-slate-800 text-xs sm:text-sm font-semibold"
          >
            <div className="w-7 h-7 rounded-xl bg-sky-50 text-[#0088CC] flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4" />
            </div>
            <span className="flex-1 leading-snug">{message}</span>
            <button
              onClick={() => {
                setVisible(false);
                onClose?.();
              }}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors ml-1 cursor-pointer"
              aria-label="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default Toast;
