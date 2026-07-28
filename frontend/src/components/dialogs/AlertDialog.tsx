import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type { AlertOptions } from '../../contexts/DialogContext';
import { Button } from '../Button';

interface AlertDialogProps {
  options: AlertOptions;
  onClose: (value: void) => void;
}

export const AlertDialog: React.FC<AlertDialogProps> = ({ options, onClose }) => {

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
        <div className="flex flex-col items-center text-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${IconBg()}`}>
            <IconComponent />
          </div>
          <h3 className="text-xl font-bold text-slate-900">{options.title}</h3>
          {options.description && (
            <p className="mt-3 text-sm text-slate-500 whitespace-pre-wrap">{options.description}</p>
          )}
        </div>
      </div>
      
      <div className="bg-slate-50 px-6 py-4 flex flex-col">
        <Button 
          variant={options.variant === 'danger' ? 'danger' : 'primary'} 
          onClick={() => onClose()}
          className="w-full"
        >
          {options.confirmText || 'Okay'}
        </Button>
      </div>
    </div>
  );
};
