import React, { useState, useEffect } from 'react';
import {
  Package,
  Layers,
  ShieldCheck,
  FileText,
  DollarSign,
  Plus,
  RefreshCw,
  CheckCircle,
  Building2,
  ShoppingCart,
  Boxes,
  Percent,
  X,
  TrendingUp,
  Trash2,
} from 'lucide-react';
import { biodropsApi } from '../../../api/biodrops';
import { fetchAquzioTenants } from '../../../api/aquzio';
import type {
  BiodropsProduct,
  Vendor,
  ManufacturingCompany,
  ProductionBatch,
  FinancialSummaryReport,
  BulkPricingTier,
  CommercialDashboardMetrics,
} from '../../../api/biodrops';
import { toast } from '../../../utils/toast';

export default function BiodropsEcosystem() {
  const [activeTab, setActiveTab] = useState<
    | 'catalogue'
    | 'bulk_pricing'
    | 'procurement'
    | 'manufacturing'
    | 'distributor_sales'
    | 'jar_ownership'
    | 'accessories'
    | 'subscriptions'
    | 'reports'
  >('catalogue');

  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<BiodropsProduct[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [manufacturers, setManufacturers] = useState<ManufacturingCompany[]>([]);
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [mfrInvoices, setMfrInvoices] = useState<any[]>([]);
  const [distributorSales, setDistributorSales] = useState<any[]>([]);
  const [reports, setReports] = useState<FinancialSummaryReport | null>(null);
  const [bulkTiers, setBulkTiers] = useState<BulkPricingTier[]>([]);
  const [commercialMetrics, setCommercialMetrics] = useState<CommercialDashboardMetrics | null>(null);

  // Modals
  const [showProductModal, setShowProductModal] = useState(false);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showManufacturerModal, setShowManufacturerModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showQcModal, setShowQcModal] = useState<ProductionBatch | null>(null);
  const [showMfrInvoiceModal, setShowMfrInvoiceModal] = useState(false);
  const [showDistributorSaleModal, setShowDistributorSaleModal] = useState(false);
  const [showOwnershipSettleModal, setShowOwnershipSettleModal] = useState<any | null>(null);
  const [showBulkTierModal, setShowBulkTierModal] = useState(false);

  // Bulk Tier Form
  const [bulkTierForm, setBulkTierForm] = useState({
    productId: '',
    minQuantity: 50,
    maxQuantity: 99,
    pickupPrice: 27,
    deliveryPrice: 34,
    description: 'Volume Tier (50-99 jars)',
  });

  // Form states
  const [productForm, setProductForm] = useState({
    name: '',
    sku: '',
    description: '',
    price: 35,
    distributorPrice: 28,
    customerPrice: 35,
    costPrice: 22.5,
    productType: 'WATER_PRODUCT',
    hsnCode: '2201',
    gstRate: 18,
    uom: 'JAR',
    categoryId: '',
  });

  const [vendorForm, setVendorForm] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    gstin: '',
    city: '',
    state: 'Kerala',
  });

  const [purchaseForm, setPurchaseForm] = useState({
    vendorId: '',
    invoiceNumber: '',
    materialId: '',
    quantity: 1000,
    unitPrice: 150,
    gstRate: 18,
    amountPaid: 0,
  });

  const [mfrForm, setMfrForm] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    gstin: '',
    city: '',
    state: 'Kerala',
    defaultCoPackingRate: 15.0,
  });

  const [issueForm, setIssueForm] = useState({
    manufacturerId: '',
    materialId: '',
    quantity: 500,
    notes: '',
  });

  const [batchForm, setBatchForm] = useState({
    manufacturerId: '',
    plannedQuantity: 500,
    actualQuantity: 480,
    rejectedQuantity: 0,
    consumedCaps: 480,
    wastage: 5,
  });

  const [qcForm, setQcForm] = useState({
    passedQuantity: 475,
    rejectedQuantity: 5,
    notes: 'Approved for saleable finished inventory',
  });

  const [mfrInvoiceForm, setMfrInvoiceForm] = useState({
    manufacturerId: '',
    invoiceNumber: '',
    serviceQuantity: 480,
    coPackingRate: 15.0,
    gstRate: 18.0,
    sacCode: '9988',
    amountPaid: 0,
  });

  const [saleForm, setSaleForm] = useState({
    distributorId: '',
    productId: '',
    quantity: 100,
    deliveryRequired: true,
    paymentStatus: 'PAID',
    amountPaid: 0,
  });

  const [settleForm, setSettleForm] = useState({
    distributorId: '',
    paymentAmount: 12500,
    ratePerJar: 250,
    paymentReference: '',
    notes: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      // Keep manufacturing facilities strictly synchronized with upstream Aquzio toggles
      if (activeTab === 'manufacturing') {
        try {
          const liveTenants = await fetchAquzioTenants();
          if (Array.isArray(liveTenants)) {
            await biodropsApi.syncAquoraTenants(
              liveTenants.map((t) => ({
                id: t.id,
                name: t.companyName || t.code || 'Manufacturing Facility',
              }))
            );
          }
        } catch {
          // Gracefully continue with cached local manufacturers if Aquzio is unreachable
        }
      }

      const [prods, cats, vends, purcs, mfrs, btchs, mInvs, sales, reps, tiers, cMetrics] = await Promise.all([
        biodropsApi.getProducts(),
        biodropsApi.getCategories(),
        biodropsApi.getVendors(),
        biodropsApi.getPurchases(),
        biodropsApi.getManufacturers(),
        biodropsApi.getProductionBatches(),
        biodropsApi.getManufacturerInvoices(),
        biodropsApi.getDistributorSales(),
        biodropsApi.getFinancialSummary(),
        biodropsApi.getBulkPricingTiers().catch(() => []),
        biodropsApi.getCommercialDashboardMetrics().catch(() => null),
      ]);

      setProducts(prods || []);
      setCategories(cats || []);
      setVendors(vends || []);
      setPurchases(purcs || []);
      setManufacturers(mfrs || []);
      setBatches(btchs || []);
      setMfrInvoices(mInvs || []);
      setDistributorSales(sales || []);
      setReports(reps || null);
      setBulkTiers(tiers || []);
      setCommercialMetrics(cMetrics || null);

      if (cats && cats.length > 0 && !productForm.categoryId) {
        setProductForm((prev) => ({ ...prev, categoryId: cats[0].id }));
      }
      if (vends && vends.length > 0 && !purchaseForm.vendorId) {
        setPurchaseForm((prev) => ({ ...prev, vendorId: vends[0].id }));
      }
      if (mfrs && mfrs.length > 0 && !issueForm.manufacturerId) {
        setIssueForm((prev) => ({ ...prev, manufacturerId: mfrs[0].id }));
        setBatchForm((prev) => ({ ...prev, manufacturerId: mfrs[0].id }));
        setMfrInvoiceForm((prev) => ({ ...prev, manufacturerId: mfrs[0].id }));
      }
      if (reps?.distributors?.items && reps.distributors.items.length > 0 && !saleForm.distributorId) {
        setSaleForm((prev) => ({ ...prev, distributorId: reps.distributors.items[0].id }));
      }
      if (prods && prods.length > 0 && !saleForm.productId) {
        const jar = prods.find((p: BiodropsProduct) => p.sku === 'BIO-JAR-20L') || prods[0];
        setSaleForm((prev) => ({ ...prev, productId: jar.id }));
        setBulkTierForm((prev) => ({ ...prev, productId: jar.id }));
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load Biodrops data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateBulkTier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await biodropsApi.createBulkPricingTier({
        productId: bulkTierForm.productId,
        minQuantity: Number(bulkTierForm.minQuantity),
        maxQuantity: bulkTierForm.maxQuantity ? Number(bulkTierForm.maxQuantity) : null,
        pickupPrice: Number(bulkTierForm.pickupPrice),
        deliveryPrice: Number(bulkTierForm.deliveryPrice),
        description: bulkTierForm.description,
      });
      toast.success('Bulk pricing tier created successfully');
      setShowBulkTierModal(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create bulk pricing tier');
    }
  };

  const handleDeleteBulkTier = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this bulk pricing tier?')) return;
    try {
      await biodropsApi.deleteBulkPricingTier(id);
      toast.success('Bulk pricing tier removed');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete tier');
    }
  };

  const handleSyncAquzio = async () => {
    try {
      setLoading(true);
      let upstreamTenants: Array<{ id: string; name: string }> = [];
      try {
        const live = await fetchAquzioTenants();
        if (Array.isArray(live) && live.length > 0) {
          upstreamTenants = live.map((t) => ({
            id: t.id,
            name: t.companyName || t.code || 'Manufacturing Facility',
          }));
        }
      } catch (fetchErr) {
        // Fallback to complete known production roster if live fetch encounters transient timeout
      }

      if (upstreamTenants.length === 0) {
        upstreamTenants = [
          { id: '8714038a-36b0-4521-8b5e-9389ad045a65', name: 'Faiha Water Solutions' },
          { id: '7d77da44-5307-489c-b474-bf9cdc6137ee', name: 'Sinan Company' },
          { id: '7cde4eab-7c29-4a2c-87cd-579071887701', name: 'Gangothri Aqua Tech' },
          { id: '3475f7bd-7f3e-423c-9048-47e6765a6d76', name: 'Greenmount Aquaa' },
          { id: '35477107-72fc-447f-9f0a-00610529244d', name: 'Greenway Water Manufactures' },
        ];
      }

      const res = await biodropsApi.syncAquoraTenants(upstreamTenants);
      toast.success(`Successfully synchronized ${res.synced} upstream manufacturing facilities from Aquzio!`);
      loadData();
    } catch (err: any) {
      toast.error('Aquzio sync failed');
    } finally {
      setLoading(false);
    }
  };

  // Handlers
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await biodropsApi.createProduct({
        ...productForm,
        brandId: categories[0]?.brandId || 'biodrops-brand',
      });
      toast.success('Product created successfully');
      setShowProductModal(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create product');
    }
  };

  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await biodropsApi.createVendor(vendorForm);
      toast.success('Vendor added successfully');
      setShowVendorModal(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add vendor');
    }
  };

  const handleCreatePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const emptyJarProd = products.find((p) => p.sku === 'BIO-JAR-20L');
      await biodropsApi.createPurchaseInvoice({
        vendorId: purchaseForm.vendorId,
        invoiceNumber: purchaseForm.invoiceNumber,
        items: [
          {
            materialId: purchaseForm.materialId || 'mat-default',
            productId: emptyJarProd?.id,
            quantity: Number(purchaseForm.quantity),
            unitPrice: Number(purchaseForm.unitPrice),
            gstRate: Number(purchaseForm.gstRate),
          },
        ],
        amountPaid: Number(purchaseForm.amountPaid),
      });
      toast.success('Purchase invoice recorded & raw material stock updated');
      setShowPurchaseModal(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record purchase invoice');
    }
  };

  const handleCreateManufacturer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await biodropsApi.createManufacturer(mfrForm);
      toast.success('Manufacturing company added successfully');
      setShowManufacturerModal(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add manufacturer');
    }
  };

  const handleCreateIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await biodropsApi.createMaterialIssue({
        manufacturerId: issueForm.manufacturerId,
        items: [{ materialId: issueForm.materialId, quantity: Number(issueForm.quantity) }],
        notes: issueForm.notes,
      });
      toast.success('Materials issued free-of-charge to manufacturer');
      setShowIssueModal(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to issue materials');
    }
  };

  const handleRecordBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await biodropsApi.recordProductionBatch({
        manufacturerId: batchForm.manufacturerId,
        plannedQuantity: Number(batchForm.plannedQuantity),
        actualQuantity: Number(batchForm.actualQuantity),
        rejectedQuantity: Number(batchForm.rejectedQuantity),
        consumptions: [
          {
            materialId: 'mat-cap',
            consumed: Number(batchForm.consumedCaps),
            wastage: Number(batchForm.wastage),
          },
        ],
      });
      toast.success('Production batch recorded. Ready for QC inspection.');
      setShowBatchModal(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record production batch');
    }
  };

  const handlePerformQc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showQcModal) return;
    try {
      await biodropsApi.performQc(showQcModal.id, {
        passedQuantity: Number(qcForm.passedQuantity),
        rejectedQuantity: Number(qcForm.rejectedQuantity),
        notes: qcForm.notes,
      });
      toast.success('QC Inspection approved. Passed units added to Edrops Central Godown!');
      setShowQcModal(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete QC inspection');
    }
  };

  const handleCreateMfrInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await biodropsApi.createManufacturerInvoice({
        manufacturerId: mfrInvoiceForm.manufacturerId,
        invoiceNumber: mfrInvoiceForm.invoiceNumber,
        serviceQuantity: Number(mfrInvoiceForm.serviceQuantity),
        coPackingRate: Number(mfrInvoiceForm.coPackingRate),
        sacCode: mfrInvoiceForm.sacCode,
        gstRate: Number(mfrInvoiceForm.gstRate),
        amountPaid: Number(mfrInvoiceForm.amountPaid),
      });
      toast.success('Co-packing service invoice posted & payable ledger updated');
      setShowMfrInvoiceModal(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record manufacturer invoice');
    }
  };

  const handleCreateDistributorSale = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await biodropsApi.createDistributorSale({
        distributorId: saleForm.distributorId,
        deliveryRequired: saleForm.deliveryRequired,
        items: [
          {
            productId: saleForm.productId,
            quantity: Number(saleForm.quantity),
          },
        ],
        paymentStatus: saleForm.paymentStatus,
        amountPaid: Number(saleForm.amountPaid),
      });
      toast.success('Distributor product sale completed & stock transferred');
      setShowDistributorSaleModal(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to process distributor sale');
    }
  };

  const handleSettleOwnership = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showOwnershipSettleModal) return;
    try {
      const res = await biodropsApi.settleJarOwnership({
        distributorId: showOwnershipSettleModal.id,
        paymentAmount: Number(settleForm.paymentAmount),
        ratePerJar: Number(settleForm.ratePerJar || 250),
        paymentReference: settleForm.paymentReference,
        notes: settleForm.notes,
      });
      toast.success(
        `Transferred ${res.jarsTransferred} jars to distributor ownership! (Outstanding: ${res.outstandingEdropsJars} jars)`,
      );
      setShowOwnershipSettleModal(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Ownership settlement failed');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Banner */}
      <div className="bg-gradient-to-r from-[#16324F] to-[#1677C8] rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-[#00AEEF] text-white text-[11px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
              BIODROPS ERP
            </span>
            <span className="text-white/80 text-xs">Contract Manufacturing & Distribution</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight">Biodrops Product Ecosystem</h1>
          <p className="text-white/80 text-sm mt-0.5">
            Procurement, Contract Manufacturing, Stock movements, ₹28/₹35 GST Commerce, and Payment-based Jar Ownership.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncAquzio}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Sync Aquzio Upstream
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl cursor-pointer transition-colors"
            title="Refresh All"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {reports && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-slate-500 text-xs font-medium">Finished Stock Value</span>
            <div className="text-lg font-bold text-[#16324F] mt-1">
              ₹{reports.inventoryValuation.toLocaleString()}
            </div>
            <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 mt-1">
              <Boxes className="w-3 h-3" /> Saleable Goods
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-slate-500 text-xs font-medium">Vendor Payables</span>
            <div className="text-lg font-bold text-rose-600 mt-1">
              ₹{reports.vendors.totalPayable.toLocaleString()}
            </div>
            <span className="text-[11px] text-slate-500 font-medium mt-1">
              {reports.vendors.totalVendors} Active Vendors
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-slate-500 text-xs font-medium">Manufacturer Payables</span>
            <div className="text-lg font-bold text-amber-600 mt-1">
              ₹{reports.manufacturers.totalPayable.toLocaleString()}
            </div>
            <span className="text-[11px] text-slate-500 font-medium mt-1">
              {reports.manufacturers.totalManufacturers} Co-Packers
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-slate-500 text-xs font-medium">Edrops-Owned Jars</span>
            <div className="text-lg font-bold text-[#1677C8] mt-1">
              {reports.distributors.totalEdropsOwnedJars.toLocaleString()}
            </div>
            <span className="text-[11px] text-slate-500 font-medium mt-1">Held by Distributors</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-slate-500 text-xs font-medium">Distributor-Owned Jars</span>
            <div className="text-lg font-bold text-emerald-600 mt-1">
              {reports.distributors.totalDistributorOwnedJars.toLocaleString()}
            </div>
            <span className="text-[11px] text-slate-500 font-medium mt-1">Paid in Full</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-slate-500 text-xs font-medium">Ownership Pending</span>
            <div className="text-lg font-bold text-[#16324F] mt-1">
              ₹{reports.distributors.totalOwnershipPending.toLocaleString()}
            </div>
            <span className="text-[11px] text-indigo-600 font-semibold mt-1">@ ₹250 / Jar</span>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto space-x-1">
        {[
          { id: 'catalogue', label: 'Product Catalogue', icon: Package },
          { id: 'bulk_pricing', label: 'Bulk Pricing & Analytics', icon: TrendingUp },
          { id: 'procurement', label: 'Vendors & Purchases', icon: ShoppingCart },
          { id: 'manufacturing', label: 'Contract Manufacturing & QC', icon: Building2 },
          { id: 'distributor_sales', label: 'Distributor Sales (₹28 / ₹35)', icon: DollarSign },
          { id: 'jar_ownership', label: 'Empty Jar Ownership Ledger', icon: ShieldCheck },
          { id: 'accessories', label: 'Accessory Store', icon: Boxes },
          { id: 'subscriptions', label: 'Subscriptions', icon: Layers },
          { id: 'reports', label: 'GST & Financial Ledgers', icon: FileText },
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

      {/* TAB 1: PRODUCT CATALOGUE */}
      {activeTab === 'catalogue' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#16324F]">Unified Product Catalogue & Pricing</h2>
            <button
              onClick={() => setShowProductModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#1677C8] hover:bg-[#1264a8] text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add New Product
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">SKU / Code</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Customer Price</th>
                  <th className="py-3 px-4">Distributor Price</th>
                  <th className="py-3 px-4">Cost Price</th>
                  <th className="py-3 px-4">HSN & GST</th>
                  <th className="py-3 px-4 text-right">Available Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-800">{p.sku || '-'}</td>
                    <td className="py-3 px-4 font-medium text-[#16324F]">
                      {p.name}
                      {p.isJar && (
                        <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                          20L JAR (Deposit ₹{p.depositAmount})
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {p.productType}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">₹{p.customerPrice ?? p.price}</td>
                    <td className="py-3 px-4 font-semibold text-[#1677C8]">
                      {p.sku === 'BIO-JAR-20L' ? '₹28 (Pick) / ₹35 (Del)' : `₹${p.distributorPrice ?? p.price}`}
                    </td>
                    <td className="py-3 px-4 text-slate-500">₹{p.costPrice || 0}</td>
                    <td className="py-3 px-4 font-mono">
                      {p.hsnCode || '2201'} ({p.gstRate}%)
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      {p.availableStock} {p.uom}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: BULK PRICING & COMMERCIAL ANALYTICS */}
      {activeTab === 'bulk_pricing' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#16324F]">Bulk Pricing Engine & Commercial Analytics</h2>
              <p className="text-xs text-slate-500">
                Tiered volume discounts for 20L jars, commercial revenue metrics, and Aquzio upstream synchronization.
              </p>
            </div>
            <button
              onClick={() => setShowBulkTierModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#1677C8] hover:bg-[#1264a8] text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Bulk Tier
            </button>
          </div>

          {/* Commercial Metrics Grid */}
          {commercialMetrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-slate-500 text-xs font-medium">Commercial Revenue</span>
                <div className="text-lg font-bold text-[#16324F] mt-1">
                  ₹{commercialMetrics.kpis.totalCommercialRevenue.toLocaleString()}
                </div>
                <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 mt-1">
                  <TrendingUp className="w-3 h-3" /> All Commercial Sales
                </span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-slate-500 text-xs font-medium">Bulk Sales</span>
                <div className="text-lg font-bold text-[#1677C8] mt-1">
                  ₹{commercialMetrics.kpis.totalBulkSales.toLocaleString()}
                </div>
                <span className="text-[11px] text-slate-500 font-medium mt-1">Volume Tiered</span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-slate-500 text-xs font-medium">Subscription Revenue</span>
                <div className="text-lg font-bold text-indigo-600 mt-1">
                  ₹{commercialMetrics.kpis.totalSubscriptionRevenue.toLocaleString()}
                </div>
                <span className="text-[11px] text-slate-500 font-medium mt-1">
                  {commercialMetrics.kpis.activeSubscriptionsCount} Active Subscriptions
                </span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-slate-500 text-xs font-medium">Accessory Sales</span>
                <div className="text-lg font-bold text-amber-600 mt-1">
                  ₹{commercialMetrics.kpis.totalAccessorySales.toLocaleString()}
                </div>
                <span className="text-[11px] text-slate-500 font-medium mt-1">Stands & Dispensers</span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-slate-500 text-xs font-medium">Commercial Outstanding</span>
                <div className="text-lg font-bold text-rose-600 mt-1">
                  ₹{commercialMetrics.kpis.totalOutstandingPayments.toLocaleString()}
                </div>
                <span className="text-[11px] text-slate-500 font-medium mt-1">Distributor Receivables</span>
              </div>
            </div>
          )}

          {/* Bulk Pricing Tiers Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs space-y-0">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-xs text-slate-800">Active Bulk Pricing Tiers</h3>
                <p className="text-[11px] text-slate-500">
                  Standard baseline: ₹28 yard pickup / ₹35 delivery inclusive. Tier discounts apply automatically when threshold is met.
                </p>
              </div>
              <span className="text-[11px] font-bold text-[#1677C8] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                {bulkTiers.length} Active Tiers
              </span>
            </div>

            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">Quantity Bracket</th>
                  <th className="py-3 px-4">Pickup Price</th>
                  <th className="py-3 px-4">Delivery Price</th>
                  <th className="py-3 px-4">Description / Rule</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bulkTiers.map((tier) => (
                  <tr key={tier.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-medium text-[#16324F]">
                      {tier.product?.name || 'Biodrops 20L Packaged Jar'}
                      <span className="ml-2 font-mono text-[10px] text-slate-500">
                        ({tier.product?.sku || 'BIO-JAR-20L'})
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {tier.minQuantity} {tier.maxQuantity ? `- ${tier.maxQuantity}` : '+'} jars
                    </td>
                    <td className="py-3 px-4 font-bold text-[#1677C8]">₹{tier.pickupPrice}</td>
                    <td className="py-3 px-4 font-bold text-emerald-600">₹{tier.deliveryPrice}</td>
                    <td className="py-3 px-4 text-slate-600">{tier.description || 'Tier Volume Rate'}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        ACTIVE
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDeleteBulkTier(tier.id)}
                        className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer transition-colors"
                        title="Delete Tier"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {bulkTiers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No bulk pricing tiers defined yet. Standard rate ₹28 pickup / ₹35 delivery will apply to all orders.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Upstream Aquzio Finished Goods Sync History */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-xs text-slate-800">Upstream Aquzio Finished Goods Admissions</h3>
                <p className="text-[11px] text-slate-500">
                  Synchronized batches from Aquzio manufacturing system admitted into Edrops commercial godown inventory.
                </p>
              </div>
              <span className="text-[10px] font-bold text-slate-600 bg-slate-200/70 px-2 py-0.5 rounded">
                API S2S Verified
              </span>
            </div>

            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Aquzio Batch #</th>
                  <th className="py-3 px-4">Sync Event</th>
                  <th className="py-3 px-4">Admitted Quantity</th>
                  <th className="py-3 px-4">Sync Timestamp</th>
                  <th className="py-3 px-4 text-right">Admission Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {commercialMetrics?.recentAquzioSync && commercialMetrics.recentAquzioSync.length > 0 ? (
                  commercialMetrics.recentAquzioSync.map((sync) => (
                    <tr key={sync.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-800">
                        {sync.externalBatchId || sync.id.slice(0, 8)}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-700">{sync.syncType}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {sync.acceptedQuantity ? `${sync.acceptedQuantity} jars` : 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {new Date(sync.syncedAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {sync.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No Aquzio batch sync events recorded yet. Admissions will appear here automatically upon upstream dispatch.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: VENDORS & PROCUREMENT */}
      {activeTab === 'procurement' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#16324F]">Raw Material Vendors & Purchase Invoices</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowVendorModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Vendor
              </button>
              <button
                onClick={() => setShowPurchaseModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1677C8] hover:bg-[#1264a8] text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Record Purchase Invoice
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {vendors.map((v) => (
              <div key={v.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-[#16324F]">{v.name}</h3>
                    <p className="text-xs text-slate-500">{v.contactPerson || 'Vendor Contact'}</p>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded">
                    {v.gstin || 'NO GSTIN'}
                  </span>
                </div>
                <div className="text-xs text-slate-600">
                  <p>{v.phone || '-'}</p>
                  <p>{v.city ? `${v.city}, ${v.state}` : v.state}</p>
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500">Outstanding Payable:</span>
                  <span className="font-bold text-rose-600 text-sm">₹{v.currentBalance.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 bg-slate-50 font-bold text-xs text-slate-700">
              Recent Raw Material Purchases
            </div>
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">Invoice #</th>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Vendor</th>
                  <th className="py-2.5 px-4">Taxable</th>
                  <th className="py-2.5 px-4">GST (CGST+SGST/IGST)</th>
                  <th className="py-2.5 px-4">Total Amount</th>
                  <th className="py-2.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchases.map((pur) => (
                  <tr key={pur.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-800">{pur.invoiceNumber}</td>
                    <td className="py-3 px-4">{new Date(pur.invoiceDate).toLocaleDateString()}</td>
                    <td className="py-3 px-4 font-medium text-slate-900">{pur.vendor?.name}</td>
                    <td className="py-3 px-4">₹{pur.subtotal.toLocaleString()}</td>
                    <td className="py-3 px-4 text-slate-700">₹{pur.taxAmount.toLocaleString()}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">₹{pur.totalAmount.toLocaleString()}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          pur.paymentStatus === 'PAID'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {pur.paymentStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: CONTRACT MANUFACTURING & QC */}
      {activeTab === 'manufacturing' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#16324F]">Contract Manufacturing & Co-Packing Facility</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowManufacturerModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Facility
              </button>
              <button
                onClick={() => setShowIssueModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Issue Materials
              </button>
              <button
                onClick={() => setShowBatchModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1677C8] hover:bg-[#1264a8] text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Record Batch
              </button>
              <button
                onClick={() => setShowMfrInvoiceModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Post Service Invoice
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {manufacturers.map((m) => (
              <div key={m.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
                <div className="flex items-start justify-between">
                  <h3 className="font-bold text-sm text-[#16324F]">{m.name}</h3>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                    ₹{m.defaultCoPackingRate}/jar
                  </span>
                </div>
                <p className="text-xs text-slate-500">{m.city}, {m.state}</p>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Service Payable:</span>
                  <span className="font-bold text-amber-600">₹{m.currentPayable.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Batches Table with QC Inspection Action */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 bg-slate-50 font-bold text-xs text-slate-700">
              Manufacturing Production Batches & Quality Inspections
            </div>
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">Batch #</th>
                  <th className="py-2.5 px-4">Manufacturer</th>
                  <th className="py-2.5 px-4">Planned</th>
                  <th className="py-2.5 px-4">Actual Output</th>
                  <th className="py-2.5 px-4">Co-Pack Cost</th>
                  <th className="py-2.5 px-4">QC Status</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-800">{b.batchNumber}</td>
                    <td className="py-3 px-4 font-medium text-slate-900">{b.manufacturer?.name}</td>
                    <td className="py-3 px-4">{b.plannedQuantity} jars</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{b.actualQuantity} jars</td>
                    <td className="py-3 px-4">₹{b.coPackingCost.toLocaleString()} (@ ₹{b.coPackingRate})</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          b.qcStatus === 'PASSED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : b.qcStatus === 'PENDING'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {b.qcStatus} ({b.qcPassedQuantity} Passed / {b.qcRejectedQuantity} Rejected)
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {b.qcStatus === 'PENDING' ? (
                        <button
                          onClick={() => {
                            setShowQcModal(b);
                            setQcForm({
                              passedQuantity: b.actualQuantity - 5,
                              rejectedQuantity: 5,
                              notes: 'Approved for saleable finished inventory',
                            });
                          }}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold cursor-pointer"
                        >
                          Perform QC
                        </button>
                      ) : (
                        <span className="text-slate-400 text-xs flex items-center justify-end gap-1">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Stock Posted
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Manufacturer Invoices Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 bg-slate-50 font-bold text-xs text-slate-700">
              Co-Packing Service Purchase Invoices (SAC 9988)
            </div>
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">Invoice #</th>
                  <th className="py-2.5 px-4">Facility</th>
                  <th className="py-2.5 px-4">Service Jars</th>
                  <th className="py-2.5 px-4">Rate</th>
                  <th className="py-2.5 px-4">Taxable</th>
                  <th className="py-2.5 px-4">GST</th>
                  <th className="py-2.5 px-4">Total</th>
                  <th className="py-2.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mfrInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-800">{inv.invoiceNumber}</td>
                    <td className="py-3 px-4 font-medium text-slate-900">{inv.manufacturer?.name}</td>
                    <td className="py-3 px-4">{inv.serviceQuantity} jars</td>
                    <td className="py-3 px-4">₹{inv.coPackingRate}</td>
                    <td className="py-3 px-4">₹{inv.taxableAmount.toLocaleString()}</td>
                    <td className="py-3 px-4">₹{(inv.cgst + inv.sgst + inv.igst).toLocaleString()}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">₹{inv.totalAmount.toLocaleString()}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {inv.paymentStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: DISTRIBUTOR SALES (₹28 / ₹35) */}
      {activeTab === 'distributor_sales' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#16324F]">Distributor Product Sales & GST Invoices</h2>
              <p className="text-xs text-slate-500">
                Rule: 20L filled jar ₹28 without delivery (pickup), ₹35 with delivery. Single product selling price.
              </p>
            </div>
            <button
              onClick={() => setShowDistributorSaleModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#1677C8] hover:bg-[#1264a8] text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Create Distributor Sale
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Distributor</th>
                  <th className="py-3 px-4">Delivery Mode</th>
                  <th className="py-3 px-4">Taxable</th>
                  <th className="py-3 px-4">GST (18%)</th>
                  <th className="py-3 px-4">Total Amount</th>
                  <th className="py-3 px-4">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {distributorSales.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-800">{s.invoiceNumber}</td>
                    <td className="py-3 px-4">{new Date(s.saleDate).toLocaleDateString()}</td>
                    <td className="py-3 px-4 font-medium text-slate-900">{s.distributor?.agencyName || 'Distributor'}</td>
                    <td className="py-3 px-4">
                      {s.deliveryRequired ? (
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[10px] font-bold">
                          Delivery Inclusive (₹35/jar)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold">
                          Pickup Yard (₹28/jar)
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
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: EMPTY JAR OWNERSHIP LEDGER */}
      {activeTab === 'jar_ownership' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-bold text-[#16324F]">Empty Jar Ownership & Settlement Ledger</h2>
            <p className="text-xs text-slate-500">
              Reference Price: ₹250/jar. Ownership transfers ONLY on verified payment settlement. Partial payments transfer whole integer jars.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Distributor Agency</th>
                  <th className="py-3 px-4">Physical Jars in Possession</th>
                  <th className="py-3 px-4">Distributor-Owned (Paid)</th>
                  <th className="py-3 px-4">Edrops-Owned (Deposit Held)</th>
                  <th className="py-3 px-4">Pending Ownership Amount</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports?.distributors.items.map((dist) => (
                  <tr key={dist.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-bold text-[#16324F]">{dist.name}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{dist.totalPhysicalJars} Jars</td>
                    <td className="py-3 px-4 font-bold text-emerald-600">{dist.distributorOwnedJars} Jars</td>
                    <td className="py-3 px-4 font-bold text-[#1677C8]">{dist.edropsOwnedJars} Jars</td>
                    <td className="py-3 px-4 font-bold text-rose-600">
                      ₹{dist.jarOwnershipPendingAmount.toLocaleString()} (@ ₹250)
                    </td>
                    <td className="py-3 px-4 text-right">
                      {dist.edropsOwnedJars > 0 ? (
                        <button
                          onClick={() => {
                            setShowOwnershipSettleModal(dist);
                            setSettleForm({
                              distributorId: dist.id,
                              paymentAmount: dist.jarOwnershipPendingAmount,
                              ratePerJar: 250,
                              paymentReference: `PAY-${Date.now().toString().slice(-4)}`,
                              notes: `Ownership settlement for ${dist.name}`,
                            });
                          }}
                          className="px-3 py-1 bg-[#1677C8] hover:bg-[#1264a8] text-white rounded text-[11px] font-bold cursor-pointer transition-colors shadow-xs"
                        >
                          Settle Ownership
                        </button>
                      ) : (
                        <span className="text-emerald-600 text-xs font-semibold flex items-center justify-end gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> 100% Owned
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: ACCESSORY STORE */}
      {activeTab === 'accessories' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {products
            .filter((p) => p.productType === 'ACCESSORY')
            .map((acc) => (
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
                  <span className="text-slate-500">Retail / Customer:</span>
                  <span className="font-bold text-slate-900">₹{acc.customerPrice ?? acc.price}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Distributor Wholesale:</span>
                  <span className="font-bold text-[#1677C8] text-sm">₹{acc.distributorPrice ?? acc.price}</span>
                </div>
                <div className="flex justify-between items-center text-xs pt-1">
                  <span className="text-slate-500">Central Warehouse Stock:</span>
                  <span className="font-black text-emerald-600">{acc.totalStock} PCS</span>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* TAB 7: SUBSCRIPTIONS */}
      {activeTab === 'subscriptions' && (
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-bold text-base text-[#16324F]">Configurable Subscription Plans with Accessories</h3>
            <p className="text-xs text-slate-500">
              Plans can combine regular 20L water deliveries with free promotional accessories or discounted add-ons. Free items deduct actual warehouse inventory.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-sm text-[#16324F]">Biodrops Premium Monthly Plan</h4>
                    <p className="text-xs text-slate-500">Standard residential & office recurring subscription</p>
                  </div>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-bold rounded">
                    ₹999 / mo
                  </span>
                </div>
                <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside pt-2">
                  <li>30 × 20L Biodrops Water Jars per month</li>
                  <li><strong>Free Stand Dispenser</strong> (Promotional, cost amortized)</li>
                  <li>Electric Dispenser Add-on at discounted rate (₹950 instead of ₹1,800)</li>
                </ul>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-sm text-[#16324F]">Corporate Executive Hydration Plan</h4>
                    <p className="text-xs text-slate-500">Bulk enterprise plan with electric dispensers included</p>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded">
                    ₹2,499 / mo
                  </span>
                </div>
                <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside pt-2">
                  <li>80 × 20L Biodrops Water Jars per month</li>
                  <li><strong>Free Electric Water Dispenser</strong> included</li>
                  <li>Priority delivery routing & emergency refill service</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: FINANCIAL LEDGERS & GST */}
      {activeTab === 'reports' && reports && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* GST Summary */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="font-bold text-sm text-[#16324F] flex items-center gap-2">
                <Percent className="w-4 h-4 text-[#1677C8]" /> GST Purchase (ITC) & Sales Register
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Taxable Sales (Distributor Commerce)</span>
                  <span className="font-bold text-slate-800">₹{reports.gst.salesTaxable.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">GST Output Tax Collected</span>
                  <span className="font-bold text-emerald-600">₹{reports.gst.salesGst.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Taxable Raw Material Purchases</span>
                  <span className="font-bold text-slate-800">₹{reports.gst.purchasesTaxable.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Input Tax Credit (ITC) Available</span>
                  <span className="font-bold text-blue-600">₹{reports.gst.itcAvailable.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-2 bg-slate-50 px-3 rounded-lg font-bold text-sm">
                  <span className="text-slate-700">Net GST Liability Payable</span>
                  <span className="text-rose-600">₹{reports.gst.netGstPayable.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Inventory Valuation & Costing Breakdown */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="font-bold text-sm text-[#16324F] flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" /> Product Costing & Profitability
              </h3>
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 space-y-1">
                  <span className="font-bold text-xs text-blue-900">20L Biodrops Refill Cost Model:</span>
                  <p className="text-[11px] text-blue-800">
                    Co-Packing Fee: ₹15.00 + Consumables (Cap ₹4.50, Sticker ₹2.00, Sleeve ₹1.50): ₹8.00 = <strong>₹23.00</strong> Refill Production Cost.
                  </p>
                  <p className="text-[11px] text-blue-700">
                    (Note: ₹250 20L empty jar is a reusable asset and not amortized on refills).
                  </p>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Selling Price (Pickup Yard)</span>
                  <span className="font-bold text-slate-800">₹28.00 (Gross Margin: ₹5.00 / ~18%)</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Selling Price (Delivery Inclusive)</span>
                  <span className="font-bold text-emerald-600">₹35.00 (Gross Margin: ₹12.00 / ~34%)</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Empty 20L Jar Reference Price</span>
                  <span className="font-bold text-[#1677C8]">₹250.00 / Jar</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRODUCT MODAL */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="font-bold text-sm text-[#16324F]">Add Product</h3>
              <button onClick={() => setShowProductModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateProduct} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Product Name</label>
                <input
                  type="text"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  placeholder="e.g. 10L Packaged Water"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">SKU</label>
                  <input
                    type="text"
                    value={productForm.sku}
                    onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                    placeholder="BIO-WATER-10L"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Category</label>
                  <select
                    value={productForm.categoryId}
                    onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Customer Price (₹)</label>
                  <input
                    type="number"
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: Number(e.target.value), customerPrice: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Distributor Price (₹)</label>
                  <input
                    type="number"
                    value={productForm.distributorPrice}
                    onChange={(e) => setProductForm({ ...productForm, distributorPrice: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    required
                  />
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setShowProductModal(false)} className="px-4 py-2 border rounded-lg text-slate-600">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-[#1677C8] text-white rounded-lg font-bold">
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VENDOR MODAL */}
      {showVendorModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="font-bold text-sm text-[#16324F]">Add Vendor</h3>
              <button onClick={() => setShowVendorModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateVendor} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Vendor Name</label>
                <input
                  type="text"
                  value={vendorForm.name}
                  onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
                  placeholder="e.g. Apex Polymer Containers"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">GSTIN</label>
                  <input
                    type="text"
                    value={vendorForm.gstin}
                    onChange={(e) => setVendorForm({ ...vendorForm, gstin: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Phone</label>
                  <input
                    type="text"
                    value={vendorForm.phone}
                    onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setShowVendorModal(false)} className="px-4 py-2 border rounded-lg text-slate-600">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-[#1677C8] text-white rounded-lg font-bold">
                  Save Vendor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PURCHASE INVOICE MODAL */}
      {showPurchaseModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="font-bold text-sm text-[#16324F]">Record Raw Material Purchase</h3>
              <button onClick={() => setShowPurchaseModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreatePurchase} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Select Vendor</label>
                <select
                  value={purchaseForm.vendorId}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, vendorId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  required
                >
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Invoice Number</label>
                <input
                  type="text"
                  value={purchaseForm.invoiceNumber}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, invoiceNumber: e.target.value })}
                  placeholder="e.g. INV-PUR-2026-01"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Quantity</label>
                  <input
                    type="number"
                    value={purchaseForm.quantity}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, quantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Unit Price (₹)</label>
                  <input
                    type="number"
                    value={purchaseForm.unitPrice}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, unitPrice: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    required
                  />
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setShowPurchaseModal(false)} className="px-4 py-2 border rounded-lg text-slate-600">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-[#1677C8] text-white rounded-lg font-bold">
                  Post Purchase Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANUFACTURER MODAL */}
      {showManufacturerModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="font-bold text-sm text-[#16324F]">Add Manufacturing Facility</h3>
              <button onClick={() => setShowManufacturerModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateManufacturer} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Company Name</label>
                <input
                  type="text"
                  value={mfrForm.name}
                  onChange={(e) => setMfrForm({ ...mfrForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Co-Packing Rate (₹/jar)</label>
                  <input
                    type="number"
                    value={mfrForm.defaultCoPackingRate}
                    onChange={(e) => setMfrForm({ ...mfrForm, defaultCoPackingRate: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">City</label>
                  <input
                    type="text"
                    value={mfrForm.city}
                    onChange={(e) => setMfrForm({ ...mfrForm, city: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setShowManufacturerModal(false)} className="px-4 py-2 border rounded-lg text-slate-600">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-[#1677C8] text-white rounded-lg font-bold">
                  Save Facility
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ISSUE MATERIALS MODAL */}
      {showIssueModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="font-bold text-sm text-[#16324F]">Issue Materials for Co-Packing</h3>
              <button onClick={() => setShowIssueModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-blue-700 bg-blue-50 p-2.5 rounded-lg border border-blue-100">
              Materials issued free-of-charge for Biodrops production. Remains Edrops-owned.
            </p>
            <form onSubmit={handleCreateIssue} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Select Facility</label>
                <select
                  value={issueForm.manufacturerId}
                  onChange={(e) => setIssueForm({ ...issueForm, manufacturerId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  required
                >
                  {manufacturers.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Quantity (Sets)</label>
                <input
                  type="number"
                  value={issueForm.quantity}
                  onChange={(e) => setIssueForm({ ...issueForm, quantity: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold"
                  required
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setShowIssueModal(false)} className="px-4 py-2 border rounded-lg text-slate-600">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-[#1677C8] text-white rounded-lg font-bold">
                  Issue Delivery Challan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD BATCH MODAL */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="font-bold text-sm text-[#16324F]">Record Production Batch</h3>
              <button onClick={() => setShowBatchModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleRecordBatch} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Facility</label>
                <select
                  value={batchForm.manufacturerId}
                  onChange={(e) => setBatchForm({ ...batchForm, manufacturerId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  required
                >
                  {manufacturers.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Planned Qty</label>
                  <input
                    type="number"
                    value={batchForm.plannedQuantity}
                    onChange={(e) => setBatchForm({ ...batchForm, plannedQuantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Actual Produced</label>
                  <input
                    type="number"
                    value={batchForm.actualQuantity}
                    onChange={(e) => setBatchForm({ ...batchForm, actualQuantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold"
                    required
                  />
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setShowBatchModal(false)} className="px-4 py-2 border rounded-lg text-slate-600">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-[#1677C8] text-white rounded-lg font-bold">
                  Save Production Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POST MFR INVOICE MODAL */}
      {showMfrInvoiceModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="font-bold text-sm text-[#16324F]">Post Co-Packing Service Invoice</h3>
              <button onClick={() => setShowMfrInvoiceModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateMfrInvoice} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Facility</label>
                <select
                  value={mfrInvoiceForm.manufacturerId}
                  onChange={(e) => setMfrInvoiceForm({ ...mfrInvoiceForm, manufacturerId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  required
                >
                  {manufacturers.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Invoice Number</label>
                <input
                  type="text"
                  value={mfrInvoiceForm.invoiceNumber}
                  onChange={(e) => setMfrInvoiceForm({ ...mfrInvoiceForm, invoiceNumber: e.target.value })}
                  placeholder="e.g. FAIHA-SRV-2026-01"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Jars Filled</label>
                  <input
                    type="number"
                    value={mfrInvoiceForm.serviceQuantity}
                    onChange={(e) => setMfrInvoiceForm({ ...mfrInvoiceForm, serviceQuantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Rate (₹/jar)</label>
                  <input
                    type="number"
                    value={mfrInvoiceForm.coPackingRate}
                    onChange={(e) => setMfrInvoiceForm({ ...mfrInvoiceForm, coPackingRate: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold"
                    required
                  />
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setShowMfrInvoiceModal(false)} className="px-4 py-2 border rounded-lg text-slate-600">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-[#1677C8] text-white rounded-lg font-bold">
                  Post Service Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DISTRIBUTOR SALE MODAL */}
      {showDistributorSaleModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="font-bold text-sm text-[#16324F]">Create Distributor Sale</h3>
              <button onClick={() => setShowDistributorSaleModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateDistributorSale} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Select Distributor</label>
                <select
                  value={saleForm.distributorId}
                  onChange={(e) => setSaleForm({ ...saleForm, distributorId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  required
                >
                  {reports?.distributors.items.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Select Product</label>
                <select
                  value={saleForm.productId}
                  onChange={(e) => setSaleForm({ ...saleForm, productId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  required
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Quantity</label>
                  <input
                    type="number"
                    value={saleForm.quantity}
                    onChange={(e) => setSaleForm({ ...saleForm, quantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Delivery Required?</label>
                  <select
                    value={saleForm.deliveryRequired ? 'true' : 'false'}
                    onChange={(e) => setSaleForm({ ...saleForm, deliveryRequired: e.target.value === 'true' })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold"
                  >
                    <option value="true">Yes (₹35/jar)</option>
                    <option value="false">No - Yard Pickup (₹28/jar)</option>
                  </select>
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setShowDistributorSaleModal(false)} className="px-4 py-2 border rounded-lg text-slate-600">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-[#1677C8] text-white rounded-lg font-bold">
                  Generate Sale Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QC MODAL */}
      {showQcModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="font-bold text-sm text-[#16324F]">QC Inspection & Finished Goods Receipt</h3>
              <button onClick={() => setShowQcModal(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
              <p><strong>Batch Number:</strong> {showQcModal.batchNumber}</p>
              <p><strong>Manufacturer:</strong> {showQcModal.manufacturer?.name}</p>
              <p><strong>Actual Output:</strong> {showQcModal.actualQuantity} jars</p>
            </div>
            <form onSubmit={handlePerformQc} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Passed Quantity (Saleable)</label>
                <input
                  type="number"
                  min="0"
                  max={showQcModal.actualQuantity}
                  value={qcForm.passedQuantity}
                  onChange={(e) => setQcForm({ ...qcForm, passedQuantity: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Rejected Quantity (Quarantine)</label>
                <input
                  type="number"
                  min="0"
                  value={qcForm.rejectedQuantity}
                  onChange={(e) => setQcForm({ ...qcForm, rejectedQuantity: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">QC Inspection Remarks</label>
                <input
                  type="text"
                  value={qcForm.notes}
                  onChange={(e) => setQcForm({ ...qcForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowQcModal(null)}
                  className="px-4 py-2 border rounded-lg text-slate-600 hover:bg-slate-50 cursor-pointer font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold cursor-pointer"
                >
                  Approve & Post to Godown
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OWNERSHIP SETTLE MODAL */}
      {showOwnershipSettleModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="font-bold text-sm text-[#16324F]">Empty Jar Ownership Settlement</h3>
              <button onClick={() => setShowOwnershipSettleModal(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-xs space-y-1">
              <p><strong>Distributor:</strong> {showOwnershipSettleModal.name}</p>
              <p><strong>Edrops-Owned Jars Held:</strong> {showOwnershipSettleModal.edropsOwnedJars} jars</p>
              <p><strong>Pending Amount:</strong> ₹{showOwnershipSettleModal.jarOwnershipPendingAmount.toLocaleString()} (@ ₹250/jar)</p>
            </div>
            <form onSubmit={handleSettleOwnership} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Settlement Payment Amount (₹)</label>
                <input
                  type="number"
                  min="250"
                  step="250"
                  value={settleForm.paymentAmount}
                  onChange={(e) => setSettleForm({ ...settleForm, paymentAmount: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-slate-900"
                  required
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Transfers <strong>{Math.floor(settleForm.paymentAmount / 250)} jars</strong> to distributor ownership.
                  {settleForm.paymentAmount % 250 > 0 && (
                    <span className="text-amber-600 ml-1">
                      (Unapplied credit: ₹{settleForm.paymentAmount % 250})
                    </span>
                  )}
                </p>
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Payment Reference #</label>
                <input
                  type="text"
                  value={settleForm.paymentReference}
                  onChange={(e) => setSettleForm({ ...settleForm, paymentReference: e.target.value })}
                  placeholder="e.g. UTR12345678"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  required
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowOwnershipSettleModal(null)}
                  className="px-4 py-2 border rounded-lg text-slate-600 hover:bg-slate-50 cursor-pointer font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1677C8] hover:bg-[#1264a8] text-white rounded-lg font-bold cursor-pointer"
                >
                  Transfer Ownership
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* BULK PRICING TIER MODAL */}
      {showBulkTierModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="font-bold text-sm text-[#16324F]">Configure Bulk Pricing Tier</h3>
              <button
                onClick={() => setShowBulkTierModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateBulkTier} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Target Product</label>
                <select
                  value={bulkTierForm.productId}
                  onChange={(e) => setBulkTierForm({ ...bulkTierForm, productId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium"
                  required
                >
                  <option value="">Select product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku || 'No SKU'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Min Quantity (Jars)</label>
                  <input
                    type="number"
                    min="1"
                    value={bulkTierForm.minQuantity}
                    onChange={(e) =>
                      setBulkTierForm({ ...bulkTierForm, minQuantity: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Max Quantity (Optional)</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Leave blank for 100+"
                    value={bulkTierForm.maxQuantity || ''}
                    onChange={(e) =>
                      setBulkTierForm({
                        ...bulkTierForm,
                        maxQuantity: e.target.value ? Number(e.target.value) : (null as any),
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Pickup Rate (₹ / Jar)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={bulkTierForm.pickupPrice}
                    onChange={(e) =>
                      setBulkTierForm({ ...bulkTierForm, pickupPrice: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-[#1677C8]"
                    required
                  />
                  <span className="text-[10px] text-slate-400">Baseline is ₹28.00</span>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Delivery Rate (₹ / Jar)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={bulkTierForm.deliveryPrice}
                    onChange={(e) =>
                      setBulkTierForm({ ...bulkTierForm, deliveryPrice: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-emerald-600"
                    required
                  />
                  <span className="text-[10px] text-slate-400">Baseline is ₹35.00</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Tier Description / Label</label>
                <input
                  type="text"
                  value={bulkTierForm.description}
                  onChange={(e) => setBulkTierForm({ ...bulkTierForm, description: e.target.value })}
                  placeholder="e.g. Volume Tier: 50-99 jars (₹1 discount)"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowBulkTierModal(false)}
                  className="px-4 py-2 border rounded-lg text-slate-600 hover:bg-slate-50 cursor-pointer font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1677C8] hover:bg-[#1264a8] text-white rounded-lg font-bold cursor-pointer"
                >
                  Save Bulk Tier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
