import React, { useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import type { ConfirmOptions } from '../../contexts/DialogContext';
import { Button } from '../Button';

interface ConfirmDialogProps {
  options: ConfirmOptions;
  onClose: (value: boolean) => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ options, onClose }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      // Just immediately close with true. 
      // The caller will await this and run their own async logic.
      onClose(true);
    } finally {
      setIsLoading(false);
    }
  };

  const IconComponent = () => {
    switch (options.variant) {
      case 'danger': return <AlertTriangle className="w-6 h-6 text-red-600" />;
      case 'warning': return <AlertCircle className="w-6 h-6 text-orange-600" />;
      case 'success': return <CheckCircle2 className="w-6 h-6 text-green-600" />;
      case 'info': return <Info className="w-6 h-6 text-blue-600" />;
      default: return <AlertCircle className="w-6 h-6 text-edrops-blue" />;
    }
  };

  const IconBg = () => {
    switch (options.variant) {
      case 'danger': return 'bg-red-100';
      case 'warning': return 'bg-orange-100';
      case 'success': return 'bg-green-100';
      case 'info': return 'bg-blue-100';
      default: return 'bg-blue-50';
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-4">
            <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${IconBg()}`}>
              <IconComponent />
            </div>
            <div className="pt-1">
              <h3 className="text-lg font-bold text-slate-900">{options.title}</h3>
              {options.description && (
                <p className="mt-2 text-sm text-slate-500 whitespace-pre-wrap">{options.description}</p>
              )}
            </div>
          </div>
          <button 
            onClick={() => onClose(false)}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1"
            disabled={isLoading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      <div className="bg-slate-50 px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3 gap-3 sm:gap-0">
        <Button 
          variant="outline" 
          onClick={() => onClose(false)} 
          disabled={isLoading}
          className="w-full sm:w-auto"
        >
          {options.cancelText || 'Cancel'}
        </Button>
        <Button 
          variant={options.variant === 'danger' ? 'danger' : 'primary'} 
          onClick={handleConfirm}
          isLoading={isLoading}
          className="w-full sm:w-auto"
        >
          {options.confirmText || 'Confirm'}
        </Button>
      </div>
    </div>
  );
};
