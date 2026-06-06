import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin } from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';

interface AddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddressModal({ isOpen, onClose, onSuccess }: AddressModalProps) {
  const [formData, setFormData] = useState({
    label: '',
    fullName: '',
    mobileNumber: '',
    houseName: '',
    street: '',
    city: '',
    state: '',
    zipCode: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetchWithAuth('/address', {
        method: 'POST',
        body: JSON.stringify({ ...formData, isDefault: true }),
      });
      toast.success('Address saved successfully!');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save address');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#2D79A8]" />
                Add New Address
              </h2>
              <button onClick={onClose} className="p-2 bg-slate-50 text-slate-400 rounded-full hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar">
              <form id="address-form" onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase text-slate-500 mb-1">Full Name</label>
                    <input required type="text" value={formData.fullName} onChange={e => setFormData({ ...formData, fullName: e.target.value })} className="w-full p-3 rounded-xl border border-slate-200 focus:border-[#2D79A8] outline-none transition font-semibold text-slate-700" />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase text-slate-500 mb-1">Mobile</label>
                    <input required type="text" value={formData.mobileNumber} onChange={e => setFormData({ ...formData, mobileNumber: e.target.value })} className="w-full p-3 rounded-xl border border-slate-200 focus:border-[#2D79A8] outline-none transition font-semibold text-slate-700" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-slate-500 mb-1">Label (e.g. Home, Office)</label>
                  <input required type="text" value={formData.label} onChange={e => setFormData({ ...formData, label: e.target.value })} className="w-full p-3 rounded-xl border border-slate-200 focus:border-[#2D79A8] outline-none transition font-semibold text-slate-700" />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-slate-500 mb-1">House / Building Name</label>
                  <input type="text" value={formData.houseName} onChange={e => setFormData({ ...formData, houseName: e.target.value })} className="w-full p-3 rounded-xl border border-slate-200 focus:border-[#2D79A8] outline-none transition font-semibold text-slate-700" />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-slate-500 mb-1">Street</label>
                  <input required type="text" value={formData.street} onChange={e => setFormData({ ...formData, street: e.target.value })} className="w-full p-3 rounded-xl border border-slate-200 focus:border-[#2D79A8] outline-none transition font-semibold text-slate-700" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase text-slate-500 mb-1">City</label>
                    <input required type="text" value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} className="w-full p-3 rounded-xl border border-slate-200 focus:border-[#2D79A8] outline-none transition font-semibold text-slate-700" />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase text-slate-500 mb-1">State</label>
                    <input required type="text" value={formData.state} onChange={e => setFormData({ ...formData, state: e.target.value })} className="w-full p-3 rounded-xl border border-slate-200 focus:border-[#2D79A8] outline-none transition font-semibold text-slate-700" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-slate-500 mb-1">Pincode</label>
                  <input required type="text" value={formData.zipCode} onChange={e => setFormData({ ...formData, zipCode: e.target.value })} className="w-full p-3 rounded-xl border border-slate-200 focus:border-[#2D79A8] outline-none transition font-semibold text-slate-700" />
                </div>
              </form>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 sticky bottom-0">
              <button
                type="submit"
                form="address-form"
                disabled={loading}
                className="w-full py-4 rounded-full bg-[#245361] text-white font-black shadow-lg shadow-[#245361]/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {loading ? <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Save Address'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
