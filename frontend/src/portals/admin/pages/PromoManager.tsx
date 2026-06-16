import { 
  Tag, Plus, Search, Trash2, Edit, CheckCircle, XCircle, Percent, Gift, Truck, Key, Activity 
} from 'lucide-react';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';

interface PromoCodeForm {
  id?: string;
  code: string;
  campaignName: string;
  campaignDescription?: string;
  campaignStartDate?: string;
  campaignEndDate?: string | null;
  type: string;
  discountValue?: number;
  maxUses?: number | null;
  minimumOrderAmount: number;
  maximumDiscountAmount?: number | null;
  perUserLimit: number;
  startDate?: string;
  endDate?: string | null;
  isActive: boolean;
}

export default function PromoManager() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<PromoCodeForm | null>(null);

  // Form State
  const [form, setForm] = useState<PromoCodeForm>({
    code: '',
    campaignName: 'General Promo',
    campaignDescription: '',
    type: 'PERCENTAGE',
    discountValue: 0,
    maxUses: null,
    minimumOrderAmount: 0,
    maximumDiscountAmount: null,
    perUserLimit: 1,
    isActive: true,
  });

  // Queries
  const { data: promoList = [], isLoading: isListLoading } = useQuery({
    queryKey: ['adminPromos'],
    queryFn: () => fetchWithAuth('/promo/admin/list')
  });

  const { data: promoStats, isLoading: isStatsLoading } = useQuery({
    queryKey: ['adminPromoStats'],
    queryFn: () => fetchWithAuth('/promo/admin/stats')
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (newPromo: PromoCodeForm) => 
      fetchWithAuth('/promo/admin', {
        method: 'POST',
        body: JSON.stringify(newPromo),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPromos'] });
      queryClient.invalidateQueries({ queryKey: ['adminPromoStats'] });
      toast.success('Promo code created successfully!');
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create promo code');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PromoCodeForm> }) => 
      fetchWithAuth(`/promo/admin/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPromos'] });
      queryClient.invalidateQueries({ queryKey: ['adminPromoStats'] });
      toast.success('Promo code updated successfully!');
      setIsModalOpen(false);
      setEditingCode(null);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update promo code');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => 
      fetchWithAuth(`/promo/admin/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPromos'] });
      queryClient.invalidateQueries({ queryKey: ['adminPromoStats'] });
      toast.success('Promo code deleted');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete promo code');
    }
  });

  const resetForm = () => {
    setForm({
      code: '',
      campaignName: 'General Promo',
      campaignDescription: '',
      type: 'PERCENTAGE',
      discountValue: 0,
      maxUses: null,
      minimumOrderAmount: 0,
      maximumDiscountAmount: null,
      perUserLimit: 1,
      isActive: true,
    });
  };

  const handleOpenCreateModal = () => {
    setEditingCode(null);
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (promo: any) => {
    const formatted: PromoCodeForm = {
      id: promo.id,
      code: promo.code,
      campaignName: promo.campaign?.name || 'General Promo',
      campaignDescription: promo.campaign?.description || '',
      campaignStartDate: promo.campaign?.startDate ? new Date(promo.campaign.startDate).toISOString().split('T')[0] : undefined,
      campaignEndDate: promo.campaign?.endDate ? new Date(promo.campaign.endDate).toISOString().split('T')[0] : null,
      type: promo.type,
      discountValue: promo.discountValue,
      maxUses: promo.maxUses,
      minimumOrderAmount: promo.minimumOrderAmount,
      maximumDiscountAmount: promo.maximumDiscountAmount,
      perUserLimit: promo.perUserLimit,
      startDate: promo.startDate ? new Date(promo.startDate).toISOString().split('T')[0] : undefined,
      endDate: promo.endDate ? new Date(promo.endDate).toISOString().split('T')[0] : null,
      isActive: promo.isActive,
    };
    setEditingCode(formatted);
    setForm(formatted);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim()) return toast.error('Code is required');

    const payload = {
      ...form,
      code: form.code.toUpperCase().trim(),
      discountValue: Number(form.discountValue),
      minimumOrderAmount: Number(form.minimumOrderAmount),
      maximumDiscountAmount: form.maximumDiscountAmount ? Number(form.maximumDiscountAmount) : null,
      maxUses: form.maxUses ? Number(form.maxUses) : null,
      perUserLimit: Number(form.perUserLimit),
    };

    if (editingCode?.id) {
      updateMutation.mutate({ id: editingCode.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleToggleStatus = (promo: any) => {
    updateMutation.mutate({ 
      id: promo.id, 
      data: { isActive: !promo.isActive } 
    });
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this promo code? This action is permanent.')) {
      deleteMutation.mutate(id);
    }
  };

  const filteredPromos = promoList.filter((promo: any) => {
    const term = search.toLowerCase();
    return (
      promo.code.toLowerCase().includes(term) ||
      (promo.campaign?.name || '').toLowerCase().includes(term) ||
      (promo.description || '').toLowerCase().includes(term)
    );
  });

  const getPromoIcon = (type: string) => {
    switch (type) {
      case 'PERCENTAGE':
        return <Percent className="w-4 h-4 text-emerald-600" />;
      case 'FREE_SHIPPING':
        return <Truck className="w-4 h-4 text-blue-600" />;
      case 'FIRST_ORDER':
        return <Key className="w-4 h-4 text-amber-600" />;
      case 'SUBSCRIPTION':
        return <Activity className="w-4 h-4 text-violet-600" />;
      default:
        return <Gift className="w-4 h-4 text-rose-600" />;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Tag className="w-8 h-8 text-[#2D79A8]" /> Promo Codes & Campaigns
          </h1>
          <p className="text-slate-500 font-semibold mt-1">Create, configure, and monitor promo discounts and marketing campaigns.</p>
        </div>
        <button 
          onClick={handleOpenCreateModal}
          className="flex items-center gap-2 bg-[#2D79A8] hover:bg-[#2D79A8]/90 text-white px-6 py-3 rounded-full font-black shadow-lg shadow-[#2D79A8]/20 transition-all active:scale-95 cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          Create Promo Code
        </button>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/20 flex items-center gap-4">
          <div className="p-4 rounded-2xl bg-[#EBF5FB] text-[#2D79A8]">
            <Tag className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-400">Total Promo Codes</p>
            <h3 className="text-2xl font-black text-slate-800">{isStatsLoading ? '...' : promoStats?.totalCodes}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/20 flex items-center gap-4">
          <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-600">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-400">Active Coupons</p>
            <h3 className="text-2xl font-black text-slate-800">{isStatsLoading ? '...' : promoStats?.activeCodes}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/20 flex items-center gap-4">
          <div className="p-4 rounded-2xl bg-indigo-50 text-indigo-600">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-400">Total Redemptions</p>
            <h3 className="text-2xl font-black text-slate-800">{isStatsLoading ? '...' : promoStats?.usageCount}</h3>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex gap-4">
          <div className="relative w-full max-w-md">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Search by code or campaign name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 rounded-full border border-slate-200 bg-white shadow-sm focus:border-[#2D79A8] focus:ring-2 focus:ring-[#2D79A8]/20 transition-all font-medium text-sm text-[#245361]"
            />
          </div>
        </div>

        {isListLoading ? (
          <div className="text-center py-20">
            <div className="w-10 h-10 border-4 border-[#2D79A8]/20 border-t-[#2D79A8] rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-500 font-medium">Loading coupon configurations...</p>
          </div>
        ) : filteredPromos.length === 0 ? (
          <div className="text-center py-20">
            <Tag className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-black text-slate-700">No Promo Codes Found</h3>
            <p className="text-slate-500 font-medium max-w-md mx-auto mt-2">
              Get started by clicking 'Create Promo Code'.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm font-semibold border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[#245361] uppercase tracking-wider text-[10px] font-black bg-slate-50/50">
                  <th className="py-3.5 px-6">Coupon Code</th>
                  <th className="py-3.5 px-4">Campaign Name</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Discount Value</th>
                  <th className="py-3.5 px-4">Min. Spend</th>
                  <th className="py-3.5 px-4">Usage Limits</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPromos.map((promo: any) => (
                  <tr key={promo.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="py-4.5 px-6">
                      <div>
                        <span className="bg-slate-100 text-slate-800 px-3 py-1.5 rounded-full text-xs font-black border border-slate-200">
                          {promo.code}
                        </span>
                        {promo.description && (
                          <p className="text-[10px] text-slate-400 mt-2 font-medium max-w-[200px] truncate">{promo.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="py-4.5 px-4">
                      <p className="text-slate-800 font-bold">{promo.campaign?.name || 'General Campaign'}</p>
                    </td>
                    <td className="py-4.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="p-1 rounded bg-slate-100">
                          {getPromoIcon(promo.type)}
                        </span>
                        <span className="text-xs text-slate-500 font-black">{promo.type}</span>
                      </div>
                    </td>
                    <td className="py-4.5 px-4">
                      <p className="text-slate-850 font-black">
                        {promo.type === 'PERCENTAGE' ? `${promo.discountValue}%` : `₹${promo.discountValue}`}
                      </p>
                      {promo.maximumDiscountAmount && (
                        <p className="text-[10px] text-emerald-600 font-bold">Cap: ₹{promo.maximumDiscountAmount}</p>
                      )}
                    </td>
                    <td className="py-4.5 px-4">
                      <p className="text-slate-600 font-bold">₹{promo.minimumOrderAmount}</p>
                    </td>
                    <td className="py-4.5 px-4 space-y-0.5">
                      <p className="text-slate-700 text-xs font-bold">
                        Uses: {promo.currentUses} / {promo.maxUses !== null ? promo.maxUses : '∞'}
                      </p>
                      <p className="text-[10px] text-slate-400 font-bold">
                        Limit per user: {promo.perUserLimit}
                      </p>
                    </td>
                    <td className="py-4.5 px-4">
                      <button 
                        onClick={() => handleToggleStatus(promo)}
                        className={`flex items-center gap-1 text-xs font-bold py-1 px-2.5 rounded-full border cursor-pointer transition-all ${
                          promo.isActive 
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-600' 
                            : 'bg-rose-50 border-rose-200 text-rose-600'
                        }`}
                      >
                        {promo.isActive ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        {promo.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="py-4.5 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleOpenEditModal(promo)}
                          className="p-1.5 text-slate-400 hover:text-[#2D79A8] rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(promo.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-full hover:bg-rose-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Redemptions Section */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 p-6">
        <h3 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-600" /> Recent Redemption Log
        </h3>
        {isStatsLoading ? (
          <p className="text-slate-400 text-sm">Loading redemptions...</p>
        ) : !promoStats?.redemptions || promoStats.redemptions.length === 0 ? (
          <p className="text-slate-400 text-sm font-semibold py-4">No promo code redemptions logged yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm font-semibold border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[#245361] uppercase tracking-wider text-[10px] font-black bg-slate-50/50">
                  <th className="py-2.5 px-4">Customer</th>
                  <th className="py-2.5 px-4">Phone</th>
                  <th className="py-2.5 px-4">Redeemed Code</th>
                  <th className="py-2.5 px-4">Redeemed At</th>
                </tr>
              </thead>
              <tbody>
                {promoStats.redemptions.map((red: any) => (
                  <tr key={red.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 text-slate-800 font-bold">
                      {red.customer?.user?.firstName} {red.customer?.user?.lastName}
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-semibold">
                      {red.customer?.user?.phone}
                    </td>
                    <td className="py-3 px-4">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-black">
                        {red.promoCode?.code}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-xs font-semibold">
                      {new Date(red.redeemedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Form Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-[28px] p-6 shadow-2xl border border-slate-100 flex flex-col my-8">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-4">
              <h2 className="text-xl font-black text-slate-800">
                {editingCode ? `Edit Promo Code: ${editingCode.code}` : 'Create New Promo Code'}
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:bg-slate-50 p-2 rounded-full cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-left overflow-y-auto max-h-[70vh] pr-1">
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1">Coupon Code (Uppercase, Unique)</label>
                <input 
                  type="text" 
                  value={form.code}
                  onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. MONSOON30"
                  disabled={!!editingCode}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl font-bold uppercase focus:border-[#2D79A8] focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1">Campaign Name</label>
                  <input 
                    type="text" 
                    value={form.campaignName}
                    onChange={e => setForm({ ...form, campaignName: e.target.value })}
                    placeholder="e.g. Summer Sale"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl font-semibold focus:border-[#2D79A8] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1">Campaign Details</label>
                  <input 
                    type="text" 
                    value={form.campaignDescription || ''}
                    onChange={e => setForm({ ...form, campaignDescription: e.target.value })}
                    placeholder="e.g. 20% off for summer season"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl font-semibold focus:border-[#2D79A8] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1">Promo Type</label>
                  <select 
                    value={form.type}
                    onChange={e => setForm({ ...form, type: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 bg-white rounded-xl font-bold focus:border-[#2D79A8] focus:outline-none cursor-pointer"
                  >
                    <option value="PERCENTAGE">PERCENTAGE</option>
                    <option value="FIXED_DISCOUNT">FIXED_DISCOUNT</option>
                    <option value="FREE_SHIPPING">FREE_SHIPPING</option>
                    <option value="FIRST_ORDER">FIRST_ORDER</option>
                    <option value="SUBSCRIPTION">SUBSCRIPTION</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1">Discount Value (% or ₹)</label>
                  <input 
                    type="number" 
                    value={form.discountValue || 0}
                    onChange={e => setForm({ ...form, discountValue: Number(e.target.value) })}
                    disabled={form.type === 'FREE_SHIPPING'}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl font-bold focus:border-[#2D79A8] focus:outline-none disabled:bg-slate-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1">Min. Spend Limit (₹)</label>
                  <input 
                    type="number" 
                    value={form.minimumOrderAmount}
                    onChange={e => setForm({ ...form, minimumOrderAmount: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl font-bold focus:border-[#2D79A8] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1">Max. Discount Cap (₹)</label>
                  <input 
                    type="number" 
                    value={form.maximumDiscountAmount || ''}
                    onChange={e => setForm({ ...form, maximumDiscountAmount: e.target.value ? Number(e.target.value) : null })}
                    placeholder="None"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl font-bold focus:border-[#2D79A8] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1">Total Max Uses</label>
                  <input 
                    type="number" 
                    value={form.maxUses || ''}
                    onChange={e => setForm({ ...form, maxUses: e.target.value ? Number(e.target.value) : null })}
                    placeholder="Unlimited"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl font-bold focus:border-[#2D79A8] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1">Per User Limit</label>
                  <input 
                    type="number" 
                    value={form.perUserLimit}
                    onChange={e => setForm({ ...form, perUserLimit: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl font-bold focus:border-[#2D79A8] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1">Start Date</label>
                  <input 
                    type="date" 
                    value={form.startDate || ''}
                    onChange={e => setForm({ ...form, startDate: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl font-semibold focus:border-[#2D79A8] focus:outline-none cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1">End Date</label>
                  <input 
                    type="date" 
                    value={form.endDate || ''}
                    onChange={e => setForm({ ...form, endDate: e.target.value || null })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl font-semibold focus:border-[#2D79A8] focus:outline-none cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox" 
                  id="isActive"
                  checked={form.isActive}
                  onChange={e => setForm({ ...form, isActive: e.target.checked })}
                  className="w-4 h-4 text-[#2D79A8] border-slate-300 rounded cursor-pointer"
                />
                <label htmlFor="isActive" className="text-sm font-bold text-slate-600 cursor-pointer">
                  Promo code is active and ready to use
                </label>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="w-1/2 py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-full font-black text-sm active:scale-95 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="w-1/2 py-3 bg-[#2D79A8] hover:bg-[#2D79A8]/90 text-white rounded-full font-black text-sm active:scale-95 transition-all shadow-lg shadow-[#2D79A8]/20 cursor-pointer flex items-center justify-center"
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save Config'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
