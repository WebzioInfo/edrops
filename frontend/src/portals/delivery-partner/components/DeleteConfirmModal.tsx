import { AlertTriangle, Loader2 } from 'lucide-react';
import type { CustomerRecord } from './CustomerFormModal';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  customer: CustomerRecord | null;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteConfirmModal({
  isOpen,
  customer,
  loading,
  onConfirm,
  onCancel,
}: DeleteConfirmModalProps) {
  if (!isOpen || !customer) return null;

  const customerName = `${customer.user?.firstName || ''} ${customer.user?.lastName || ''}`.trim() || 'this customer';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4 animate-in zoom-in-95">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#16324F]">Delete customer?</h3>
            <p className="text-xs text-[#64748B]">This action cannot be undone.</p>
          </div>
        </div>

        <p className="text-xs text-[#64748B] leading-relaxed">
          Are you sure you want to delete <strong className="text-[#16324F]">{customerName}</strong> ({customer.user?.phone})? Their profile and delivery routes will be deactivated.
        </p>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:text-[#16324F] bg-gray-50 hover:bg-gray-100 rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-2xs transition cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <span>Delete</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
