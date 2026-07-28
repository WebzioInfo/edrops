import React, { useState, useEffect, useRef } from 'react';
import type { PromptOptions } from '../../contexts/DialogContext';
import { Button } from '../Button';

interface PromptDialogProps {
  options: PromptOptions;
  onClose: (value: string | null) => void;
}

export const PromptDialog: React.FC<PromptDialogProps> = ({ options, onClose }) => {
  const [value, setValue] = useState(options.defaultValue || '');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus the input when the dialog opens
    inputRef.current?.focus();
  }, []);

  const handleConfirm = async () => {
    if (options.required && !value.trim()) {
      // Small shake animation or visual cue could go here
      inputRef.current?.focus();
      return;
    }
    
    setIsLoading(true);
    try {
      onClose(value);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
      <div className="p-6 pb-4">
        <h3 className="text-lg font-bold text-slate-900 mb-2">{options.title}</h3>
        {options.description && (
          <p className="text-sm text-slate-500 mb-4 whitespace-pre-wrap">{options.description}</p>
        )}
        
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={options.placeholder || 'Enter value...'}
          className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-edrops-blue focus:border-transparent transition-shadow text-slate-900"
        />
        {options.required && value.trim() === '' && (
          <p className="text-xs text-red-500 mt-2">This field is required.</p>
        )}
      </div>
      
      <div className="bg-slate-50 px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3 gap-3 sm:gap-0">
        <Button 
          variant="outline" 
          onClick={() => onClose(null)} 
          disabled={isLoading}
          className="w-full sm:w-auto"
        >
          {options.cancelText || 'Cancel'}
        </Button>
        <Button 
          variant="primary" 
          onClick={handleConfirm}
          isLoading={isLoading}
          disabled={options.required && value.trim() === ''}
          className="w-full sm:w-auto"
        >
          {options.confirmText || 'Confirm'}
        </Button>
      </div>
    </div>
  );
};
