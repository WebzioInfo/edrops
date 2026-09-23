import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { fetchWithAuth, BASE_URL } from '../../../api/client';
import { toast } from 'react-hot-toast';

interface AddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type PincodeState = 'idle' | 'invalid' | 'checking' | 'serviceable' | 'unserviceable' | 'error';

interface ServiceabilityData {
  serviceable: boolean;
  found: boolean;
  pincode: string;
  distanceKm: number | null;
  serviceRadiusKm: number;
  city?: string;
  state?: string;
}

const PINCODE_RE = /^\d{6}$/;

const inputCls = (enabled: boolean) =>
  `w-full py-2 px-3 rounded-lg border text-sm font-medium outline-none transition-all duration-200 ${
    enabled
      ? 'border-slate-200 bg-white text-[#0F172A] focus:border-[#1E88E5] focus:ring-1 focus:ring-[#1E88E5] placeholder:text-slate-400'
      : 'border-slate-200 bg-slate-50/70 text-slate-400 placeholder:text-slate-300 cursor-not-allowed'
  }`;

const labelCls = 'block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1';

export default function AddressModal({ isOpen, onClose, onSuccess }: AddressModalProps) {
  const [pincode, setPincode] = useState('');
  const [pincodeState, setPincodeState] = useState<PincodeState>('idle');
  const [serviceData, setServiceData] = useState<ServiceabilityData | null>(null);

  const [form, setForm] = useState({
    fullName: '',
    mobileNumber: '',
    label: '',
    houseName: '',
    street: '',
    city: '',
    state: '',
  });
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset all state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setPincode('');
      setPincodeState('idle');
      setServiceData(null);
      setForm({ fullName: '', mobileNumber: '', label: '', houseName: '', street: '', city: '', state: '' });
    }
  }, [isOpen]);

  const checkPincode = async (value: string) => {
    const code = value.trim();
    if (!PINCODE_RE.test(code)) {
      setPincodeState(code.length > 0 ? 'invalid' : 'idle');
      setServiceData(null);
      return;
    }

    setPincodeState('checking');
    try {
      // First try fetchWithAuth; fallback to public fetch if auth throws (since endpoint is public)
      let result: ServiceabilityData;
      try {
        result = await fetchWithAuth(`/address/serviceability?pincode=${code}`);
      } catch {
        const res = await fetch(`${BASE_URL}/address/serviceability?pincode=${code}`);
        if (!res.ok) throw new Error('Serviceability lookup failed');
        result = await res.json();
      }

      setServiceData(result);
      if (result.serviceable) {
        setPincodeState('serviceable');
        // Auto-prefill city and state â€” user can still edit
        setForm((prev) => ({
          ...prev,
          city: prev.city || result.city || '',
          state: prev.state || result.state || '',
        }));
      } else {
        setPincodeState('unserviceable');
      }
    } catch (err) {
      console.error('Pincode serviceability check failed:', err);
      setPincodeState('error');
      setServiceData(null);
    }
  };

  const handlePincodeChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 6);
    setPincode(cleaned);
    setServiceData(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (cleaned.length === 6) {
      // Immediately trigger check as soon as 6 digits are entered
      checkPincode(cleaned);
    } else {
      setPincodeState(cleaned.length > 0 ? 'invalid' : 'idle');
    }
  };

  const isFormUnlocked = pincodeState === 'serviceable';

  // Convenience helper for input props
  const field = (name: keyof typeof form) => ({
    value: form[name],
    disabled: !isFormUnlocked,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [name]: e.target.value })),
    className: inputCls(isFormUnlocked),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormUnlocked) return;
    setLoading(true);
    try {
      // Server-side re-validation
      let recheck: ServiceabilityData;
      try {
        recheck = await fetchWithAuth(`/address/serviceability?pincode=${pincode}`);
      } catch {
        const res = await fetch(`${BASE_URL}/address/serviceability?pincode=${pincode}`);
        if (!res.ok) throw new Error('Validation failed');
        recheck = await res.json();
      }

      if (!recheck.serviceable) {
        toast.error("Sorry, we couldn't deliver to this pincode.");
        setPincodeState('unserviceable');
        setServiceData(recheck);
        setLoading(false);
        return;
      }

      await fetchWithAuth('/address', {
        method: 'POST',
        body: JSON.stringify({ ...form, zipCode: pincode, isDefault: true }),
      });
      toast.success('Address saved!');
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, y: 48 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 48 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl flex flex-col max-h-[92vh] border border-[#E2E8F0]"
          >
            {/* Header */}
            <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between shrink-0">
              <h2 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#1E88E5]" />
                Add New Address
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-full bg-slate-100 text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 overflow-y-auto flex-1">
              <form id="address-form" onSubmit={handleSubmit} className="space-y-3.5">

                {/* Pincode Section - Check Delivery Availability */}
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#1E88E5] mb-2 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    Check Delivery Availability
                  </div>

                  <div>
                    <label className={labelCls}>Pincode</label>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="Enter 6-digit pincode"
                        value={pincode}
                        onChange={(e) => handlePincodeChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (PINCODE_RE.test(pincode)) checkPincode(pincode);
                          }
                        }}
                        maxLength={6}
                        className="w-full py-2 px-3 pr-24 rounded-lg border border-slate-200 bg-white text-sm font-bold text-[#0F172A] outline-none transition focus:border-[#1E88E5] focus:ring-1 focus:ring-[#1E88E5] tracking-widest placeholder:tracking-normal placeholder:font-normal placeholder:text-slate-400"
                      />
                      <div className="absolute right-2 flex items-center gap-1.5">
                        {pincodeState === 'checking' && (
                          <div className="flex items-center gap-1 text-xs text-[#1E88E5] font-semibold pr-1">
                            <Loader2 className="w-4 h-4 animate-spin" />
                          </div>
                        )}
                        {pincodeState === 'serviceable' && (
                          <span className="flex items-center gap-1 text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Verified
                          </span>
                        )}
                        {pincode.length === 6 && pincodeState !== 'checking' && pincodeState !== 'serviceable' && (
                          <button
                            type="button"
                            onClick={() => checkPincode(pincode)}
                            className="px-2.5 py-1 text-xs font-bold text-white bg-[#1E88E5] hover:bg-[#1565C0] active:scale-95 rounded-md transition cursor-pointer shadow-xs"
                          >
                            Check
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Status Messages */}
                    <div className="mt-1.5 min-h-[20px]">
                      {pincodeState === 'idle' && (
                        <p className="text-xs text-slate-500 font-medium">
                          Enter your 6-digit pincode first.
                        </p>
                      )}
                      {pincodeState === 'invalid' && (
                        <p className="text-xs text-amber-600 font-medium">
                          Enter a valid 6-digit pincode.
                        </p>
                      )}
                      {pincodeState === 'checking' && (
                        <p className="text-xs text-[#1E88E5] font-semibold flex items-center gap-1.5">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Checking availability...
                        </p>
                      )}
                      {pincodeState === 'serviceable' && (
                        <p className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                          ✓ Delivery available
                          {serviceData?.distanceKm !== null && serviceData?.distanceKm !== undefined
                            ? ` (${serviceData.distanceKm} km away)`
                            : ''}
                        </p>
                      )}
                      {pincodeState === 'unserviceable' && (
                        <p className="text-xs text-rose-600 font-semibold flex items-center gap-1">
                          <XCircle className="w-4 h-4 shrink-0 text-rose-500" />
                          Sorry, we couldn't deliver to this pincode.
                        </p>
                      )}
                      {pincodeState === 'error' && (
                        <p className="text-xs text-rose-600 font-semibold flex items-center gap-1">
                          <XCircle className="w-4 h-4 shrink-0 text-rose-500" />
                          We couldn't verify this pincode. Please try again.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Address Form Fields */}
                <div className="space-y-3 transition-all duration-200">
                  {/* Full Name + Mobile */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Full Name</label>
                      <input type="text" placeholder="Full name" required={isFormUnlocked} {...field('fullName')} />
                    </div>
                    <div>
                      <label className={labelCls}>Mobile Number</label>
                      <input type="text" inputMode="tel" placeholder="Mobile number" required={isFormUnlocked} {...field('mobileNumber')} />
                    </div>
                  </div>

                  {/* Label */}
                  <div>
                    <label className={labelCls}>Label</label>
                    <input
                      type="text"
                      required={isFormUnlocked}
                      placeholder={isFormUnlocked ? 'e.g. Home, Office' : 'Label (e.g. Home, Office)'}
                      {...field('label')}
                    />
                  </div>

                  {/* House / Building */}
                  <div>
                    <label className={labelCls}>House / Building</label>
                    <input type="text" placeholder="Flat, House no., Building" {...field('houseName')} />
                  </div>

                  {/* Street */}
                  <div>
                    <label className={labelCls}>Street</label>
                    <input type="text" placeholder="Area, Street, Sector" required={isFormUnlocked} {...field('street')} />
                  </div>

                  {/* City + State */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>City</label>
                      <input type="text" placeholder="City" required={isFormUnlocked} {...field('city')} />
                    </div>
                    <div>
                      <label className={labelCls}>State</label>
                      <input type="text" placeholder="State" required={isFormUnlocked} {...field('state')} />
                    </div>
                  </div>
                </div>
              </form>
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 border-t border-[#E2E8F0] shrink-0 bg-white">
              <button
                type="submit"
                form="address-form"
                disabled={loading || !isFormUnlocked}
                className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                  isFormUnlocked
                    ? 'bg-[#1E88E5] hover:bg-[#1565C0] text-white shadow-xs cursor-pointer active:scale-98'
                    : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                }`}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isFormUnlocked ? (
                  'Save Address'
                ) : (
                  'Check your pincode first'
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
