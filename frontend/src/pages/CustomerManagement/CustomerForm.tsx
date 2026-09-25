import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  MapPin,
  Wallet,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { fetchWithAuth } from '../../api/client';
import { toast } from 'react-hot-toast';
import LocationPicker from '../../features/location/components/LocationPicker';
import type { GeocodedAddress } from '../../features/location/hooks/useReverseGeocoding';

export default function CustomerForm({ basePath }: { basePath: string }) {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(isEdit);
  const [error, setError] = useState<string | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    customerType: 'RESIDENTIAL',
    companyName: '',
    gstNumber: '',
    openingWalletBalance: 0,
    openingJarBalance: 0,
    generateRandomPassword: true,
    password: '',
  });

  const [addressData, setAddressData] = useState({
    houseName: '',
    buildingName: '',
    street: '',
    area: '',
    landmark: '',
    city: '',
    district: '',
    state: '',
    country: 'India',
    zipCode: '',
    addressNotes: '',
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined,
    googleMapsUrl: '',
  });

  // If in edit mode, fetch existing customer data
  useEffect(() => {
    if (!id) return;
    const fetchExistingCustomer = async () => {
      try {
        setFetchingData(true);
        setError(null);
        const data = await fetchWithAuth(`/customer/${id}`);
        if (data) {
          setFormData({
            firstName: data.user?.firstName || '',
            lastName: data.user?.lastName || '',
            phone: data.user?.phone || '',
            email: data.user?.email || '',
            customerType: data.customerType || 'RESIDENTIAL',
            companyName: data.companyName || '',
            gstNumber: data.gstNumber || '',
            openingWalletBalance: data.wallet?.balance || 0,
            openingJarBalance: data.jarBalances?.[0]?.availableJars || data.jars_at_customer || 0,
            generateRandomPassword: false,
            password: '',
          });

          if (data.addresses && data.addresses.length > 0) {
            const addr = data.addresses[0];
            setAddressData({
              houseName: addr.houseName || '',
              buildingName: addr.buildingName || '',
              street: addr.street || '',
              area: addr.area || '',
              landmark: addr.landmark || '',
              city: addr.city || '',
              district: addr.district || '',
              state: addr.state || '',
              country: addr.country || 'India',
              zipCode: addr.zipCode || '',
              addressNotes: addr.addressNotes || '',
              latitude: addr.latitude,
              longitude: addr.longitude,
              googleMapsUrl: addr.googleMapsUrl || '',
            });
            if (addr.latitude && addr.longitude) {
              setShowMapPicker(true);
            }
          }
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load customer information');
        toast.error('Failed to load customer information');
      } finally {
        setFetchingData(false);
      }
    };

    fetchExistingCustomer();
  }, [id]);

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === 'number'
          ? Number(value)
          : type === 'checkbox'
          ? (e.target as HTMLInputElement).checked
          : value,
    }));
  };

  const handleLocationSelected = (
    lat: number,
    lng: number,
    address: GeocodedAddress,
    googleUrl: string
  ) => {
    setAddressData((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lng,
      googleMapsUrl: googleUrl,
      street: address.street || prev.street,
      area: address.area || prev.area,
      city: address.city || prev.city,
      district: address.district || prev.district,
      state: address.state || prev.state,
      zipCode: address.zipCode || prev.zipCode,
      country: address.country || prev.country,
    }));
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setAddressData((prev) => ({ ...prev, [name]: value }));
  };

  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let generated = '';
    for (let i = 0; i < 10; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData((prev) => ({ ...prev, password: generated, generateRandomPassword: false }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload: any = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        phone: formData.phone.trim(),
        email: formData.email ? formData.email.trim() : undefined,
        customerType: formData.customerType,
        companyName: formData.companyName ? formData.companyName.trim() : undefined,
        gstNumber: formData.gstNumber ? formData.gstNumber.trim() : undefined,
        addresses: [
          {
            houseName: addressData.houseName ? addressData.houseName.trim() : undefined,
            buildingName: addressData.buildingName ? addressData.buildingName.trim() : undefined,
            street: addressData.street.trim(),
            area: addressData.area ? addressData.area.trim() : undefined,
            landmark: addressData.landmark ? addressData.landmark.trim() : undefined,
            city: addressData.city.trim(),
            district: addressData.district ? addressData.district.trim() : undefined,
            state: addressData.state.trim(),
            country: addressData.country.trim(),
            zipCode: addressData.zipCode.trim(),
            addressNotes: addressData.addressNotes ? addressData.addressNotes.trim() : undefined,
            latitude: addressData.latitude,
            longitude: addressData.longitude,
            googleMapsUrl: addressData.googleMapsUrl || undefined,
            isDefault: true,
          },
        ],
      };

      if (!isEdit) {
        payload.openingWalletBalance = formData.openingWalletBalance;
        payload.openingJarBalance = formData.openingJarBalance;
        payload.password = formData.password || undefined;
        payload.generateRandomPassword = formData.generateRandomPassword;

        await fetchWithAuth('/customer', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success('Customer registered successfully');
        navigate(basePath);
      } else {
        if (formData.password) {
          payload.password = formData.password;
        }
        await fetchWithAuth(`/customer/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast.success('Customer updated successfully');
        navigate(basePath);
      }
    } catch (err: any) {
      const msg = err.message || `Failed to ${isEdit ? 'update' : 'create'} customer`;
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (fetchingData) {
    return (
      <div className="bg-white p-10 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col items-center justify-center">
        <RefreshCw className="w-5 h-5 animate-spin text-[#1677C8] mb-2" />
        <p className="text-xs font-bold text-slate-700">Loading customer account details...</p>
      </div>
    );
  }

  const isCommercial =
    formData.customerType === 'COMMERCIAL' || formData.customerType === 'OFFICE';

  return (
    <div className="space-y-3 animate-in fade-in duration-150">
      {/* ─── COMPACT TOP ACTION TOOLBAR ─────────────────────────────── */}
      <div className="bg-white px-3.5 py-2.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(basePath)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
            <span>Back to Customers</span>
          </button>
          <span className="text-xs font-bold text-slate-800 hidden sm:inline">
            {isEdit ? 'Editing Customer Account' : 'New Customer Registration'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(basePath)}
            className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-600 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="customer-onboarding-form"
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#1677C8] hover:bg-[#125ea0] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>{isEdit ? 'Saving...' : 'Creating...'}</span>
              </>
            ) : (
              <>
                {isEdit ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{isEdit ? 'Save Changes' : 'Create Customer'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ─── ERROR BANNER ───────────────────────────────────────────── */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs font-semibold text-rose-700">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {/* ─── DENSE HORIZONTAL GRID FORM CONTAINER ─────────────────────── */}
      <form
        id="customer-onboarding-form"
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-5 space-y-4"
      >
        {/* ─── SECTION 1: CUSTOMER INFORMATION ──────────────────────── */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#1677C8]" />
              Customer Information
            </span>
            <span className="text-[10px] text-slate-400 font-semibold">* Required fields</span>
          </div>

          {/* Row 1: 4 columns on desktop */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                First Name <span className="text-rose-500">*</span>
              </label>
              <input
                required
                name="firstName"
                value={formData.firstName}
                onChange={handleFormChange}
                placeholder="First name"
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1677C8] focus:bg-white transition-all"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Last Name <span className="text-rose-500">*</span>
              </label>
              <input
                required
                name="lastName"
                value={formData.lastName}
                onChange={handleFormChange}
                placeholder="Last name"
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1677C8] focus:bg-white transition-all"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Phone Number <span className="text-rose-500">*</span>
              </label>
              <input
                required
                name="phone"
                minLength={10}
                value={formData.phone}
                onChange={handleFormChange}
                placeholder="10-digit mobile"
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1677C8] focus:bg-white transition-all font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Customer Type</label>
              <select
                name="customerType"
                value={formData.customerType}
                onChange={handleFormChange}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1677C8] focus:bg-white transition-all"
              >
                <option value="RESIDENTIAL">Residential</option>
                <option value="COMMERCIAL">Commercial</option>
                <option value="OFFICE">Office</option>
                <option value="APARTMENT">Apartment</option>
              </select>
            </div>
          </div>

          {/* Row 2: Email + Optional Business Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <div className={isCommercial ? 'lg:col-span-2' : 'lg:col-span-4'}>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleFormChange}
                placeholder="customer@example.com (optional)"
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1677C8] focus:bg-white transition-all"
              />
            </div>

            {isCommercial && (
              <>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Company Name
                  </label>
                  <input
                    name="companyName"
                    value={formData.companyName}
                    onChange={handleFormChange}
                    placeholder="e.g. Acme Corp"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1677C8] focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">GST Number</label>
                  <input
                    name="gstNumber"
                    value={formData.gstNumber}
                    onChange={handleFormChange}
                    placeholder="22AAAAA0000A1Z5"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1677C8] focus:bg-white transition-all font-mono uppercase"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* ─── SECTION 2: DELIVERY ADDRESS ─────────────────────────── */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#1677C8]" />
              Delivery Address
            </span>
            <button
              type="button"
              onClick={() => setShowMapPicker(!showMapPicker)}
              className="text-[11px] font-bold text-[#1677C8] hover:underline flex items-center gap-1 cursor-pointer"
            >
              {showMapPicker ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              <span>{showMapPicker ? 'Hide Map Picker' : 'Pin On Map'}</span>
            </button>
          </div>

          {/* Row 1: House, Building, Landmark */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                House / Flat No.
              </label>
              <input
                name="houseName"
                value={addressData.houseName}
                onChange={handleAddressChange}
                placeholder="e.g. Flat 304"
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1677C8] focus:bg-white transition-all"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Building Name</label>
              <input
                name="buildingName"
                value={addressData.buildingName}
                onChange={handleAddressChange}
                placeholder="e.g. Skyline Residency"
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1677C8] focus:bg-white transition-all"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Landmark</label>
              <input
                name="landmark"
                value={addressData.landmark}
                onChange={handleAddressChange}
                placeholder="e.g. Near Metro Station"
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1677C8] focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Row 2: Street / Road | Area / Locality */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Street / Road <span className="text-rose-500">*</span>
              </label>
              <input
                required
                minLength={3}
                name="street"
                value={addressData.street}
                onChange={handleAddressChange}
                placeholder="e.g. 5th Main Road"
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1677C8] focus:bg-white transition-all"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Area / Locality</label>
              <input
                name="area"
                value={addressData.area}
                onChange={handleAddressChange}
                placeholder="e.g. Indiranagar Stage 2"
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1677C8] focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Row 3: City | District | State | Pincode */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                City <span className="text-rose-500">*</span>
              </label>
              <input
                required
                minLength={2}
                name="city"
                value={addressData.city}
                onChange={handleAddressChange}
                placeholder="City"
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1677C8] focus:bg-white transition-all"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">District</label>
              <input
                name="district"
                value={addressData.district}
                onChange={handleAddressChange}
                placeholder="District"
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1677C8] focus:bg-white transition-all"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                State <span className="text-rose-500">*</span>
              </label>
              <input
                required
                minLength={2}
                name="state"
                value={addressData.state}
                onChange={handleAddressChange}
                placeholder="State"
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1677C8] focus:bg-white transition-all"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Pincode <span className="text-rose-500">*</span>
              </label>
              <input
                required
                minLength={4}
                maxLength={10}
                name="zipCode"
                value={addressData.zipCode}
                onChange={handleAddressChange}
                placeholder="Pincode"
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1677C8] focus:bg-white transition-all font-mono"
              />
            </div>
          </div>

          {/* Interactive Map Location Picker (Compact / Collapsible) */}
          {showMapPicker && (
            <div className="pt-2 animate-in fade-in duration-200">
              <LocationPicker
                onLocationSelected={handleLocationSelected}
                defaultLat={addressData.latitude}
                defaultLng={addressData.longitude}
              />
            </div>
          )}
        </div>

        {/* ─── SECTION 3: ACCOUNT & SECURITY ───────────────────────── */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-[#1677C8]" />
              Account & Security Setup
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {!isEdit ? (
              <>
                <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/80">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Opening Wallet Balance (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    name="openingWalletBalance"
                    value={formData.openingWalletBalance}
                    onChange={handleFormChange}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1677C8] transition-all"
                  />
                </div>

                <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/80">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Opening Jar Balance
                  </label>
                  <input
                    type="number"
                    min="0"
                    name="openingJarBalance"
                    value={formData.openingJarBalance}
                    onChange={handleFormChange}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1677C8] transition-all"
                  />
                </div>

                <div className="lg:col-span-2 bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/80 space-y-1.5">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      name="generateRandomPassword"
                      checked={formData.generateRandomPassword}
                      onChange={handleFormChange}
                      className="w-4 h-4 text-[#1677C8] rounded focus:ring-[#1677C8]"
                    />
                    <span className="text-[11px] text-slate-700 font-semibold">
                      Auto-generate random password & send welcome SMS/email
                    </span>
                  </label>

                  {!formData.generateRandomPassword && (
                    <div className="flex items-center gap-2 pt-0.5">
                      <input
                        type="text"
                        name="password"
                        value={formData.password}
                        onChange={handleFormChange}
                        placeholder="Enter password"
                        className="flex-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1677C8] transition-all"
                      />
                      <button
                        type="button"
                        onClick={generatePassword}
                        className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
                      >
                        Preview
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="lg:col-span-4 bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/80">
                <span className="text-[11px] font-bold text-slate-700 block mb-1">
                  Change Password (optional)
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    name="password"
                    value={formData.password}
                    onChange={handleFormChange}
                    placeholder="Leave blank to retain current password"
                    className="flex-1 max-w-md px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1677C8] transition-all"
                  />
                  <button
                    type="button"
                    onClick={generatePassword}
                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Generate Random
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─── FOOTER ACTIONS ────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={() => navigate(basePath)}
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#1677C8] hover:bg-[#125ea0] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>{isEdit ? 'Saving...' : 'Creating...'}</span>
              </>
            ) : (
              <>
                {isEdit ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{isEdit ? 'Save Changes' : 'Create Customer'}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
