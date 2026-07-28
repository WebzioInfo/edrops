import React from 'react';
import type { Toast } from '../../contexts/DialogContext';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

interface ToastContainerProps {
  toasts: Toast[];
  removeToast: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed bottom-0 right-0 z-[100] p-4 sm:p-6 flex flex-col gap-3 pointer-events-none max-w-sm w-full">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
      ))}
    </div>
  );
};

interface ToastItemProps {
  toast: Toast;
  onRemove: () => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onRemove }) => {
  const IconComponent = () => {
    switch (toast.type) {
      case 'success': return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'error': return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'warning': return <AlertCircle className="w-5 h-5 text-orange-500" />;
      case 'info':
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getBorderColor = () => {
    switch (toast.type) {
      case 'success': return 'border-green-500';
      case 'error': return 'border-red-500';
      case 'warning': return 'border-orange-500';
      case 'info':
      default:
        return 'border-blue-500';
    }
  };

  return (
    <div className={`pointer-events-auto flex items-start p-4 bg-white rounded-xl shadow-lg border-l-4 ${getBorderColor()} animate-in slide-in-from-right-full fade-in duration-300`}>
      <div className="flex-shrink-0 mr-3 mt-0.5">
        <IconComponent />
      </div>
      <div className="flex-1 mr-2">
        <p className="text-sm font-medium text-slate-900">{toast.message}</p>
      </div>
      <button 
        onClick={onRemove}
        className="flex-shrink-0 ml-auto text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
