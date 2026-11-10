import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Phone,
  Mail,
  MapPin,
  Tag,
  Copy,
  Check,
  Edit2,
  Factory,
  Package,
  ArrowRightLeft,
  Receipt,
  DollarSign,
  RefreshCw,
  User,
} from 'lucide-react';
import CopyReferralCodeButton from '../../../components/common/CopyReferralCodeButton';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';

interface DistributorDetailDrawerProps {
  isOpen: boolean;
  distributor: any | null;
  onClose: () => void;
  onEdit: (distributor: any) => void;
  onToggleStatus: (distributor: any) => void;
  onRefresh?: () => void;
}

export default function DistributorDetailDrawer({
  isOpen,
  distributor,
  onClose,
  onEdit,
  onToggleStatus,
  onRefresh,
}: DistributorDetailDrawerProps) {
  // Tabs: PROFILE vs TRANSACTIONS
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'TRANSACTIONS'>('PROFILE');

  // Jar Settlement Box
  const [showSettleBox, setShowSettleBox] = useState(false);
  const [settleQty, setSettleQty] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [paymentReference, setPaymentReference] = useState('');
  const [settleNotes, setSettleNotes] = useState('');
  const [isSettling, setIsSettling] = useState(false);

  // Transactions State
  const [sales, setSales] = useState<any[]>([]);
  const [loadingSales, setLoadingSales] = useState(false);

  // Record Payment Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedSaleForPayment, setSelectedSaleForPayment] = useState<any | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<string>('CASH');
  const [payNotes, setPayNotes] = useState<string>('');
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);

  const loadSales = async () => {
    if (!distributor) return;
    try {
      setLoadingSales(true);
      const targetId = distributor.distributorProfileId || distributor.id;
      const data = await fetchWithAuth(`/biodrops/distributor/sales?distributorId=${targetId}`);
      setSales(data || []);
    } catch {
      // Fallback to distributor.sales if present
      if (distributor.sales) {
        setSales(distributor.sales);
      }
    } finally {
      setLoadingSales(false);
    }
  };

  useEffect(() => {
    if (isOpen && distributor) {
      if (distributor.sales && distributor.sales.length > 0) {
        setSales(distributor.sales);
      }
      loadSales();
    }
  }, [isOpen, distributor]);

  if (!isOpen || !distributor) return null;

  const isActive = distributor.isActive !== false;
  const fullName =
    distributor.fullName ||
    `${distributor.firstName || ''} ${distributor.lastName || ''}`.trim() ||
    'Distributor';
  const companyJars = Number(distributor.companyOwnedJars || 0);
  const partnerJars = Number(distributor.distributorOwnedJars || 0);
  const unitRate = Number(distributor.jarDepositRate || 150);

  // Financial aggregates
  const totalSalesAmount = sales.reduce(
    (sum, s) => sum + (Number(s.totalAmount) || 0),
    0,
  );
  const totalPaidAmount = sales.reduce(
    (sum, s) => sum + (Number(s.amountPaid) || 0),
    0,
  );
  const outstandingBalance = sales.reduce(
    (sum, s) => sum + (Number(s.outstandingAmount) || 0),
    0,
  );

  const handleExecuteSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (settleQty <= 0 || settleQty > companyJars) {
      toast.error(`Please enter a quantity between 1 and ${companyJars}`);
      return;
    }

    try {
      setIsSettling(true);
      const targetDistId = distributor.distributorProfileId || distributor.id;
      await fetchWithAuth('/inventory/raw-materials/settle', {
        method: 'POST',
        body: JSON.stringify({
          distributorId: targetDistId,
          jarsToSettle: Number(settleQty),
          unitPrice: unitRate,
          paymentMethod,
          paymentReference: paymentReference.trim() || undefined,
          notes: settleNotes.trim() || undefined,
        }),
      });

      toast.success(
        `Successfully settled ${settleQty} jars! Ownership transferred to distributor without altering physical stock.`,
      );
      setShowSettleBox(false);
      setPaymentReference('');
      setSettleNotes('');
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete jar settlement');
    } finally {
      setIsSettling(false);
    }
  };

  const handleOpenCollectPayment = (sale: any) => {
    setSelectedSaleForPayment(sale);
    setPayAmount(Number(sale.outstandingAmount) || 0);
    setPayMethod('CASH');
    setPayNotes('');
    setPaymentModalOpen(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSaleForPayment || payAmount <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }

    try {
      setIsSubmittingPay(true);
      await fetchWithAuth(`/biodrops/distributor/sales/${selectedSaleForPayment.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(payAmount),
          paymentMethod: payMethod,
          notes: payNotes.trim() || undefined,
        }),
      });

      toast.success(`Payment of ₹${payAmount} recorded successfully!`);
      setPaymentModalOpen(false);
      setSelectedSaleForPayment(null);
      loadSales();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record payment');
    } finally {
      setIsSubmittingPay(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
        />

        {/* ─── CENTERED MODAL DIALOG ───────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-4xl max-h-[92vh] bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/90 flex flex-col z-10 overflow-hidden"
        >
          {/* ─── MODAL HEADER ──────────────────────────────────── */}
          <div className="p-4 sm:p-5 bg-slate-50/90 border-b border-[#E2E8F0] shrink-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-sky-100 text-[#1677C8] flex items-center justify-center font-bold text-lg shadow-sm shrink-0 overflow-hidden">
                  {distributor.avatarUrl ? (
                    <img
                      src={distributor.avatarUrl}
                      alt={fullName}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                        if (e.currentTarget.parentElement) {
                          e.currentTarget.parentElement.innerText = fullName.charAt(0).toUpperCase() || 'D';
                        }
                      }}
                    />
                  ) : (
                    fullName.charAt(0).toUpperCase() || 'D'
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-bold text-[#16324F] truncate">{fullName}</h2>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold shrink-0 ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}
                    >
                      {isActive ? 'Active' : 'Inactive'}
                    </span>
                    {distributor.canManufacture ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold shrink-0 bg-teal-50 text-teal-800 border border-teal-200 flex items-center gap-1">
                        <Factory className="w-3 h-3 text-teal-600" />
                        Manufacturing Authorized
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-medium shrink-0 bg-slate-100 text-slate-600 border border-slate-200">
                        Distribution Only
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-medium text-[#64748B] truncate mt-0.5">
                    {distributor.agencyName || 'Independent Distributor'} · Referral Code:{' '}
                    <span className="font-mono font-bold text-[#1677C8]">{distributor.referralCode}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-2 text-[#64748B] hover:text-[#16324F] hover:bg-slate-200 rounded-xl transition cursor-pointer shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ─── TAB NAVIGATION SWITCHER ───────────────────────── */}
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-200/70">
              <button
                type="button"
                onClick={() => setActiveTab('PROFILE')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'PROFILE'
                    ? 'bg-white text-[#1677C8] shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Profile & Operations</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('TRANSACTIONS')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'TRANSACTIONS'
                    ? 'bg-white text-[#1677C8] shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Transactions & Payments</span>
                {outstandingBalance > 0 ? (
                  <span className="px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-700 text-[10px] font-extrabold animate-pulse">
                    ₹{outstandingBalance.toLocaleString('en-IN')} Due
                  </span>
                ) : (
                  <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 text-[10px]">
                    {sales.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* ─── TAB 1: PROFILE & OPERATIONS ───────────────────── */}
          {activeTab === 'PROFILE' && (
            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 space-y-3.5 sm:space-y-4">
              {/* STAFF-ASSIGNED REFERRAL CODE */}
              <div className="bg-gradient-to-br from-sky-50 to-blue-50/80 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-sky-200/80 shadow-xs relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-[#1677C8] text-white rounded-lg">
                      <Tag className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#1677C8]">
                      Official Referral Code
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold text-sky-700 bg-sky-100/60 px-2 py-0.5 rounded-full">
                    Active Code
                  </span>
                </div>

                <div className="mt-2.5 flex items-center justify-between bg-white p-3 rounded-xl border border-sky-100 shadow-2xs">
                  <div>
                    <span className="text-[11px] text-[#64748B] block font-medium">Distributor Code</span>
                    <span className="text-xl sm:text-2xl font-mono font-extrabold text-[#16324F] tracking-wider block mt-0.5">
                      {distributor.referralCode || 'NOT_ASSIGNED'}
                    </span>
                  </div>
                  {distributor.referralCode && (
                    <CopyReferralCodeButton
                      code={distributor.referralCode}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-[#1677C8] rounded-xl text-xs font-bold transition border border-sky-200 cursor-pointer"
                    >
                      {(copied) => (
                        copied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Code</span>
                          </>
                        )
                      )}
                    </CopyReferralCodeButton>
                  )}
                </div>

                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-1 text-[11px] text-[#64748B]">
                  <span>
                    Created by: <strong className="text-[#16324F]">{distributor.createdBy?.name || 'Staff Admin'}</strong>
                  </span>
                  <span>
                    Assigned:{' '}
                    <strong className="text-[#16324F]">
                      {distributor.createdAt
                        ? new Date(distributor.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—'}
                    </strong>
                  </span>
                </div>
              </div>

              {/* DISTRIBUTOR CONTACT & PROFILE */}
              <div className="bg-slate-50/80 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 space-y-3">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                  Distributor Contact & Profile
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5 text-xs">
                  <div>
                    <span className="text-[#94A3B8] font-medium block">Phone</span>
                    <span className="text-[#16324F] font-bold mt-1 block flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-[#1677C8] shrink-0" />
                      {distributor.phone || '—'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[#94A3B8] font-medium block">Email</span>
                    <span className="text-[#16324F] font-bold mt-1 block flex items-center gap-1.5 truncate">
                      <Mail className="w-3.5 h-3.5 text-[#1677C8] shrink-0" />
                      {distributor.email || '—'}
                    </span>
                  </div>

                  <div className="sm:col-span-2">
                    <span className="text-[#94A3B8] font-medium block">Business Address</span>
                    <span className="text-[#16324F] font-medium mt-1 block flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#1677C8] shrink-0 mt-0.5" />
                      {distributor.address || 'No physical address provided'}
                    </span>
                  </div>
                </div>
              </div>

              {/* INVENTORY & JAR OWNERSHIP (COMMERCIAL LEDGER) */}
              <div className="bg-purple-50/50 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-purple-200/70 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-purple-600 text-white rounded-lg">
                      <Package className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-[#16324F]">20L Jar Commercial Ownership</h3>
                      <p className="text-[10px] text-purple-700">Tracks company-owned vs partner-settled jars</p>
                    </div>
                  </div>
                  <span className="text-xs font-extrabold text-purple-900 bg-purple-100/80 px-2.5 py-1 rounded-lg">
                    Total: {companyJars + partnerJars} Jars
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="bg-white p-3 rounded-xl border border-purple-100 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block">
                      Company Owned (At Distributor)
                    </span>
                    <span className="text-xl font-extrabold text-purple-900 mt-1 block">
                      {companyJars} Jars
                    </span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-purple-100 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                      Partner Owned (Settled)
                    </span>
                    <span className="text-xl font-extrabold text-emerald-800 mt-1 block">
                      {partnerJars} Jars
                    </span>
                  </div>
                </div>

                {/* Settle Jars Trigger */}
                {companyJars > 0 && (
                  <div className="pt-2">
                    {!showSettleBox ? (
                      <button
                        type="button"
                        onClick={() => setShowSettleBox(true)}
                        className="w-full py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        <span>Settle Company Jars (Transfer Ownership)</span>
                      </button>
                    ) : (
                      <form onSubmit={handleExecuteSettlement} className="bg-white p-3.5 rounded-xl border border-purple-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-purple-900">Execute Jar Settlement</span>
                          <button
                            type="button"
                            onClick={() => setShowSettleBox(false)}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 block mb-1">Jars to Settle (Max {companyJars})</label>
                            <input
                              type="number"
                              min={1}
                              max={companyJars}
                              value={settleQty}
                              onChange={(e) => setSettleQty(Number(e.target.value))}
                              className="w-full p-2 border border-slate-200 rounded-lg text-xs font-bold"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 block mb-1">Payment Method</label>
                            <select
                              value={paymentMethod}
                              onChange={(e) => setPaymentMethod(e.target.value)}
                              className="w-full p-2 border border-slate-200 rounded-lg text-xs font-bold"
                            >
                              <option value="BANK_TRANSFER">Bank Transfer</option>
                              <option value="CASH">Cash</option>
                              <option value="UPI">UPI</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setShowSettleBox(false)}
                            className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-bold"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={isSettling}
                            className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition disabled:opacity-50"
                          >
                            {isSettling ? 'Settling...' : `Confirm Settle (${settleQty} Jars = ₹${settleQty * unitRate})`}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </div>

              {/* VEHICLE & LOGISTICS */}
              <div className="bg-slate-50/80 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 space-y-3">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                  Vehicle & Operations
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[#94A3B8] font-medium block">Route / Area</span>
                    <span className="text-[#16324F] font-bold mt-1 block">
                      {distributor.routeOrArea || 'Unassigned'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#94A3B8] font-medium block">Vehicle Plate</span>
                    <span className="text-[#16324F] font-mono font-bold mt-1 block">
                      {distributor.vehiclePlate || 'No Vehicle'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── TAB 2: TRANSACTIONS & PAYMENTS ────────────────── */}
          {activeTab === 'TRANSACTIONS' && (
            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 space-y-4">
              {/* Financial Snapshot Summary */}
              <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block truncate">
                    Total Invoiced
                  </span>
                  <span className="text-base sm:text-lg font-extrabold text-[#16324F] mt-1 block">
                    ₹{totalSalesAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block truncate">
                    Total Paid
                  </span>
                  <span className="text-base sm:text-lg font-extrabold text-emerald-800 mt-1 block">
                    ₹{totalPaidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="bg-rose-50/70 p-3 rounded-xl border border-rose-200 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block truncate">
                    Balance Due (Owed to Us)
                  </span>
                  <span className="text-base sm:text-lg font-extrabold text-rose-700 mt-1 block">
                    ₹{outstandingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Header and Refresh */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-[#16324F] uppercase tracking-wider">
                    Sales & Payment Ledger ({sales.length})
                  </h3>
                  {loadingSales && <RefreshCw className="w-3.5 h-3.5 text-[#1677C8] animate-spin" />}
                </div>

                <button
                  type="button"
                  onClick={loadSales}
                  disabled={loadingSales}
                  className="p-1.5 text-slate-500 hover:text-[#1677C8] bg-slate-50 hover:bg-slate-100 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingSales ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {/* Transactions List */}
              {loadingSales && sales.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">Loading transactions...</div>
              ) : sales.length === 0 ? (
                <div className="p-8 text-center bg-slate-50/70 border border-slate-200 rounded-2xl">
                  <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-700">No Sales or Transactions Recorded</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    When you record a product sale for this distributor, invoices and payments will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sales.map((sale: any) => {
                    const isPaid = sale.paymentStatus === 'PAID';
                    const isPartial = sale.paymentStatus === 'PARTIAL';

                    return (
                      <div
                        key={sale.id}
                        className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-slate-300 transition space-y-2.5"
                      >
                        {/* Top row: Invoice No, Date, Status */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-[#1677C8]">
                              {sale.invoiceNumber}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(sale.saleDate).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isPaid
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : isPartial
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {sale.paymentStatus}
                            </span>

                            {Number(sale.outstandingAmount) > 0 && (
                              <button
                                type="button"
                                onClick={() => handleOpenCollectPayment(sale)}
                                className="px-2.5 py-1 bg-[#1677C8] hover:bg-[#1363a8] text-white rounded-lg text-[10px] font-bold transition shadow-xs cursor-pointer flex items-center gap-1"
                              >
                                <DollarSign className="w-3 h-3" />
                                <span>Record Payment</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Items Sold */}
                        <div className="bg-slate-50/70 p-2 rounded-xl text-xs space-y-1">
                          {sale.items?.map((item: any) => (
                            <div key={item.id} className="flex justify-between items-center text-[11px]">
                              <span className="font-medium text-slate-700">
                                {item.product?.name || 'Product'} × {item.quantity}
                              </span>
                              <span className="font-mono text-slate-800 font-bold">
                                ₹{item.totalAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Financial Line: Total, Paid, Due */}
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 flex-wrap gap-2">
                          <div className="flex items-center gap-4">
                            <div>
                              <span className="text-[10px] text-slate-400 block">Total Bill</span>
                              <span className="font-bold text-slate-900">
                                ₹{sale.totalAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block">Paid</span>
                              <span className="font-bold text-emerald-700">
                                ₹{sale.amountPaid?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block">Balance Due</span>
                              <span className={`font-bold ${Number(sale.outstandingAmount) > 0 ? 'text-rose-700' : 'text-slate-400'}`}>
                                ₹{sale.outstandingAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>

                          {sale.notes && (
                            <p className="text-[11px] text-slate-500 italic max-w-xs truncate">
                              Note: {sale.notes}
                            </p>
                          )}
                        </div>

                        {/* Payment logs if partial / multiple */}
                        {Array.isArray(sale.payments) && sale.payments.length > 0 && (
                          <div className="pt-1.5 border-t border-dashed border-slate-200">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                              Payment Logs ({sale.payments.length})
                            </span>
                            <div className="space-y-1">
                              {sale.payments.map((p: any, idx: number) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between text-[10px] text-slate-600 bg-slate-50/50 px-2 py-0.5 rounded"
                                >
                                  <span>
                                    {new Date(p.date).toLocaleDateString('en-IN')} · Method: <strong>{p.method}</strong>
                                    {p.notes && ` (${p.notes})`}
                                  </span>
                                  <span className="font-bold text-emerald-700">
                                    +₹{Number(p.amount).toLocaleString('en-IN')}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ─── MODAL FOOTER ──────────────────────────────────── */}
          <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-[#E2E8F0] shrink-0 flex items-center justify-between gap-2.5">
            <button
              onClick={() => onToggleStatus(distributor)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer border text-center ${
                isActive
                  ? 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
              }`}
            >
              {isActive ? 'Deactivate Account' : 'Activate Account'}
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[#64748B] hover:bg-slate-200 transition cursor-pointer text-center"
              >
                Close
              </button>
              <button
                onClick={() => {
                  onClose();
                  onEdit(distributor);
                }}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-[#1677C8] hover:bg-[#1363a8] text-white shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Edit Profile
              </button>
            </div>
          </div>
        </motion.div>

        {/* ─── RECORD PAYMENT MINI-MODAL ───────────────────────── */}
        {paymentModalOpen && selectedSaleForPayment && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-800">Record Payment</h4>
                  <p className="text-[11px] text-slate-400">
                    Invoice: <span className="font-mono font-bold text-[#1677C8]">{selectedSaleForPayment.invoiceNumber}</span>
                  </p>
                </div>
                <button
                  onClick={() => setPaymentModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Invoice Amount:</span>
                  <span className="font-bold text-slate-800">₹{selectedSaleForPayment.totalAmount?.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Already Paid:</span>
                  <span className="font-bold text-emerald-700">₹{selectedSaleForPayment.amountPaid?.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1">
                  <span className="text-slate-600 font-bold">Outstanding Balance:</span>
                  <span className="font-bold text-rose-700">₹{selectedSaleForPayment.outstandingAmount?.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <form onSubmit={handleRecordPayment} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Payment Amount to Receive (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0.01}
                    max={Number(selectedSaleForPayment.outstandingAmount)}
                    value={payAmount}
                    onChange={(e) => setPayAmount(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono font-bold text-slate-800 focus:outline-none focus:border-[#1677C8]"
                  />
                  <div className="flex gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setPayAmount(Number(selectedSaleForPayment.outstandingAmount))}
                      className="text-[10px] text-[#1677C8] hover:underline font-bold"
                    >
                      Pay Full Balance (₹{selectedSaleForPayment.outstandingAmount})
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Payment Method</label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:border-[#1677C8] bg-white"
                  >
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Notes / Reference (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Received by cash counter / UPI Ref"
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-[#1677C8]"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setPaymentModalOpen(false)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingPay || payAmount <= 0}
                    className="px-5 py-2 bg-[#1677C8] hover:bg-[#1363a8] text-white rounded-xl font-bold transition disabled:opacity-50 shadow-xs"
                  >
                    {isSubmittingPay ? 'Recording...' : `Record ₹${payAmount} Payment`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AnimatePresence>
  );
}
