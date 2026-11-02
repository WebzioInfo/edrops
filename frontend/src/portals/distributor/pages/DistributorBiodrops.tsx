import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShoppingCart,
  Boxes,
  Plus,
  RefreshCw,
  X,
  CreditCard,
} from 'lucide-react';
import { biodropsApi } from '../../../api/biodrops';
import type {
  BiodropsProduct,
  DistributorOwnershipStatus,
  DistributorPurchaseBillsResponse,
} from '../../../api/biodrops';
import { FileText, Building2 } from 'lucide-react';
import { toast } from '../../../utils/toast';
import { useAuth } from '../../../contexts/AuthContext';

export default function DistributorBiodrops() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'products' | 'ownership' | 'accessories' | 'bills'>('products');
  const [billsData, setBillsData] = useState<DistributorPurchaseBillsResponse | null>(null);
  const [billSourceFilter, setBillSourceFilter] = useState<'ALL' | 'EDROPS' | 'AQUZIO'>('ALL');
  const [loading, setLoading] = useState(false);

  const [products, setProducts] = useState<BiodropsProduct[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [ownershipData, setOwnershipData] = useState<DistributorOwnershipStatus | null>(null);
  const [accessoryStock, setAccessoryStock] = useState<any>(null);

  // Modals
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);

  // Order Form
  const [orderForm, setOrderForm] = useState({
    productId: '',
    quantity: 50,
    deliveryRequired: true,
  });

  // Settle Form
  const [settleAmount, setSettleAmount] = useState(5000);
  const [paymentRef, setPaymentRef] = useState('');

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [prods, mySales, ownStatus, accStock, bills] = await Promise.all([
        biodropsApi.getProducts(),
        biodropsApi.getDistributorSales(user.id),
        biodropsApi.getDistributorOwnershipStatus(user.id),
        biodropsApi.getAccessoryInventory(user.id),
        biodropsApi.getDistributorPurchaseBills(user.id),
      ]);

      setProducts(prods || []);
      setSales(mySales || []);
      setOwnershipData(ownStatus || null);
      setAccessoryStock(accStock || null);
      setBillsData(bills || null);

      if (prods && prods.length > 0 && !orderForm.productId) {
        const jar = prods.find((p: BiodropsProduct) => p.sku === 'BIO-JAR-20L') || prods[0];
        setOrderForm((prev) => ({ ...prev, productId: jar.id }));
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load distributor data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await biodropsApi.createDistributorSale({
        distributorId: user.id,
        deliveryRequired: orderForm.deliveryRequired,
        items: [{ productId: orderForm.productId, quantity: Number(orderForm.quantity) }],
        paymentStatus: 'PAID',
      });
      toast.success('Order placed successfully! Inventory added to your yard.');
      setShowOrderModal(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to place order');
    }
  };

  const handleSettleOwnership = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const res = await biodropsApi.settleJarOwnership({
        distributorId: user.id,
        paymentAmount: Number(settleAmount),
        ratePerJar: 250,
        paymentReference: paymentRef || `UTR-${Date.now().toString().slice(-6)}`,
      });
      toast.success(
        `Transferred ${res.jarsTransferred} jars to your ownership! (Remaining company-owned: ${res.outstandingEdropsJars} jars)`,
      );
      setShowSettleModal(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Payment settlement failed');
    }
  };

  const selectedProduct = products.find((p) => p.id === orderForm.productId);
  const calculatedUnitPrice =
    selectedProduct?.sku === 'BIO-JAR-20L'
      ? orderForm.deliveryRequired
        ? 35.0
        : 28.0
      : selectedProduct?.distributorPrice ?? selectedProduct?.price ?? 0;
  const calculatedSubtotal = orderForm.quantity * calculatedUnitPrice;
  const calculatedGst = (calculatedSubtotal * (selectedProduct?.gstRate || 18.0)) / 100.0;
  const calculatedTotal = calculatedSubtotal + calculatedGst;

  return (
    <div className="space-y-6 p-4 sm:p-6 pb-12 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#16324F] to-[#1677C8] rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-[#00AEEF] text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
              DISTRIBUTOR COMMERCE
            </span>
            <span className="text-white/80 text-xs">Official Biodrops Partner</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight">Biodrops Products & Jar Ownership</h1>
          <p className="text-white/80 text-xs sm:text-sm mt-0.5">
            Order filled 20L jars (Pickup ₹28 / Delivery ₹35), manage accessories and transfer empty jar ownership via payment.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowOrderModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-white text-[#16324F] hover:bg-slate-100 rounded-xl text-xs font-bold cursor-pointer shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4 text-[#1677C8]" /> Order Biodrops Jars
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl cursor-pointer transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* OWNERSHIP CARD (MANDATORY EXACT DISPLAY) */}
      {ownershipData && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                EMPTY JAR OWNERSHIP ACCOUNT
              </span>
              <h2 className="text-xl font-black text-[#16324F] mt-0.5">
                {ownershipData.ownership.totalPhysicalInPossession} Empty Jars in Your Possession
              </h2>
            </div>
            {ownershipData.ownership.edropsOwned > 0 && (
              <button
                onClick={() => {
                  setSettleAmount(ownershipData.ownership.pendingPaymentAmount);
                  setShowSettleModal(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#1677C8] hover:bg-[#1264a8] text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs transition-colors"
              >
                <CreditCard className="w-4 h-4" /> Pay to Own Jars
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
            <div className="p-3.5 bg-emerald-50/70 border border-emerald-100 rounded-xl">
              <span className="text-xs font-semibold text-emerald-800">Distributor-Owned (Paid)</span>
              <div className="text-2xl font-black text-emerald-700 mt-1">
                {ownershipData.ownership.distributorOwned} Jars
              </div>
              <p className="text-[11px] text-emerald-600 mt-0.5">100% legal ownership transferred</p>
            </div>

            <div className="p-3.5 bg-blue-50/70 border border-blue-100 rounded-xl">
              <span className="text-xs font-semibold text-blue-800">Edrops-Owned (Deposit Held)</span>
              <div className="text-2xl font-black text-[#1677C8] mt-1">
                {ownershipData.ownership.edropsOwned} Jars
              </div>
              <p className="text-[11px] text-blue-600 mt-0.5">Held on credit / returnable</p>
            </div>

            <div className="p-3.5 bg-rose-50/70 border border-rose-100 rounded-xl">
              <span className="text-xs font-semibold text-rose-800">Ownership Purchase Pending</span>
              <div className="text-2xl font-black text-rose-700 mt-1">
                ₹{ownershipData.ownership.pendingPaymentAmount.toLocaleString()}
              </div>
              <p className="text-[11px] text-rose-600 mt-0.5">@ ₹250 reference price per jar</p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto space-x-2">
        {[
          { id: 'products', label: 'Order History & Invoices', icon: ShoppingCart },
          { id: 'bills', label: 'Purchase Bills (Dual-Source)', icon: FileText },
          { id: 'ownership', label: 'Ownership Ledger Audit', icon: ShieldCheck },
          { id: 'accessories', label: 'My Accessory Stock', icon: Boxes },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 py-3 px-4 font-semibold text-xs border-b-2 cursor-pointer transition-colors whitespace-nowrap ${
                isActive
                  ? 'border-[#1677C8] text-[#1677C8] bg-[#1677C8]/5'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: PRODUCT ORDERS & SALES INVOICES */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 bg-slate-50 font-bold text-xs text-slate-700">
              My Biodrops Purchase Invoices
            </div>
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Fulfillment Mode</th>
                  <th className="py-3 px-4">Taxable</th>
                  <th className="py-3 px-4">GST (18%)</th>
                  <th className="py-3 px-4">Total Amount</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sales.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No purchase orders recorded yet. Click "Order Biodrops Jars" above to place your first order.
                    </td>
                  </tr>
                ) : (
                  sales.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-800">{s.invoiceNumber}</td>
                      <td className="py-3 px-4">{new Date(s.saleDate).toLocaleDateString()}</td>
                      <td className="py-3 px-4">
                        {s.deliveryRequired ? (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[10px] font-bold">
                            Delivery Inclusive (₹35/jar)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold">
                            Yard Pickup (₹28/jar)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">₹{s.subtotal.toLocaleString()}</td>
                      <td className="py-3 px-4">₹{s.taxAmount.toLocaleString()}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">₹{s.totalAmount.toLocaleString()}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {s.paymentStatus}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      
      {/* TAB: DUAL-SOURCE PURCHASE BILLS (AQUZIO VS EDROPS) */}
      {activeTab === 'bills' && (
        <div className="space-y-5">
          {/* Summary Cards */}
          {billsData && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Purchases</span>
                <div className="text-xl font-black text-slate-900 mt-1">
                  ₹{billsData.summary.totalPurchases.toLocaleString()}
                </div>
                <span className="text-[10px] text-slate-400">All commercial bills</span>
              </div>

              <div className="p-3.5 bg-blue-50/70 border border-blue-100 rounded-xl shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Edrops Invoices</span>
                <div className="text-xl font-black text-[#1677C8] mt-1">
                  ₹{billsData.summary.edropsTotal.toLocaleString()}
                </div>
                <span className="text-[10px] text-blue-600">Finished goods & jars</span>
              </div>

              <div className="p-3.5 bg-emerald-50/70 border border-emerald-100 rounded-xl shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Aquzio Bills</span>
                <div className="text-xl font-black text-emerald-700 mt-1">
                  ₹{billsData.summary.aquzioTotal.toLocaleString()}
                </div>
                <span className="text-[10px] text-emerald-600">Manufacturing source</span>
              </div>

              <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Paid</span>
                <div className="text-xl font-black text-emerald-600 mt-1">
                  ₹{billsData.summary.totalPaid.toLocaleString()}
                </div>
                <span className="text-[10px] text-slate-400">Settled receipts</span>
              </div>

              <div className="p-3.5 bg-rose-50/70 border border-rose-100 rounded-xl shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Total Outstanding</span>
                <div className="text-xl font-black text-rose-700 mt-1">
                  ₹{billsData.summary.totalOutstanding.toLocaleString()}
                </div>
                <span className="text-[10px] text-rose-600">Due on credit</span>
              </div>
            </div>
          )}

          {/* Source Filter Selector */}
          <div className="flex items-center gap-2">
            {[
              { id: 'ALL', label: 'All Document Sources' },
              { id: 'EDROPS', label: 'Edrops Commercial Invoices' },
              { id: 'AQUZIO', label: 'Aquzio Manufacturing Bills' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setBillSourceFilter(f.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  billSourceFilter === f.id
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Bills List Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="font-bold text-xs text-slate-700">Authorized Purchase Bills Directory</span>
              <span className="text-[11px] text-slate-500">Separated by document authority</span>
            </div>
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Document Source</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Taxable</th>
                  <th className="py-3 px-4">GST</th>
                  <th className="py-3 px-4">Total Amount</th>
                  <th className="py-3 px-4">Paid</th>
                  <th className="py-3 px-4">Outstanding</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(() => {
                  if (!billsData) return null;
                  const list = [
                    ...(billSourceFilter === 'AQUZIO' ? [] : billsData.edropsBills),
                    ...(billSourceFilter === 'EDROPS' ? [] : billsData.aquzioBills),
                  ];

                  if (list.length === 0) {
                    return (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-400">
                          No purchase bills found for this filter criteria.
                        </td>
                      </tr>
                    );
                  }

                  return list.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">{b.invoiceNumber}</td>
                      <td className="py-3 px-4">
                        {b.documentSource === 'EDROPS' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-[#1677C8] border border-blue-200">
                            Edrops Commercial
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Building2 className="w-3 h-3" />
                            Aquzio Upstream
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">{new Date(b.date).toLocaleDateString()}</td>
                      <td className="py-3 px-4 font-semibold text-slate-700">₹{b.subtotal.toFixed(2)}</td>
                      <td className="py-3 px-4 font-semibold text-slate-700">₹{b.taxAmount.toFixed(2)}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">₹{b.totalAmount.toFixed(2)}</td>
                      <td className="py-3 px-4 text-emerald-600 font-semibold">₹{b.amountPaid.toFixed(2)}</td>
                      <td className="py-3 px-4 text-rose-600 font-semibold">₹{b.outstandingAmount.toFixed(2)}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            b.paymentStatus === 'PAID'
                              ? 'bg-emerald-100 text-emerald-800'
                              : b.paymentStatus === 'PARTIAL'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {b.paymentStatus}
                        </span>
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: OWNERSHIP LEDGER AUDIT */}
      {activeTab === 'ownership' && ownershipData && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 bg-slate-50 font-bold text-xs text-slate-700">
            Immutable Empty Jar Ownership Transfer History
          </div>
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Transaction #</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Jars Transferred</th>
                <th className="py-3 px-4">Amount Paid</th>
                <th className="py-3 px-4">Before (Edrops / Dist)</th>
                <th className="py-3 px-4">After (Edrops / Dist)</th>
                <th className="py-3 px-4">Payment Ref</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ownershipData.ledger.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No ownership settlement transactions recorded yet.
                  </td>
                </tr>
              ) : (
                ownershipData.ledger.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-800">{log.transactionNumber}</td>
                    <td className="py-3 px-4">{new Date(log.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 px-4 font-bold text-emerald-600">+{log.jarsTransferred} Jars</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">₹{log.settlementAmount.toLocaleString()}</td>
                    <td className="py-3 px-4 text-slate-500">
                      {log.companyJarsBefore} / {log.distributorJarsBefore}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {log.companyJarsAfter} / {log.distributorJarsAfter}
                    </td>
                    <td className="py-3 px-4 font-mono">{log.paymentReference || 'Direct'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: ACCESSORIES STOCK */}
      {activeTab === 'accessories' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {products
            .filter((p) => p.productType === 'ACCESSORY')
            .map((acc) => {
              const holding =
                accessoryStock?.distributorStock?.find((s: any) => s.productId === acc.id)?.quantity || 0;
              return (
                <div key={acc.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-[#16324F]">{acc.name}</h3>
                      <p className="text-xs text-slate-500">{acc.description}</p>
                    </div>
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-slate-100 rounded">
                      {acc.sku}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs py-2 border-y border-slate-100">
                    <span className="text-slate-500">Distributor Wholesale Rate:</span>
                    <span className="font-bold text-emerald-600 text-sm">₹{acc.distributorPrice || acc.price}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">In Your Yard Stock:</span>
                    <span className="font-black text-[#1677C8] text-base">{holding} PCS</span>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* ORDER MODAL */}
      {showOrderModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="font-bold text-sm text-[#16324F]">Order Biodrops Water Jars</h3>
              <button onClick={() => setShowOrderModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateOrder} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Select Product</label>
                <select
                  value={orderForm.productId}
                  onChange={(e) => setOrderForm({ ...orderForm, productId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  required
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Fulfillment Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOrderForm({ ...orderForm, deliveryRequired: true })}
                    className={`p-2.5 rounded-xl border text-center font-bold cursor-pointer transition-colors ${
                      orderForm.deliveryRequired
                        ? 'border-[#1677C8] bg-blue-50 text-[#1677C8]'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Delivery Inclusive (₹35/jar)
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderForm({ ...orderForm, deliveryRequired: false })}
                    className={`p-2.5 rounded-xl border text-center font-bold cursor-pointer transition-colors ${
                      !orderForm.deliveryRequired
                        ? 'border-[#1677C8] bg-blue-50 text-[#1677C8]'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Yard Pickup (₹28/jar)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Quantity (Jars)</label>
                <input
                  type="number"
                  min="1"
                  value={orderForm.quantity}
                  onChange={(e) => setOrderForm({ ...orderForm, quantity: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold"
                  required
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl space-y-1 text-slate-700">
                <div className="flex justify-between">
                  <span>Unit Price:</span>
                  <span className="font-bold">₹{calculatedUnitPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>₹{calculatedSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>GST (18%):</span>
                  <span>₹{calculatedGst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm text-[#16324F] pt-1 border-t border-slate-200">
                  <span>Total Amount:</span>
                  <span className="text-[#1677C8]">₹{calculatedTotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowOrderModal(false)}
                  className="px-4 py-2 border rounded-lg text-slate-600 hover:bg-slate-50 cursor-pointer font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1677C8] hover:bg-[#1264a8] text-white rounded-lg font-bold cursor-pointer"
                >
                  Confirm & Place Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SETTLE OWNERSHIP MODAL */}
      {showSettleModal && ownershipData && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="font-bold text-sm text-[#16324F]">Pay to Own Empty Jars</h3>
              <button onClick={() => setShowSettleModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-xs space-y-1">
              <p><strong>Edrops-Owned Jars Held:</strong> {ownershipData.ownership.edropsOwned} Jars</p>
              <p><strong>Reference Price:</strong> ₹250.00 per empty jar</p>
              <p><strong>Full Settlement Balance:</strong> ₹{ownershipData.ownership.pendingPaymentAmount.toLocaleString()}</p>
            </div>

            <form onSubmit={handleSettleOwnership} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Enter Payment Amount (₹)</label>
                <input
                  type="number"
                  min="250"
                  step="250"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-slate-900 text-sm"
                  required
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Transfers <strong>{Math.floor(settleAmount / 250)} jars</strong> from Edrops to your distributor ownership.
                  {settleAmount % 250 > 0 && (
                    <span className="text-amber-600 ml-1">
                      (Unapplied credit: ₹{settleAmount % 250})
                    </span>
                  )}
                </p>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Payment Reference / UTR #</label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder="e.g. UTR-98765432"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSettleModal(false)}
                  className="px-4 py-2 border rounded-lg text-slate-600 hover:bg-slate-50 cursor-pointer font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold cursor-pointer"
                >
                  Confirm & Transfer Ownership
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
