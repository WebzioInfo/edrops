import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, PhoneCall, X } from 'lucide-react';

interface QuickOrderContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerName?: string;
  customerPhone?: string;
  supportPhone?: string;
}

export default function QuickOrderContactModal({
  isOpen,
  onClose,
  customerName,
  customerPhone,
  supportPhone = '11111111',
}: QuickOrderContactModalProps) {
  if (!isOpen) return null;

  const cleanPhone = supportPhone.replace(/[^0-9+]/g, '');
  const waPhone = cleanPhone.replace(/^\+/, '');

  const greeting = customerName ? `Hello eDrops! My name is ${customerName}.` : 'Hello eDrops!';
  const phoneLine = customerPhone ? ` Registered contact: ${customerPhone}.` : '';
  const waMessage = `${greeting}${phoneLine} I would like to order water jars for immediate delivery.`;
  const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(waMessage)}`;

  const handleWhatsApp = () => {
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    onClose();
  };

  const handleCall = () => {
    window.location.href = `tel:${cleanPhone}`;
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
        {/* Backdrop click to dismiss */}
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl z-10 border border-slate-100"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900">Need Water Urgently?</h3>
              <p className="text-xs text-slate-500 mt-0.5">Quick booking via WhatsApp or phone call</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Action Options */}
          <div className="mt-4 space-y-3">
            {/* WhatsApp Option */}
            <button
              type="button"
              onClick={handleWhatsApp}
              className="w-full flex items-center gap-3.5 p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/80 hover:bg-emerald-100 text-left transition-all group cursor-pointer active:scale-[0.99]"
            >
              <div className="w-11 h-11 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-emerald-500/20">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-emerald-950">Order via WhatsApp</span>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-800">Instant</span>
                </div>
                <p className="text-xs text-emerald-800/80 mt-0.5">Chat directly with dispatch to book delivery</p>
              </div>
            </button>

            {/* Direct Call Option */}
            <button
              type="button"
              onClick={handleCall}
              className="w-full flex items-center gap-3.5 p-3.5 rounded-xl border border-blue-200 bg-blue-50/80 hover:bg-blue-100 text-left transition-all group cursor-pointer active:scale-[0.99]"
            >
              <div className="w-11 h-11 rounded-xl bg-[#1E88E5] text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/20">
                <PhoneCall className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-blue-950">Call to Order</span>
                  <span className="text-[11px] font-bold text-blue-600">{supportPhone}</span>
                </div>
                <p className="text-xs text-blue-800/80 mt-0.5">Speak directly with our helpline</p>
              </div>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
