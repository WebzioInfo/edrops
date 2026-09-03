import { useState, useEffect, useRef } from 'react';
import { X, Package, Loader2, AlertCircle } from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';
import type { CustomerRecord } from './CustomerFormModal';

interface QuickJarEditModalProps {
  isOpen: boolean;
  customer: CustomerRecord | null;
  onClose: () => void;
  onSuccess: (updatedCustomer: CustomerRecord) => void;
}

export default function QuickJarEditModal({
  isOpen,
  customer,
  onClose,
  onSuccess,
}: QuickJarEditModalProps) {
  const [jarCountInput, setJarCountInput] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize input on open
  useEffect(() => {
    if (isOpen && customer) {
      const currentVal =
        customer.jars_at_customer !== undefined
          ? customer.jars_at_customer
          : customer.jarsAtCustomer !== undefined
          ? customer.jarsAtCustomer
          : 0;
      setJarCountInput(String(currentVal));
      setValidationError(null);
      setLoading(false);

      // Focus and select input after modal mounts
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);
    } else {
      setJarCountInput('');
      setValidationError(null);
      setLoading(false);
    }
  }, [isOpen, customer]);

  if (!isOpen || !customer) return null;

  const currentJars =
    customer.jars_at_customer !== undefined
      ? customer.jars_at_customer
      : customer.jarsAtCustomer !== undefined
      ? customer.jarsAtCustomer
      : 0;

  const customerName =
    `${customer.user?.firstName || ''} ${customer.user?.lastName || ''}`.trim() ||
    customer.companyName ||
    'Customer';

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (loading) return;

    setValidationError(null);

    // Strict validation
    const trimmed = jarCountInput.trim();
    if (trimmed === '') {
      setValidationError('Please enter the jar count.');
      if (inputRef.current) inputRef.current.focus();
      return;
    }

    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed) || parsed < 0) {
      setValidationError('Jar count must be a non-negative whole number (0 or greater).');
      if (inputRef.current) inputRef.current.focus();
      return;
    }

    setLoading(true);
    try {
      console.log(`[QuickJarEdit] PATCH /customer/${customer.id} -> jars_at_customer: ${parsed}`);
      const updated = await fetchWithAuth(`/customer/${customer.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          jars_at_customer: parsed,
        }),
      });

      toast.success(`Updated jar holding to ${parsed} jars`);
      onSuccess({
        ...customer,
        ...updated,
        jars_at_customer: parsed,
        jarsAtCustomer: parsed,
      });
    } catch (err: any) {
      console.error('Quick Jar Edit Error:', err);
      const msg = err.message || 'Unable to update jar count. Please try again.';
      setValidationError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) {
          onClose();
        }
      }}
    >
      <div className="bg-white w-full max-w-xs sm:max-w-sm rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden animate-in zoom-in-95">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#1677C8]/10 text-[#1677C8] flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[#16324F]">Jars at Customer</h3>
              <p className="text-[10px] text-[#64748B] truncate max-w-[190px]">{customerName}</p>
            </div>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200/60 transition cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSave} className="p-4 space-y-3.5">
          {/* Current balance indicator */}
          <div className="flex items-center justify-between text-xs bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
            <span className="text-[#64748B] text-[11px] font-medium">Current Balance:</span>
            <span className="font-bold text-[#16324F]">
              {currentJars} <span className="text-[11px] font-normal text-[#64748B]">jars</span>
            </span>
          </div>

          {/* Edit Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#16324F]">
              New Jar Count <span className="text-red-500">*</span>
            </label>
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              disabled={loading}
              placeholder="0"
              value={jarCountInput}
              onChange={(e) => {
                const val = e.target.value;
                // Allow empty or digits only
                if (/^\d*$/.test(val)) {
                  setJarCountInput(val);
                  if (validationError) setValidationError(null);
                }
              }}
              onKeyDown={handleKeyDown}
              className={`w-full px-3.5 py-2.5 text-sm font-bold bg-white border rounded-xl outline-none transition-all text-[#16324F] ${
                validationError
                  ? 'border-red-400 focus:ring-2 focus:ring-red-100'
                  : 'border-[#E2E8F0] focus:border-[#1677C8] focus:ring-2 focus:ring-[#1677C8]/10'
              }`}
            />
            {validationError ? (
              <p className="text-[11px] text-red-600 font-medium flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{validationError}</span>
              </p>
            ) : (
              <p className="text-[10px] text-[#64748B]">
                Enter physical jars currently with customer (0 or higher)
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-[#64748B] hover:text-[#16324F] bg-white border border-[#E2E8F0] rounded-xl hover:bg-gray-50 transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#1677C8] hover:bg-[#1362a4] rounded-xl shadow-2xs transition cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
