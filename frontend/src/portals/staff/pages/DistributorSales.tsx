import { useState, useEffect, useMemo } from 'react';
import {
  ShoppingBag,
  Plus,
  Search,
  RefreshCw,
  X,
  DollarSign,
  Receipt,
} from 'lucide-react';
import { fetchWithAuth } from '../../../api/client';
import { toast } from 'react-hot-toast';
import { EdropsPageLoader } from '../../../components/common/EdropsPageLoader';
import { fetchAquzioTenants, fetchTenantSales, type AquzioTenant } from '../../../api/aquzio';

export default function DistributorSales() {
  const [sales, setSales] = useState<any[]>([]);
  const [distributors, setDistributors] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [plants, setPlants] = useState<AquzioTenant[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [distributorFilter, setDistributorFilter] = useState('ALL');
  const [productFilter, setProductFilter] = useState('ALL');
  const [plantFilter, setPlantFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // New Sale Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDistributorId, setSelectedDistributorId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState<number>(50);
  const [unitPrice, setUnitPrice] = useState<number>(28);
  const [deliveryRequired, setDeliveryRequired] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'FULL' | 'PARTIAL' | 'CREDIT'>('FULL');
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Collect Payment Modal State
  const [collectModalOpen, setCollectModalOpen] = useState(false);
  const [selectedSaleForPayment, setSelectedSaleForPayment] = useState<any | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<string>('CASH');
  const [payNotes, setPayNotes] = useState<string>('');
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);

  // View Invoice Detail Modal
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [salesData, distData, prodData, plantList] = await Promise.all([
        fetchWithAuth('/biodrops/distributor/sales').catch(() => []),
        fetchWithAuth('/staff/distributors').catch(() => []),
        fetchWithAuth('/catalog/products').catch(() => []),
        fetchAquzioTenants().catch(() => []),
      ]);

      const activePlants = plantList || [];
      setPlants(activePlants);
      setDistributors(distData || []);

      // Fetch sales from all active Aquzio plants where Biodrops Production is enabled
      let allPlantSales: any[] = [];
      if (activePlants.length > 0) {
        const plantSalesPromises = activePlants.map(async (plant) => {
          try {
            const pSales = await fetchTenantSales(plant.id);
            return (pSales || []).map((as: any) => ({
              id: as.transactionId,
              invoiceNumber: as.transactionNumber,
              saleDate: as.transactionDate,
              source: 'AQUZIO',
              badgeLabel: as.badgeLabel || 'Changed the sales in Aquzio',
              plantName: plant.companyName,
              tenantId: plant.id,
              distributorId: as.customerId || as.transactionId,
              distributor: {
                id: as.customerId || as.transactionId,
                agencyName: as.customerName,
                fullName: as.customerName,
                user: {
                  firstName: as.customerName,
                  lastName: '',
                  phone: 'Aquzio Client',
                },
              },
              items: [
                {
                  id: as.productId,
                  productId: as.productId,
                  quantity: as.quantity,
                  unitPrice: as.unitPrice,
                  totalPrice: as.totalAmount,
                  product: {
                    id: as.productId,
                    name: as.productName || '20L Water Jar',
                  },
                },
              ],
              totalAmount: as.totalAmount,
              amountPaid: as.amountPaid,
              outstandingAmount: as.outstandingAmount,
              paymentStatus: (as.paymentStatus || 'PENDING').toUpperCase(),
              paymentMethod: as.paymentMethod || 'CASH',
              notes: as.remarks,
              createdAt: as.createdAtUtc,
            }));
          } catch {
            return [];
          }
        });

        const nested = await Promise.all(plantSalesPromises);
        allPlantSales = nested.flat();
      }

      // Merge local eDrops distributor sales + Aquzio manufacturing plant sales
      const mergedSales = [...(salesData || []), ...allPlantSales].sort(
        (a: any, b: any) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime(),
      );

      setSales(mergedSales);

      const validProducts =
        prodData && prodData.length > 0
          ? prodData
          : [
              { id: 'prod-20l-jar', name: '20L Packaged Drinking Water Jar', defaultPrice: 28, gstRate: 18 },
              { id: 'prod-1l-bottle', name: '1L Mineral Water Case (12 pcs)', defaultPrice: 120, gstRate: 18 },
              { id: 'prod-500ml-bottle', name: '500ml Mineral Water Case (24 pcs)', defaultPrice: 180, gstRate: 18 },
            ];
      setProducts(validProducts);

      if (distData?.length > 0 && !selectedDistributorId) {
        setSelectedDistributorId(distData[0].distributorProfileId || distData[0].id);
      }
      if (validProducts.length > 0 && !selectedProductId) {
        setSelectedProductId(validProducts[0].id);
        setUnitPrice(validProducts[0].defaultPrice || 28);
      }
    } catch (err: any) {
      toast.error('Failed to load sales data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Recalculate price when delivery toggle changes
  useEffect(() => {
    const prod = products.find((p) => p.id === selectedProductId);
    if (prod && prod.id === 'prod-20l-jar') {
      setUnitPrice(deliveryRequired ? 35 : 28);
    }
  }, [deliveryRequired, selectedProductId, products]);

  // Derived financial calculation for form
  const currentProduct = products.find((p) => p.id === selectedProductId);
  const gstRate = currentProduct?.gstRate || 18.0;
  const computedSubtotal = quantity * unitPrice;
  const computedTax = (computedSubtotal * gstRate) / 100;
  const computedTotal = computedSubtotal + computedTax;

  // Auto-sync amountPaid when paymentMode changes or total changes
  useEffect(() => {
    if (paymentMode === 'FULL') {
      setAmountPaid(computedTotal);
    } else if (paymentMode === 'CREDIT') {
      setAmountPaid(0);
    } else if (paymentMode === 'PARTIAL' && (amountPaid > computedTotal || amountPaid === 0)) {
      setAmountPaid(Math.round(computedTotal / 2));
    }
  }, [paymentMode, computedTotal]);

  const formBalanceDue = Math.max(0, computedTotal - (amountPaid || 0));

  // Handle Form Submit
  const handleCreateSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDistributorId) {
      toast.error('Please select a distributor');
      return;
    }
    if (!selectedProductId || quantity <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        distributorId: selectedDistributorId,
        items: [
          {
            productId: selectedProductId,
            quantity: Number(quantity),
            unitPrice: Number(unitPrice),
          },
        ],
        deliveryRequired,
        amountPaid: Number(amountPaid),
        paymentMethod,
        notes: notes.trim() || undefined,
      };

      await fetchWithAuth('/biodrops/distributor/sales', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      toast.success('Distributor sale recorded successfully!');
      setIsModalOpen(false);
      setNotes('');
      loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to record distributor sale');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Payment Collect
  const handleCollectPayment = async (e: React.FormEvent) => {
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
      setCollectModalOpen(false);
      setSelectedSaleForPayment(null);
      loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to record payment');
    } finally {
      setIsSubmittingPay(false);
    }
  };

  // Filtered Sales List
  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      const term = search.toLowerCase().trim();
      const inv = (sale.invoiceNumber || '').toLowerCase();
      const distName = (
        sale.distributor?.agencyName ||
        `${sale.distributor?.user?.firstName || ''} ${sale.distributor?.user?.lastName || ''}`
      ).toLowerCase();
      const phone = (sale.distributor?.user?.phone || '').toLowerCase();

      // Search
      if (term && !inv.includes(term) && !distName.includes(term) && !phone.includes(term)) {
        return false;
      }

      // Distributor filter
      if (distributorFilter !== 'ALL') {
        const dId = sale.distributorId || sale.distributor?.id;
        if (dId !== distributorFilter) return false;
      }

      // Product filter
      if (productFilter !== 'ALL') {
        const hasProd = sale.items?.some((i: any) => i.productId === productFilter);
        if (!hasProd) return false;
      }

      // Status filter
      if (statusFilter !== 'ALL' && sale.paymentStatus !== statusFilter) {
        return false;
      }

      // Plant / Source filter
      if (plantFilter !== 'ALL') {
        if (plantFilter === 'EDROPS_LOCAL') {
          if (sale.source === 'AQUZIO') return false;
        } else {
          if (sale.tenantId !== plantFilter) return false;
        }
      }

      // Date range filter
      if (startDate) {
        const saleDate = new Date(sale.saleDate).toISOString().slice(0, 10);
        if (saleDate < startDate) return false;
      }
      if (endDate) {
        const saleDate = new Date(sale.saleDate).toISOString().slice(0, 10);
        if (saleDate > endDate) return false;
      }

      return true;
    });
  }, [sales, search, distributorFilter, productFilter, plantFilter, statusFilter, startDate, endDate]);

  // Overall KPI metrics
  const totalSalesRevenue = sales.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
  const totalPaidRevenue = sales.reduce((sum, s) => sum + (Number(s.amountPaid) || 0), 0);
  const totalOutstanding = sales.reduce((sum, s) => sum + (Number(s.outstandingAmount) || 0), 0);
  const pendingInvoices = sales.filter((s) => s.paymentStatus !== 'PAID').length;

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* ─── 1. TOP STATS CARDS ─────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-[#E2E8F0] shadow-2xs flex flex-col justify-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block truncate">
            Total Invoiced
          </span>
          <span className="text-base sm:text-lg font-extrabold text-[#16324F] leading-tight mt-1 block">
            ₹{totalSalesRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5">{sales.length} invoices generated</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-[#E2E8F0] shadow-2xs flex flex-col justify-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block truncate">
            Collected / Paid
          </span>
          <span className="text-base sm:text-lg font-extrabold text-emerald-700 leading-tight mt-1 block">
            ₹{totalPaidRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-emerald-600 mt-0.5">Realized cash in hand / bank</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-[#E2E8F0] shadow-2xs flex flex-col justify-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block truncate">
            Total Balance Due
          </span>
          <span className="text-base sm:text-lg font-extrabold text-rose-700 leading-tight mt-1 block">
            ₹{totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-rose-600 mt-0.5">{pendingInvoices} invoices with balance</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-[#E2E8F0] shadow-2xs flex flex-col justify-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block truncate">
            Pending Collection
          </span>
          <span className="text-base sm:text-lg font-extrabold text-purple-700 leading-tight mt-1 block">
            {pendingInvoices} Bills
          </span>
          <span className="text-[10px] text-purple-600 mt-0.5">Credit / Partial status</span>
        </div>
      </div>

      {/* ─── 2. SEARCH, FILTER & ACTION BAR ────────────────────── */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by invoice number, distributor name, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none focus:border-[#1677C8] focus:bg-white transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="p-2 text-slate-600 hover:text-[#1677C8] bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer"
              title="Refresh Sales"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#1677C8]' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-[#1677C8] hover:bg-[#1363a8] text-white rounded-xl text-xs font-bold transition shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Record Sale</span>
            </button>
          </div>
        </div>

        {/* Filters Row: Dates, Plant Origin, Distributor, Product, Status */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs pt-2 border-t border-slate-100">
          {/* Start Date */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-[#1677C8]"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-[#1677C8]"
            />
          </div>

          {/* Plant / Origin Filter */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Origin / Plant</label>
            <select
              value={plantFilter}
              onChange={(e) => setPlantFilter(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-[#1677C8]"
            >
              <option value="ALL">All Origins</option>
              <option value="EDROPS_LOCAL">eDrops Local Only</option>
              {plants.map((pl) => (
                <option key={pl.id} value={pl.id}>
                  🏭 {pl.companyName}
                </option>
              ))}
            </select>
          </div>

          {/* Distributor Filter */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Distributor</label>
            <select
              value={distributorFilter}
              onChange={(e) => setDistributorFilter(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-[#1677C8]"
            >
              <option value="ALL">All Distributors ({distributors.length})</option>
              {distributors.map((d) => {
                const targetId = d.distributorProfileId || d.id;
                const dName = d.agencyName || d.fullName || `${d.firstName || ''} ${d.lastName || ''}`.trim();
                return (
                  <option key={d.id} value={targetId}>
                    {dName}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Product Filter */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Product</label>
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-[#1677C8]"
            >
              <option value="ALL">All Products</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Status Filter */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-1 flex items-end gap-1.5">
            <div className="flex-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-[#1677C8]"
              >
                <option value="ALL">All Status</option>
                <option value="PAID">Paid Only</option>
                <option value="PARTIAL">Partial Only</option>
                <option value="CREDIT">Credit Only</option>
              </select>
            </div>

            {(startDate || endDate || plantFilter !== 'ALL' || distributorFilter !== 'ALL' || productFilter !== 'ALL' || statusFilter !== 'ALL' || search) && (
              <button
                type="button"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                  setPlantFilter('ALL');
                  setDistributorFilter('ALL');
                  setProductFilter('ALL');
                  setStatusFilter('ALL');
                  setSearch('');
                }}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition shrink-0"
                title="Clear all filters"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── 3. SALES DIRECTORY TABLE ──────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {loading && sales.length === 0 ? (
          <EdropsPageLoader minHeight="min-h-[350px]" />
        ) : filteredSales.length === 0 ? (
          <div className="py-16 text-center">
            <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-slate-700">No sales transactions found</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              No distributor sales match your current search and filter criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-medium border-collapse min-w-[950px]">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[10px] font-black uppercase tracking-wider text-slate-500 select-none">
                  <th className="py-2.5 px-3">Invoice No</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Distributor</th>
                  <th className="py-2.5 px-3">Products & Qty</th>
                  <th className="py-2.5 px-3 text-right">Total Bill</th>
                  <th className="py-2.5 px-3 text-right">Amount Paid</th>
                  <th className="py-2.5 px-3 text-right">Balance Due</th>
                  <th className="py-2.5 px-3 text-center">Payment Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSales.map((sale) => {
                  const isPaid = sale.paymentStatus === 'PAID';
                  const isPartial = sale.paymentStatus === 'PARTIAL';

                  const distName =
                    sale.distributor?.agencyName ||
                    `${sale.distributor?.user?.firstName || ''} ${sale.distributor?.user?.lastName || ''}`.trim() ||
                    'Distributor';

                  return (
                    <tr
                      key={sale.id}
                      onClick={() => setSelectedInvoice(sale)}
                      className="hover:bg-slate-50/70 transition cursor-pointer"
                    >
                      {/* Invoice No & Aquzio Origin Badge */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex flex-col gap-1 items-start">
                          <span className="font-mono font-bold text-[#1677C8]">{sale.invoiceNumber}</span>
                          {sale.source === 'AQUZIO' && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-extrabold bg-sky-50 text-sky-700 border border-sky-200 tracking-wide uppercase shadow-2xs">
                              <span>💧</span>
                              <span>{sale.badgeLabel || 'Changed the sales in Aquzio'}</span>
                              {sale.plantName && <span className="text-sky-900 font-semibold lowercase">({sale.plantName})</span>}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Date */}
                      <td className="py-3 px-3 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                        {new Date(sale.saleDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>

                      {/* Distributor */}
                      <td className="py-3 px-3">
                        <div className="min-w-0">
                          <span className="font-bold text-slate-800 block truncate">{distName}</span>
                          <span className="text-[11px] text-slate-400 font-mono block">
                            {sale.distributor?.user?.phone || '—'}
                          </span>
                        </div>
                      </td>

                      {/* Products & Qty */}
                      <td className="py-3 px-3">
                        <div className="space-y-0.5">
                          {sale.items?.map((item: any) => (
                            <div key={item.id} className="text-[11px] text-slate-700">
                              <span className="font-semibold text-slate-800">{item.product?.name || 'Water Jar'}</span>
                              <span className="text-slate-400"> × {item.quantity} units (@₹{item.unitPrice})</span>
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* Total Bill */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        ₹{Number(sale.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Amount Paid */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                        ₹{Number(sale.amountPaid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Balance Due */}
                      <td className="py-3 px-3 text-right font-mono font-bold whitespace-nowrap">
                        {Number(sale.outstandingAmount) > 0 ? (
                          <span className="text-rose-700">
                            ₹{Number(sale.outstandingAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-slate-300 font-normal">₹0.00</span>
                        )}
                      </td>

                      {/* Payment Status */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isPaid
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : isPartial
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isPaid ? 'bg-emerald-500' : isPartial ? 'bg-amber-500' : 'bg-rose-500'
                            }`}
                          />
                          {sale.paymentStatus}
                        </span>
                      </td>

                      {/* Actions */}
                      <td
                        className="py-3 px-3 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          {Number(sale.outstandingAmount) > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSaleForPayment(sale);
                                setPayAmount(Number(sale.outstandingAmount));
                                setPayMethod('CASH');
                                setPayNotes('');
                                setCollectModalOpen(true);
                              }}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                              title="Collect Balance Payment"
                            >
                              <DollarSign className="w-3 h-3" />
                              <span>Collect</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setSelectedInvoice(sale)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                          >
                            Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── 4. RECORD SALE MODAL ───────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/50 backdrop-blur-2xs overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-xl w-full p-5 sm:p-6 space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-100 text-[#1677C8] flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Record Distributor Sale</h3>
                  <p className="text-[11px] text-slate-400">Issue products & register payments or credit</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSale} className="space-y-3.5 text-xs">
              {/* Select Distributor */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Select Distributor <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={selectedDistributorId}
                  onChange={(e) => setSelectedDistributorId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#1677C8]"
                >
                  <option value="" disabled>
                    Choose a distributor...
                  </option>
                  {distributors.map((d) => {
                    const targetId = d.distributorProfileId || d.id;
                    const dName =
                      d.agencyName || d.fullName || `${d.firstName || ''} ${d.lastName || ''}`.trim();
                    return (
                      <option key={d.id} value={targetId}>
                        {dName} ({d.phone || 'No phone'}) · Bal: ₹{Number(d.outstandingBalance || 0)}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Delivery Required Toggle */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="font-bold text-slate-800 block">Delivery Required?</span>
                  <span className="text-[11px] text-slate-400">
                    {deliveryRequired ? 'Delivery to distributor yard (@ ₹35/jar)' : 'Self-pickup at plant (@ ₹28/jar)'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setDeliveryRequired(!deliveryRequired)}
                  className={`w-12 h-6 rounded-full transition-colors p-0.5 cursor-pointer flex items-center ${
                    deliveryRequired ? 'bg-[#1677C8] justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow-xs" />
                </button>
              </div>

              {/* Product, Unit Price, Quantity */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-1">
                  <label className="block text-slate-700 font-bold mb-1">
                    Product <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => {
                      setSelectedProductId(e.target.value);
                      const p = products.find((x) => x.id === e.target.value);
                      if (p) setUnitPrice(p.defaultPrice || 28);
                    }}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#1677C8]"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    1 Unit Price (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={1}
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(Number(e.target.value))}
                    className="w-full p-2 border border-slate-200 rounded-xl font-mono font-bold text-slate-800 focus:outline-none focus:border-[#1677C8]"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Quantity (Units) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full p-2 border border-slate-200 rounded-xl font-mono font-bold text-slate-800 focus:outline-none focus:border-[#1677C8]"
                  />
                </div>
              </div>

              {/* Dynamic Price Calculation Summary */}
              <div className="bg-sky-50/70 p-3.5 rounded-2xl border border-sky-100 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal ({quantity} units × ₹{unitPrice}):</span>
                  <span className="font-mono font-bold">₹{computedSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>GST ({gstRate}%):</span>
                  <span className="font-mono font-bold">₹{computedTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm font-extrabold text-[#16324F] pt-1 border-t border-sky-200">
                  <span>Total Bill Amount:</span>
                  <span className="font-mono">₹{computedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Payment Mode Selector */}
              <div>
                <label className="block text-slate-700 font-bold mb-1.5">Payment Terms</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMode('FULL')}
                    className={`py-2 px-3 rounded-xl font-bold text-xs transition cursor-pointer border ${
                      paymentMode === 'FULL'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Full Payment
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMode('PARTIAL')}
                    className={`py-2 px-3 rounded-xl font-bold text-xs transition cursor-pointer border ${
                      paymentMode === 'PARTIAL'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Partial Payment
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMode('CREDIT')}
                    className={`py-2 px-3 rounded-xl font-bold text-xs transition cursor-pointer border ${
                      paymentMode === 'CREDIT'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Credit (₹0 Now)
                  </button>
                </div>
              </div>

              {/* Payment Details Input */}
              {paymentMode !== 'CREDIT' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      Amount Paid Now (₹) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      max={computedTotal}
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(Number(e.target.value))}
                      className="w-full p-2 border border-slate-200 rounded-xl font-mono font-bold text-slate-800 focus:outline-none focus:border-[#1677C8]"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Payment Method</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:border-[#1677C8]"
                    >
                      <option value="CASH">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Dynamic Balance Notice */}
              {formBalanceDue > 0 && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs">
                  <span className="font-semibold text-rose-800">
                    Remaining Balance to Give Us:
                  </span>
                  <span className="font-mono font-extrabold text-rose-700 text-sm">
                    ₹{formBalanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">Notes / Instructions (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Delivered 50 jars, driver cash counter settlement"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-[#1677C8]"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !selectedDistributorId || quantity <= 0}
                  className="px-5 py-2 bg-[#1677C8] hover:bg-[#1363a8] text-white rounded-xl font-bold transition disabled:opacity-50 shadow-md cursor-pointer"
                >
                  {submitting ? 'Recording Sale...' : `Confirm Sale (₹${computedTotal.toLocaleString('en-IN')})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── 5. COLLECT PAYMENT MINI-MODAL ───────────────────────── */}
      {collectModalOpen && selectedSaleForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h4 className="text-sm font-bold text-slate-800">Collect Balance Payment</h4>
                <p className="text-[11px] text-slate-400">
                  Invoice: <span className="font-mono font-bold text-[#1677C8]">{selectedSaleForPayment.invoiceNumber}</span>
                </p>
              </div>
              <button onClick={() => setCollectModalOpen(false)} className="text-slate-400 hover:text-slate-600">
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

            <form onSubmit={handleCollectPayment} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Payment Amount (₹) <span className="text-rose-500">*</span>
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
                <label className="block text-slate-700 font-bold mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Received at shop / UPI Ref 98452"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-[#1677C8]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCollectModalOpen(false)}
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

      {/* ─── 6. VIEW INVOICE DETAIL MODAL ───────────────────────── */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/50 backdrop-blur-2xs">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Distributor Invoice</span>
                <h3 className="text-base font-bold text-[#1677C8] font-mono">{selectedInvoice.invoiceNumber}</h3>
              </div>
              <button onClick={() => setSelectedInvoice(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Distributor</span>
                  <span className="font-bold text-slate-800">
                    {selectedInvoice.distributor?.agencyName ||
                      `${selectedInvoice.distributor?.user?.firstName || ''} ${selectedInvoice.distributor?.user?.lastName || ''}`.trim()}
                  </span>
                  <span className="text-[10px] text-slate-400 block">{selectedInvoice.distributor?.user?.phone}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Sale Date</span>
                  <span className="font-semibold text-slate-700">
                    {new Date(selectedInvoice.saleDate).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-1 border border-slate-200 rounded-xl p-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Products</span>
                {selectedInvoice.items?.map((item: any) => (
                  <div key={item.id} className="flex justify-between items-center text-xs">
                    <span>
                      {item.product?.name || 'Product'} × {item.quantity}
                    </span>
                    <span className="font-mono font-bold">₹{item.totalAmount?.toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="bg-slate-50 p-3 rounded-xl space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Subtotal:</span>
                  <span className="font-mono">₹{selectedInvoice.subtotal?.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tax Amount:</span>
                  <span className="font-mono">₹{selectedInvoice.taxAmount?.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-1">
                  <span>Total Amount:</span>
                  <span className="font-mono">₹{selectedInvoice.totalAmount?.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between font-bold text-emerald-700">
                  <span>Amount Paid:</span>
                  <span className="font-mono">₹{selectedInvoice.amountPaid?.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between font-bold text-rose-700">
                  <span>Outstanding Balance:</span>
                  <span className="font-mono">₹{selectedInvoice.outstandingAmount?.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {selectedInvoice.notes && (
                <p className="text-[11px] text-slate-500 italic bg-amber-50/50 p-2 rounded-lg border border-amber-100">
                  Note: {selectedInvoice.notes}
                </p>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
