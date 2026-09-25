import React, { useEffect } from 'react';
import type { DialogState } from '../../contexts/DialogContext';
import { ConfirmDialog } from './ConfirmDialog';
import { AlertDialog } from './AlertDialog';
import { PromptDialog } from './PromptDialog';

interface DialogContainerProps {
  dialog: DialogState | null;
  onClose: (value: any) => void;
}

export const DialogContainer: React.FC<DialogContainerProps> = ({ dialog, onClose }) => {
  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dialog) {
        onClose(dialog.type === 'prompt' ? null : false);
      }
    };
    
    if (dialog) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [dialog, onClose]);

  if (!dialog) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="absolute inset-0" 
        onClick={() => onClose(dialog.type === 'prompt' ? null : false)} 
      />
      
      <div className="relative z-10 w-full max-w-md animate-in zoom-in-95 duration-200">
        {dialog.type === 'confirm' && (
          <ConfirmDialog options={dialog.options} onClose={onClose} />
        )}
        
        {dialog.type === 'alert' && (
          <AlertDialog options={dialog.options} onClose={onClose} />
        )}
        
        {dialog.type === 'prompt' && (
          <PromptDialog options={dialog.options} onClose={onClose} />
        )}
      </div>
    </div>
  );
};
