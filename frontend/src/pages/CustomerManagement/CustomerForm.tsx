import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchWithAuth } from '../../api/client';

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
    street: '',
    city: '',
    state: '',
    zipCode: '',
    openingWalletBalance: 0,
    openingJarBalance: 0,
    generateRandomPassword: true,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload = {
        ...formData,
        addresses: [{
          street: formData.street,
          city: formData.city,
          state: formData.state,
          zipCode: formData.zipCode,
          country: 'India',
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
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center space-x-4 mb-6">
        <button onClick={() => navigate(basePath)} className="text-gray-500 hover:text-gray-800">
          ← Back
        </button>
        <h1 className="text-2xl font-bold text-gray-800">Add New Customer</h1>
      </div>

      {error && <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-8 bg-white p-8 rounded-xl shadow border border-gray-100">
        
        {/* Section 1: Basic Info */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
              <input required name="firstName" value={formData.firstName} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-[#7EBFE4] focus:border-[#7EBFE4]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
              <input required name="lastName" value={formData.lastName} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-[#7EBFE4] focus:border-[#7EBFE4]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
              <input required name="phone" value={formData.phone} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-[#7EBFE4] focus:border-[#7EBFE4]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-[#7EBFE4] focus:border-[#7EBFE4]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer Type</label>
              <select name="customerType" value={formData.customerType} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-[#7EBFE4] focus:border-[#7EBFE4]">
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
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Business Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                <input name="companyName" value={formData.companyName} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-[#7EBFE4]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GST Number</label>
                <input name="gstNumber" value={formData.gstNumber} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-[#7EBFE4]" />
              </div>
            </div>
          </section>
        )}

        {/* Section 3: Address */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Default Address</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Street Address *</label>
              <input required name="street" value={formData.street} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-[#7EBFE4]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
              <input required name="city" value={formData.city} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-[#7EBFE4]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
              <input required name="state" value={formData.state} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-[#7EBFE4]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pincode *</label>
              <input required name="zipCode" value={formData.zipCode} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-[#7EBFE4]" />
            </div>
          </div>
        </section>

        {/* Section 4: Initial Balances */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Initial Setup</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Opening Wallet Balance (₹)</label>
              <input type="number" min="0" name="openingWalletBalance" value={formData.openingWalletBalance} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-[#7EBFE4]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Opening Jar Balance</label>
              <input type="number" min="0" name="openingJarBalance" value={formData.openingJarBalance} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-[#7EBFE4]" />
            </div>
            <div className="md:col-span-2 flex items-center space-x-2 mt-4">
              <input type="checkbox" id="generateRandomPassword" name="generateRandomPassword" checked={formData.generateRandomPassword} onChange={handleChange} className="w-4 h-4 text-[#F69C14] border-gray-300 rounded focus:ring-[#F69C14]" />
              <label htmlFor="generateRandomPassword" className="text-sm text-gray-700">Generate Random Password & Send Email</label>
            </div>
          </div>
        </section>

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={loading}
            className="bg-[#245361] hover:bg-[#1a3c46] text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Customer'}
          </button>
        </div>
      </form>
    </div>
  );
}
