import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchWithAuth } from '../../api/client';
import LocationPicker from '../../features/location/components/LocationPicker';
import type { GeocodedAddress } from '../../features/location/hooks/useReverseGeocoding';

export default function CustomerForm({ basePath }: { basePath: string }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleLocationSelected = (lat: number, lng: number, address: GeocodedAddress, googleUrl: string) => {
    setAddressData(prev => ({
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
    setAddressData(prev => ({ ...prev, [name]: value }));
  };

  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let generated = "";
    for (let i = 0; i < 10; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, password: generated, generateRandomPassword: false }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        phone: formData.phone.trim(),
        email: formData.email ? formData.email.trim() : undefined,
        customerType: formData.customerType,
        companyName: formData.companyName ? formData.companyName.trim() : undefined,
        gstNumber: formData.gstNumber ? formData.gstNumber.trim() : undefined,
        openingWalletBalance: formData.openingWalletBalance,
        openingJarBalance: formData.openingJarBalance,
        password: formData.password || undefined,
        generateRandomPassword: formData.generateRandomPassword,
        addresses: [{
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
          isDefault: true
        }]
      };

      const res = await fetchWithAuth('/customer', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (res.customerId) {
        navigate(`${basePath}/${res.customerId}`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create customer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center space-x-4 mb-6">
        <button onClick={() => navigate(basePath)} className="text-gray-500 hover:text-[#245361] transition-colors p-2 rounded-full hover:bg-gray-100">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-800 tracking-tight">Add New Customer</h1>
          <p className="text-sm text-gray-500 mt-1">Complete the form below to onboard a new customer.</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 border-l-4 border-red-500 rounded-r-lg flex items-center shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8 bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        
        {/* Section 1: Basic Info */}
        <section>
          <div className="flex items-center space-x-2 mb-5">
            <div className="h-8 w-8 rounded-full bg-[#E5F3FA] text-[#245361] flex items-center justify-center font-bold">1</div>
            <h2 className="text-xl font-semibold text-gray-800">Basic Information</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 ml-10">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name <span className="text-red-500">*</span></label>
              <input required name="firstName" value={formData.firstName} onChange={handleFormChange} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#7EBFE4] focus:border-transparent transition-all outline-none" placeholder="John" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name <span className="text-red-500">*</span></label>
              <input required name="lastName" value={formData.lastName} onChange={handleFormChange} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#7EBFE4] focus:border-transparent transition-all outline-none" placeholder="Doe" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number <span className="text-red-500">*</span></label>
              <input required name="phone" minLength={10} value={formData.phone} onChange={handleFormChange} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#7EBFE4] focus:border-transparent transition-all outline-none" placeholder="9876543210" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" name="email" value={formData.email} onChange={handleFormChange} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#7EBFE4] focus:border-transparent transition-all outline-none" placeholder="john@example.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer Type</label>
              <select name="customerType" value={formData.customerType} onChange={handleFormChange} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#7EBFE4] focus:border-transparent transition-all outline-none bg-white">
                <option value="RESIDENTIAL">Residential</option>
                <option value="COMMERCIAL">Commercial</option>
                <option value="OFFICE">Office</option>
                <option value="APARTMENT">Apartment</option>
              </select>
            </div>
          </div>
        </section>

        {/* Section 2: Business Info */}
        {(formData.customerType === 'COMMERCIAL' || formData.customerType === 'OFFICE') && (
          <section className="animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center space-x-2 mb-5">
              <div className="h-8 w-8 rounded-full bg-[#E5F3FA] text-[#245361] flex items-center justify-center font-bold">2</div>
              <h2 className="text-xl font-semibold text-gray-800">Business Details</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 ml-10">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                <input name="companyName" value={formData.companyName} onChange={handleFormChange} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#7EBFE4] focus:border-transparent transition-all outline-none" placeholder="Acme Corp" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GST Number</label>
                <input name="gstNumber" value={formData.gstNumber} onChange={handleFormChange} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#7EBFE4] focus:border-transparent transition-all outline-none" placeholder="22AAAAA0000A1Z5" />
              </div>
            </div>
          </section>
        )}

        {/* Section 3: Address */}
        <section>
          <div className="flex items-center space-x-2 mb-5">
            <div className="h-8 w-8 rounded-full bg-[#E5F3FA] text-[#245361] flex items-center justify-center font-bold">
              {(formData.customerType === 'COMMERCIAL' || formData.customerType === 'OFFICE') ? '3' : '2'}
            </div>
            <h2 className="text-xl font-semibold text-gray-800">Delivery Address</h2>
          </div>
          <div className="ml-10 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">House / Flat No.</label>
                <input name="houseName" value={addressData.houseName} onChange={handleAddressChange} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#7EBFE4] outline-none transition-all" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Building Name</label>
                <input name="buildingName" value={addressData.buildingName} onChange={handleAddressChange} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#7EBFE4] outline-none transition-all" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Landmark</label>
                <input name="landmark" value={addressData.landmark} onChange={handleAddressChange} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#7EBFE4] outline-none transition-all" placeholder="Near Apollo Hospital" />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Street / Road <span className="text-red-500">*</span></label>
                <input required minLength={3} name="street" value={addressData.street} onChange={handleAddressChange} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#7EBFE4] outline-none transition-all" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Area / Locality</label>
                <input name="area" value={addressData.area} onChange={handleAddressChange} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#7EBFE4] outline-none transition-all" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City <span className="text-red-500">*</span></label>
                <input required minLength={2} name="city" value={addressData.city} onChange={handleAddressChange} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#7EBFE4] outline-none transition-all" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">District</label>
                <input name="district" value={addressData.district} onChange={handleAddressChange} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#7EBFE4] outline-none transition-all" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State <span className="text-red-500">*</span></label>
                <input required minLength={2} name="state" value={addressData.state} onChange={handleAddressChange} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#7EBFE4] outline-none transition-all" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pincode <span className="text-red-500">*</span></label>
                <input required minLength={4} maxLength={10} name="zipCode" value={addressData.zipCode} onChange={handleAddressChange} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#7EBFE4] outline-none transition-all" />
              </div>
            </div>

            {/* Location Picker */}
            <div className="md:col-span-3 mt-2">
              <LocationPicker 
                onLocationSelected={handleLocationSelected}
                defaultLat={addressData.latitude}
                defaultLng={addressData.longitude}
              />
            </div>
          </div>
        </section>

        {/* Section 4: Settings */}
        <section>
          <div className="flex items-center space-x-2 mb-5">
            <div className="h-8 w-8 rounded-full bg-[#E5F3FA] text-[#245361] flex items-center justify-center font-bold">
              {(formData.customerType === 'COMMERCIAL' || formData.customerType === 'OFFICE') ? '4' : '3'}
            </div>
            <h2 className="text-xl font-semibold text-gray-800">Account Setup</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 ml-10">
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
              <label className="block text-sm font-medium text-gray-700 mb-1">Opening Wallet Balance (₹)</label>
              <input type="number" min="0" name="openingWalletBalance" value={formData.openingWalletBalance} onChange={handleFormChange} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#7EBFE4] outline-none transition-all" />
            </div>
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
              <label className="block text-sm font-medium text-gray-700 mb-1">Opening Jar Balance</label>
              <input type="number" min="0" name="openingJarBalance" value={formData.openingJarBalance} onChange={handleFormChange} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#7EBFE4] outline-none transition-all" />
            </div>
            
            <div className="md:col-span-2 space-y-4">
              <h3 className="text-sm font-medium text-gray-800 border-b pb-2">Password Configuration</h3>
              <div className="flex flex-col space-y-3">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input type="checkbox" name="generateRandomPassword" checked={formData.generateRandomPassword} onChange={handleFormChange} className="w-5 h-5 text-[#245361] rounded focus:ring-[#245361]" />
                  <span className="text-gray-700">Generate a random password and send welcome email</span>
                </label>
                
                {!formData.generateRandomPassword && (
                  <div className="flex items-center space-x-2 animate-in fade-in duration-200">
                    <input 
                      type="text" 
                      name="password" 
                      value={formData.password} 
                      onChange={handleFormChange} 
                      placeholder="Enter a custom password" 
                      className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#7EBFE4] outline-none transition-all flex-grow max-w-md"
                    />
                    <button type="button" onClick={generatePassword} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium text-sm">
                      Auto-generate Preview
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="flex justify-end pt-6 border-t mt-8">
          <button
            type="button"
            onClick={() => navigate(basePath)}
            className="px-6 py-3 text-gray-600 font-medium hover:text-gray-800 transition-colors mr-4"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="bg-[#245361] hover:bg-[#1a3c46] text-white px-8 py-3 rounded-xl font-medium transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:transform-none shadow-md flex items-center"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating Customer...
              </>
            ) : 'Complete Onboarding'}
          </button>
        </div>
      </form>
    </div>
  );
}
