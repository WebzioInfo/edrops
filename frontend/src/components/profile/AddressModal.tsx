import { useState, useEffect, type FormEvent, type ChangeEvent } from 'react';
import { X, MapPin, Check, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { fetchWithAuth } from '../../api/client';

export interface AddressData {
  id?: string;
  label?: string;
  fullName?: string;
  mobileNumber?: string;
  houseName?: string;
  buildingName?: string;
  street: string;
  area?: string;
  landmark?: string;
  city: string;
  district?: string;
  state: string;
  zipCode: string;
  country?: string;
  isDefault?: boolean;
}

interface AddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  addressToEdit: AddressData | null;
  onSuccess: () => void;
}

export default function AddressModal({
  isOpen,
  onClose,
  addressToEdit,
  onSuccess,
}: AddressModalProps) {
  const isEdit = Boolean(addressToEdit?.id);

  const [formData, setFormData] = useState<AddressData>({
    houseName: '',
    buildingName: '',
    street: '',
    area: '',
    landmark: '',
    city: 'Bengaluru',
    district: '',
    state: 'Karnataka',
    zipCode: '',
    isDefault: false,
    label: 'Home',
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (addressToEdit) {
      setFormData({
        houseName: addressToEdit.houseName || '',
        buildingName: addressToEdit.buildingName || '',
        street: addressToEdit.street || '',
        area: addressToEdit.area || '',
        landmark: addressToEdit.landmark || '',
        city: addressToEdit.city || 'Bengaluru',
        district: addressToEdit.district || '',
        state: addressToEdit.state || 'Karnataka',
        zipCode: addressToEdit.zipCode || '',
        isDefault: Boolean(addressToEdit.isDefault),
        label: addressToEdit.label || 'Home',
      });
    } else {
      setFormData({
        houseName: '',
        buildingName: '',
        street: '',
        area: '',
        landmark: '',
        city: 'Bengaluru',
        district: '',
        state: 'Karnataka',
        zipCode: '',
        isDefault: false,
        label: 'Home',
      });
    }
  }, [addressToEdit, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const cleanStreet = (formData.street || '').trim();
    const cleanCity = (formData.city || '').trim();
    const cleanState = (formData.state || '').trim();
    const cleanZip = (formData.zipCode || '').trim();

    if (!cleanStreet || !cleanCity || !cleanState || !cleanZip) {
      toast.error('Street, City, State, and Pincode are required.');
      return;
    }

    if (!/^\d{6}$/.test(cleanZip)) {
      toast.error('Please enter a valid 6-digit pincode.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        street: cleanStreet,
        city: cleanCity,
        state: cleanState,
        zipCode: cleanZip,
        houseName: (formData.houseName || '').trim() || undefined,
        buildingName: (formData.buildingName || '').trim() || undefined,
        area: (formData.area || '').trim() || undefined,
        landmark: (formData.landmark || '').trim() || undefined,
        district: (formData.district || '').trim() || undefined,
      };

      if (isEdit && addressToEdit?.id) {
        await fetchWithAuth(`/profile/addresses/${addressToEdit.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast.success('Address updated successfully');
      } else {
        await fetchWithAuth('/profile/addresses', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success('Address added successfully');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save address');
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1677C8] focus:bg-white transition-all';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#1677C8]/10 text-[#1677C8]">
              <MapPin className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              {isEdit ? 'Edit Address' : 'Add New Address'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 max-h-[80vh] overflow-y-auto">
          {/* Row 1: Flat/House & Building */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                House / Flat No.
              </label>
              <input
                name="houseName"
                value={formData.houseName}
                onChange={handleChange}
                placeholder="e.g. Flat 304, Villa 12"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Building Name
              </label>
              <input
                name="buildingName"
                value={formData.buildingName}
                onChange={handleChange}
                placeholder="e.g. Skyline Heights"
                className={inputClass}
              />
            </div>
          </div>

          {/* Row 2: Street & Area */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Street / Road <span className="text-rose-500">*</span>
              </label>
              <input
                required
                name="street"
                value={formData.street}
                onChange={handleChange}
                placeholder="e.g. 5th Main Road"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Area / Locality
              </label>
              <input
                name="area"
                value={formData.area}
                onChange={handleChange}
                placeholder="e.g. Indiranagar Stage 2"
                className={inputClass}
              />
            </div>
          </div>

          {/* Row 3: Landmark */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Landmark
            </label>
            <input
              name="landmark"
              value={formData.landmark}
              onChange={handleChange}
              placeholder="e.g. Near Metro Station / Behind Supermarket"
              className={inputClass}
            />
          </div>

          {/* Row 4: City, District, State */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                City <span className="text-rose-500">*</span>
              </label>
              <input
                required
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="City"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                District
              </label>
              <input
                name="district"
                value={formData.district}
                onChange={handleChange}
                placeholder="District"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                State <span className="text-rose-500">*</span>
              </label>
              <input
                required
                name="state"
                value={formData.state}
                onChange={handleChange}
                placeholder="State"
                className={inputClass}
              />
            </div>
          </div>

          {/* Row 5: Pincode & Address Label */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Pincode <span className="text-rose-500">*</span>
              </label>
              <input
                required
                name="zipCode"
                maxLength={6}
                value={formData.zipCode}
                onChange={handleChange}
                placeholder="6-digit pincode"
                className={`${inputClass} font-mono`}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Address Tag
              </label>
              <select
                name="label"
                value={formData.label || 'Home'}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="Home">Home</option>
                <option value="Office">Office</option>
                <option value="Warehouse">Warehouse</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* Default Address Checkbox */}
          <div className="pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-700">
              <input
                type="checkbox"
                name="isDefault"
                checked={formData.isDefault}
                onChange={handleChange}
                className="w-4 h-4 rounded border-slate-300 text-[#1677C8] focus:ring-0 cursor-pointer accent-[#1677C8]"
              />
              <span className="font-semibold">Set as primary delivery address</span>
            </label>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#1677C8] hover:bg-[#125ea0] text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{isEdit ? 'Update Address' : 'Save Address'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
