import { useState, useEffect } from 'react';
import { X, Loader2, IndianRupee, AlertCircle, Check } from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';

interface QuickJarPriceEditModalProps {
  isOpen: boolean;
  partner: any | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function QuickJarPriceEditModal({
  isOpen,
  partner,
  onClose,
  onSuccess,
}: QuickJarPriceEditModalProps) {
  const [priceInput, setPriceInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && partner) {
      const currentPrice = partner.deliveryPartner?.jarUnitPrice ?? partner.jarUnitPrice ?? 0;
      setPriceInput(Number(currentPrice).toFixed(2));
      setError(null);
      setLoading(false);
    }
  }, [isOpen, partner]);

  if (!isOpen || !partner) return null;

  const fullName = (partner.fullName || `${partner.firstName || ''} ${partner.lastName || ''}`).trim() || 'Delivery Partner';
  const partnerId = partner.id ? `DP-${partner.id.slice(0, 8).toUpperCase()}` : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setError(null);
    const trimmed = priceInput.trim();

    if (!trimmed) {
      setError('Please enter a jar unit price.');
      return;
    }

    const num = Number(trimmed);
    if (isNaN(num)) {
      setError('Please enter a valid numeric amount.');
      return;
    }

    if (num < 0) {
      setError('Jar unit price cannot be negative.');
      return;
    }

    if (num > 10000) {
      setError('Jar unit price cannot exceed ₹10,000.00.');
      return;
    }

    setLoading(true);
    try {
      await fetchWithAuth(`/admin/delivery-partners/${partner.id}/jar-unit-price`, {
        method: 'PATCH',
        body: JSON.stringify({
          jarUnitPrice: num,
        }),
      });

      toast.success(`Jar rate for ${fullName} updated to ₹${num.toFixed(2)} / jar`);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Update jar unit price error:', err);
      const msg = err.message || 'Could not update jar unit price. Please try again.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
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
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden animate-in zoom-in-95">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-50/80">
          <div>
            <h3 className="text-sm font-bold text-[#16324F]">Edit Jar Unit Price</h3>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              {fullName} {partnerId ? `• ${partnerId}` : ''}
            </p>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200/60 transition cursor-pointer disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-2.5 text-xs bg-red-50 text-red-700 border border-red-200 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#16324F]">
              Price per jar <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#1677C8] font-bold">
                <IndianRupee className="w-4 h-4" />
              </div>
              <input
                type="text"
                autoFocus
                disabled={loading}
                value={priceInput}
                onChange={(e) => {
                  setPriceInput(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="12.00"
                className="w-full pl-8 pr-14 py-2.5 text-sm sm:text-base font-bold bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl outline-none focus:bg-white focus:border-[#1677C8] focus:ring-2 focus:ring-[#1677C8]/10 transition-all text-[#16324F]"
              />
              <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs font-semibold text-[#64748B] pointer-events-none">
                / jar
              </span>
            </div>
            <p className="text-[11px] text-[#64748B] leading-relaxed pt-0.5">
              This is the amount assigned by Edrops to this delivery partner for each jar handled.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:text-[#16324F] bg-white border border-[#E2E8F0] rounded-xl hover:bg-gray-50 transition cursor-pointer disabled:opacity-50"
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
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Price</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
