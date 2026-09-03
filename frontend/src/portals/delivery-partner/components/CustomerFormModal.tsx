import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Save, 
  User, 
  MapPin, 
  Loader2, 
  Building2, 
  Phone, 
  Mail, 
  AlertCircle,
  Package
} from 'lucide-react';
import LocationPickerField from '../../../features/location/components/LocationPickerField';
import type { NormalizedLocation } from '../../../features/location/services/LocationEngine';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';

export interface CustomerRecord {
  id: string;
  userId?: string;
  customerType: string;
  companyName?: string;
  gstNumber?: string;
  jars_at_customer?: number;
  jarsAtCustomer?: number;
  user: {
    id?: string;
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
    isActive?: boolean;
  };
  addresses?: Array<{
    id?: string;
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
    latitude?: number | null;
    longitude?: number | null;
    googleMapsUrl?: string;
    isDefault?: boolean;
  }>;
}

interface CustomerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  customerToEdit?: CustomerRecord | null;
}

export default function CustomerFormModal({
  isOpen,
  onClose,
  onSuccess,
  customerToEdit,
}: CustomerFormModalProps) {
  const isEditing = !!customerToEdit;

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    customerType: 'RESIDENTIAL',
    companyName: '',
    gstNumber: '',
  });

  const [jarsAtCustomerStr, setJarsAtCustomerStr] = useState<string>('0');

  const [addressData, setAddressData] = useState({
    street: '',
    houseName: '',
    buildingName: '',
    area: '',
    city: '',
    district: '',
    state: '',
    zipCode: '',
    country: 'India',
  });

  const [locationData, setLocationData] = useState<NormalizedLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Initialize form when opening / editing
  useEffect(() => {
    if (customerToEdit) {
      setFormData({
        firstName: customerToEdit.user?.firstName || '',
        lastName: customerToEdit.user?.lastName || '',
        phone: customerToEdit.user?.phone || '',
        email: customerToEdit.user?.email || '',
        customerType: customerToEdit.customerType || 'RESIDENTIAL',
        companyName: customerToEdit.companyName || '',
        gstNumber: customerToEdit.gstNumber || '',
      });

      setJarsAtCustomerStr(
        String(
          customerToEdit.jars_at_customer !== undefined
            ? customerToEdit.jars_at_customer
            : customerToEdit.jarsAtCustomer !== undefined
            ? customerToEdit.jarsAtCustomer
            : 0,
        ),
      );

      const defaultAddr = customerToEdit.addresses?.find((a) => a.isDefault) || customerToEdit.addresses?.[0];
      if (defaultAddr) {
        setAddressData({
          street: defaultAddr.street || '',
          houseName: defaultAddr.houseName || '',
          buildingName: defaultAddr.buildingName || '',
          area: defaultAddr.area || '',
          city: defaultAddr.city || 'Kondotty',
          district: defaultAddr.district || 'Malappuram',
          state: defaultAddr.state || 'Kerala',
          zipCode: defaultAddr.zipCode || '',
          country: defaultAddr.country || 'India',
        });

        if (defaultAddr.latitude && defaultAddr.longitude) {
          setLocationData({
            placeId: `edit_${defaultAddr.latitude}_${defaultAddr.longitude}`,
            name: defaultAddr.buildingName || defaultAddr.street || 'Customer Location',
            formattedAddress: [defaultAddr.street, defaultAddr.city, defaultAddr.state].filter(Boolean).join(', '),
            secondaryText: [defaultAddr.city, defaultAddr.district, defaultAddr.state, defaultAddr.zipCode].filter(Boolean).join(', '),
            latitude: defaultAddr.latitude,
            longitude: defaultAddr.longitude,
            city: defaultAddr.city || null,
            district: defaultAddr.district || null,
            state: defaultAddr.state || null,
            country: defaultAddr.country || 'India',
            countryCode: 'IN',
            pincode: defaultAddr.zipCode || null,
            locationType: 'ADDRESS',
            source: 'google',
          });
        }
      }
    } else {
      // Reset
      setFormData({
        firstName: '',
        lastName: '',
        phone: '',
        email: '',
        customerType: 'RESIDENTIAL',
        companyName: '',
        gstNumber: '',
      });
      setJarsAtCustomerStr('0');
      setAddressData({
        street: '',
        houseName: '',
        buildingName: '',
        area: '',
        city: '',
        district: '',
        state: '',
        zipCode: '',
        country: 'India',
      });
      setLocationData(null);
    }
    setFormError(null);
  }, [customerToEdit, isOpen]);

  // Handle location change from map/places (Search, Map click, Map drag, GPS)
  const handleLocationChange = (loc: NormalizedLocation) => {
    setLocationData(loc);

    // Strictly populate City, District, State, Pincode. Street Address is NEVER auto-filled!
    setAddressData((prev) => ({
      ...prev,
      street: prev.street, // Strictly user-entered only
      city: loc.city || prev.city,
      district: loc.district || prev.district,
      state: loc.state || prev.state,
      zipCode: loc.pincode || '',
      country: loc.country || prev.country || 'India',
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation
    if (!formData.firstName.trim()) {
      setFormError('First name is required.');
      return;
    }
    if (!formData.lastName.trim()) {
      setFormError('Last name is required.');
      return;
    }
    const cleanPhone = formData.phone.trim().replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setFormError('Please enter a valid 10-digit phone number.');
      return;
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      setFormError('Please enter a valid email address.');
      return;
    }
    if (!addressData.street.trim()) {
      setFormError('Street address is required.');
      return;
    }
    if (!locationData || !locationData.latitude || !locationData.longitude) {
      setFormError('Please pinpoint and select the customer location on the map.');
      return;
    }

    const parsedJars = jarsAtCustomerStr.trim() === '' ? 0 : parseInt(jarsAtCustomerStr, 10);
    const finalJars = Math.max(0, isNaN(parsedJars) ? 0 : parsedJars);

    const payload = {
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      phone: cleanPhone,
      email: formData.email.trim() || undefined,
      customerType: formData.customerType,
      companyName: formData.companyName.trim() || undefined,
      gstNumber: formData.gstNumber.trim() || undefined,
      jars_at_customer: finalJars,
      generateRandomPassword: true,
      addresses: [
        {
          street: addressData.street.trim(),
          houseName: addressData.houseName.trim() || undefined,
          buildingName: addressData.buildingName.trim() || undefined,
          area: addressData.area.trim() || undefined,
          city: addressData.city.trim() || locationData.city || 'Kondotty',
          district: addressData.district.trim() || locationData.district || 'Malappuram',
          state: addressData.state.trim() || locationData.state || 'Kerala',
          zipCode: addressData.zipCode.trim() || locationData.pincode || '673638',
          country: addressData.country || locationData.country || 'India',
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${locationData.latitude},${locationData.longitude}`,
          isDefault: true,
        },
      ],
    };

    setLoading(true);
    try {
      if (isEditing && customerToEdit) {
        await fetchWithAuth(`/customer/${customerToEdit.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast.success('Customer updated successfully!');
      } else {
        await fetchWithAuth('/customer', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success('Customer created successfully!');
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save customer. Please try again.');
      toast.error(err.message || 'Failed to save customer');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="bg-white w-full sm:max-w-4xl h-full sm:h-auto sm:max-h-[90vh] sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] shrink-0 bg-white z-10">
            <div>
              <h2 className="text-lg font-bold text-[#16324F]">
                {isEditing ? 'Edit Customer' : 'Add New Customer'}
              </h2>
              <p className="text-xs text-[#64748B]">
                {isEditing
                  ? 'Update customer details and delivery coordinates'
                  : 'Register a customer and set their exact delivery drop location'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Body - Two Columns on Desktop */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
            {formError && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-start gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Left Column: Customer Details */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-[#1677C8] uppercase tracking-wider pb-1 border-b border-gray-100">
                  <User className="w-4 h-4" />
                  <span>Customer Information</span>
                </div>

                {/* Name */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#16324F] mb-1">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rahul"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-[#E2E8F0] rounded-xl outline-none focus:border-[#1677C8] focus:ring-2 focus:ring-[#1677C8]/10 transition-all text-[#16324F]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#16324F] mb-1">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Sharma"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-[#E2E8F0] rounded-xl outline-none focus:border-[#1677C8] focus:ring-2 focus:ring-[#1677C8]/10 transition-all text-[#16324F]"
                    />
                  </div>
                </div>

                {/* Phone & Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#16324F] mb-1">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <div className="relative flex items-center">
                      <Phone className="w-4 h-4 absolute left-3 text-gray-400" />
                      <input
                        type="tel"
                        required
                        placeholder="9876543210"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full pl-9 pr-3.5 py-2.5 text-xs sm:text-sm bg-white border border-[#E2E8F0] rounded-xl outline-none focus:border-[#1677C8] focus:ring-2 focus:ring-[#1677C8]/10 transition-all text-[#16324F]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#16324F] mb-1">
                      Email <span className="text-gray-400 font-normal">(Optional)</span>
                    </label>
                    <div className="relative flex items-center">
                      <Mail className="w-4 h-4 absolute left-3 text-gray-400" />
                      <input
                        type="email"
                        placeholder="name@example.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full pl-9 pr-3.5 py-2.5 text-xs sm:text-sm bg-white border border-[#E2E8F0] rounded-xl outline-none focus:border-[#1677C8] focus:ring-2 focus:ring-[#1677C8]/10 transition-all text-[#16324F]"
                      />
                    </div>
                  </div>
                </div>

                {/* Customer Type */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#16324F] mb-1">Customer Type</label>
                    <select
                      value={formData.customerType}
                      onChange={(e) => setFormData({ ...formData, customerType: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-[#E2E8F0] rounded-xl outline-none focus:border-[#1677C8] focus:ring-2 focus:ring-[#1677C8]/10 transition-all text-[#16324F]"
                    >
                      <option value="RESIDENTIAL">Residential</option>
                      <option value="COMMERCIAL">Commercial</option>
                      <option value="OFFICE">Office</option>
                      <option value="APARTMENT">Apartment</option>
                    </select>
                  </div>

                  {(formData.customerType === 'COMMERCIAL' || formData.customerType === 'OFFICE') && (
                    <div>
                      <label className="block text-xs font-semibold text-[#16324F] mb-1">Company Name</label>
                      <input
                        type="text"
                        placeholder="Acme Corp"
                        value={formData.companyName}
                        onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-[#E2E8F0] rounded-xl outline-none focus:border-[#1677C8] focus:ring-2 focus:ring-[#1677C8]/10 transition-all text-[#16324F]"
                      />
                    </div>
                  )}
                </div>

                {/* Customer Jar Holding */}
                <div className="pt-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#1677C8] uppercase tracking-wider pb-1 border-b border-gray-100 mb-3">
                    <Package className="w-4 h-4" />
                    <span>Customer Jar Holding</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#16324F] mb-1">
                      Jars at Customer
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="0"
                      value={jarsAtCustomerStr}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (/^\d*$/.test(val)) {
                          setJarsAtCustomerStr(val);
                        }
                      }}
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-[#E2E8F0] rounded-xl outline-none focus:border-[#1677C8] focus:ring-2 focus:ring-[#1677C8]/10 transition-all text-[#16324F]"
                    />
                    <p className="text-[11px] text-[#64748B] mt-1">
                      {isEditing
                        ? 'Current number of Edrops jars physically with this customer'
                        : 'How many Edrops jars are currently with this customer?'}
                    </p>
                  </div>
                </div>

                {/* Address Section */}
                <div className="pt-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#1677C8] uppercase tracking-wider pb-1 border-b border-gray-100 mb-3">
                    <Building2 className="w-4 h-4" />
                    <span>Address Details</span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#16324F] mb-1">
                        Street Address / Building <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Flat 4B, Blue Heights, MG Road"
                        value={addressData.street}
                        onChange={(e) => setAddressData({ ...addressData, street: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-[#E2E8F0] rounded-xl outline-none focus:border-[#1677C8] focus:ring-2 focus:ring-[#1677C8]/10 transition-all text-[#16324F]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-[#16324F] mb-1">City</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Kondotty"
                          value={addressData.city}
                          onChange={(e) => setAddressData({ ...addressData, city: e.target.value })}
                          className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-[#E2E8F0] rounded-xl outline-none focus:border-[#1677C8] focus:ring-2 focus:ring-[#1677C8]/10 transition-all text-[#16324F]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#16324F] mb-1">District</label>
                        <input
                          type="text"
                          placeholder="e.g. Malappuram"
                          value={addressData.district}
                          onChange={(e) => setAddressData({ ...addressData, district: e.target.value })}
                          className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-[#E2E8F0] rounded-xl outline-none focus:border-[#1677C8] focus:ring-2 focus:ring-[#1677C8]/10 transition-all text-[#16324F]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-[#16324F] mb-1">State</label>
                        <input
                          type="text"
                          placeholder="e.g. Kerala"
                          value={addressData.state}
                          onChange={(e) => setAddressData({ ...addressData, state: e.target.value })}
                          className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-[#E2E8F0] rounded-xl outline-none focus:border-[#1677C8] focus:ring-2 focus:ring-[#1677C8]/10 transition-all text-[#16324F]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#16324F] mb-1">Pincode</label>
                        <input
                          type="text"
                          placeholder="e.g. 673638"
                          value={addressData.zipCode}
                          onChange={(e) => setAddressData({ ...addressData, zipCode: e.target.value })}
                          className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-[#E2E8F0] rounded-xl outline-none focus:border-[#1677C8] focus:ring-2 focus:ring-[#1677C8]/10 transition-all text-[#16324F]"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Location Map & Coordinates */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-[#1677C8] uppercase tracking-wider pb-1 border-b border-gray-100">
                  <MapPin className="w-4 h-4" />
                  <span>Delivery Drop Location</span>
                </div>

                <LocationPickerField
                  initialLat={locationData?.latitude}
                  initialLng={locationData?.longitude}
                  initialName={locationData?.name || undefined}
                  initialFormattedAddress={locationData?.formattedAddress || undefined}
                  onLocationChange={handleLocationChange}
                />
              </div>

            </div>
          </form>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E2E8F0] bg-slate-50 shrink-0">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="px-5 py-2.5 text-xs sm:text-sm font-semibold text-[#64748B] hover:text-[#16324F] bg-white border border-[#E2E8F0] rounded-xl hover:bg-gray-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handleSubmit}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-xs sm:text-sm font-semibold text-white bg-[#1677C8] hover:bg-[#1362a4] rounded-xl shadow-2xs transition cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{isEditing ? 'Update Customer' : 'Save Customer'}</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
