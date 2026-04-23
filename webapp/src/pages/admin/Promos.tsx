import React, { useState, useEffect } from "react"
import { Plus, Ticket, Search, CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { ClayCard, ClayButton, ClayInput } from "../../components/ui/ClayComponents"
import { useAdminPromos, adminApi } from "../../lib/api"

export default function Promos() {
  const [searchTerm, setSearchTerm] = useState("")
  const { data: promos, loading, error, refetch } = useAdminPromos()
  const [isToggling, setIsToggling] = useState<string | null>(null)

  // Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [formData, setFormData] = useState({
    code: "",
    discountType: "FLAT",
    discountValue: "",
    minOrderAmount: "0",
    maxDiscountAmount: "",
    usageLimit: "",
    usagePerUser: "1",
    expiryDate: ""
  })

  useEffect(() => {
    refetch()
  }, [])

  const handleToggle = async (id: string) => {
    setIsToggling(id)
    try {
      await adminApi.togglePromo(id)
      refetch()
    } catch (err) {
      alert("Failed to toggle promo status")
    } finally {
      setIsToggling(null)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreating(true)
    try {
      await adminApi.createPromo({
        ...formData,
        discountValue: Number(formData.discountValue),
        minOrderAmount: Number(formData.minOrderAmount),
        maxDiscountAmount: formData.maxDiscountAmount ? Number(formData.maxDiscountAmount) : null,
        usageLimit: formData.usageLimit ? Number(formData.usageLimit) : null,
        usagePerUser: Number(formData.usagePerUser),
      })
      setIsModalOpen(false)
      setFormData({
        code: "",
        discountType: "FLAT",
        discountValue: "",
        minOrderAmount: "0",
        maxDiscountAmount: "",
        usageLimit: "",
        usagePerUser: "1",
        expiryDate: ""
      })
      refetch()
    } catch (err: any) {
      alert(err.message || "Failed to create promo code")
    } finally {
      setIsCreating(false)
    }
  }

  const filteredPromos = (promos || []).filter(p =>
    p.code.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-black italic">Promos & Discounts</h1>
          <p className="text-slate-500 mt-2">Manage promo codes, view usage, and configure rules.</p>
        </div>
        <ClayButton onClick={() => setIsModalOpen(true)} className="gap-2 font-bold px-6">
          <Plus size={20} /> Create Promo
        </ClayButton>
      </div>

      {/* Create Modal Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <ClayCard className="w-full max-w-xl p-8! border-none shadow-2xl scale-in-center overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black italic">New Promo Code</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle size={24} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Promo Code</label>
                  <ClayInput
                    required
                    placeholder="E.g. SUMMER50"
                    className="uppercase font-bold"
                    value={formData.code}
                    onChange={e => setFormData({ ...formData, code: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Discount Type</label>
                  <select
                    className="clay-input w-full font-bold"
                    value={formData.discountType}
                    onChange={e => setFormData({ ...formData, discountType: e.target.value })}
                  >
                    <option value="FLAT">Flat Amount (₹)</option>
                    <option value="PERCENTAGE">Percentage (%)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Value</label>
                  <ClayInput
                    required
                    type="number"
                    placeholder="Amount or %"
                    value={formData.discountValue}
                    onChange={e => setFormData({ ...formData, discountValue: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Min Order Amount</label>
                  <ClayInput
                    type="number"
                    placeholder="₹ 0"
                    value={formData.minOrderAmount}
                    onChange={e => setFormData({ ...formData, minOrderAmount: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Usage Limit (Global)</label>
                  <ClayInput
                    type="number"
                    placeholder="Unlimited"
                    value={formData.usageLimit}
                    onChange={e => setFormData({ ...formData, usageLimit: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Limit Per User</label>
                  <ClayInput
                    type="number"
                    placeholder="1"
                    value={formData.usagePerUser}
                    onChange={e => setFormData({ ...formData, usagePerUser: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Expiry Date</label>
                <ClayInput
                  type="date"
                  value={formData.expiryDate}
                  onChange={e => setFormData({ ...formData, expiryDate: e.target.value })}
                />
              </div>

              <div className="pt-4 flex gap-3">
                <ClayButton
                  type="button"
                  variant="secondary"
                  className="flex-1 font-bold"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </ClayButton>
                <ClayButton
                  type="submit"
                  disabled={isCreating}
                  className="flex-1 font-bold gap-2"
                >
                  {isCreating ? <Loader2 className="animate-spin" size={18} /> : "Create Promo"}
                </ClayButton>
              </div>
            </form>
          </ClayCard>
        </div>
      )}

      <ClayCard className="p-6! border-none">
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <ClayInput
              placeholder="Search promo codes..."
              className="pl-10 h-12 rounded-2xl"
              value={searchTerm}
              onChange={(e: any) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center flex flex-col items-center gap-3">
            <Loader2 className="animate-spin text-primary" size={40} />
            <p className="font-bold text-slate-400">Loading system promos...</p>
          </div>
        ) : error ? (
          <div className="py-20 text-center text-rose-500 bg-rose-50 rounded-4xl font-bold">
            {error}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] text-slate-400 uppercase tracking-widest bg-slate-50/50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-6 py-4 font-black">Code</th>
                  <th className="px-6 py-4 font-black">Discount</th>
                  <th className="px-6 py-4 font-black">Min Order</th>
                  <th className="px-6 py-4 font-black">Usage</th>
                  <th className="px-6 py-4 font-black">Status</th>
                  <th className="px-6 py-4 font-black">Expiry</th>
                  <th className="px-6 py-4 font-black text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPromos.map((promo) => (
                  <tr key={promo.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
                          <Ticket size={18} />
                        </div>
                        <span className="font-extrabold tracking-tighter text-base">{promo.code}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="font-black text-slate-900 dark:text-white">
                        {promo.discountType === "FLAT" ? `₹${promo.discountValue}` : `${promo.discountValue}%`}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-slate-500 font-bold">₹{promo.minOrderAmount}</td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="font-bold">{promo.usedCount} {promo.usageLimit ? `/ ${promo.usageLimit}` : 'claims'}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Total Usage</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      {promo.isActive ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700">
                          <CheckCircle2 size={12} /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-700">
                          <XCircle size={12} /> Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-5 text-slate-500 font-medium italic">
                      {promo.expiryDate ? new Date(promo.expiryDate).toLocaleDateString() : "No Expiry"}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <ClayButton
                        variant="ghost"
                        onClick={() => handleToggle(promo.id)}
                        disabled={isToggling === promo.id}
                        className={`text-xs font-black uppercase tracking-widest ${promo.isActive ? 'text-rose-500' : 'text-emerald-600'}`}
                      >
                        {isToggling === promo.id ? <Loader2 className="animate-spin" size={14} /> : (promo.isActive ? 'Disable' : 'Enable')}
                      </ClayButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ClayCard>
    </div>
  )
}
