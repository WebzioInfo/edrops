
export interface BulkPricingTier {
  id: string;
  productId: string;
  minQuantity: number;
  maxQuantity?: number | null;
  pickupPrice: number;
  deliveryPrice: number;
  isActive: boolean;
  description?: string;
  product?: { id: string; name: string; sku?: string };
}

export interface PurchaseBillItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface PurchaseBill {
  id: string;
  invoiceNumber: string;
  date: string;
  documentSource: 'EDROPS' | 'AQUZIO';
  sourceBadge: string;
  orderStage?: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  outstandingAmount: number;
  paymentStatus: string;
  paymentMethod?: string;
  items: PurchaseBillItem[];
}

export interface DistributorPurchaseBillsResponse {
  distributor: {
    id: string;
    businessName: string;
    gstin?: string;
  };
  summary: {
    totalPurchases: number;
    edropsTotal: number;
    aquzioTotal: number;
    totalPaid: number;
    totalOutstanding: number;
  };
  edropsBills: PurchaseBill[];
  aquzioBills: PurchaseBill[];
}

export interface CommercialDashboardMetrics {
  kpis: {
    totalCommercialRevenue: number;
    totalBulkSales: number;
    totalSubscriptionRevenue: number;
    totalAccessorySales: number;
    totalOutstandingPayments: number;
    activeSubscriptionsCount: number;
    distributorCount: number;
    totalCompanyOwnedJars: number;
    totalDistributorOwnedJars: number;
    jarOwnershipOutstanding: number;
    availableFinishedGoodsJars: number;
  };
  revenueByChannel: Array<{ channel: string; revenue: number }>;
  recentAquzioSync: Array<{
    id: string;
    syncType: string;
    status: string;
    externalBatchId?: string;
    acceptedQuantity?: number;
    rejectedQuantity?: number;
    syncedAt: string;
  }>;
}

import { fetchWithAuth } from './client';

export interface BiodropsProduct {
  id: string;
  sku?: string;
  name: string;
  description?: string;
  price: number;
  distributorPrice?: number;
  customerPrice?: number;
  costPrice?: number;
  productType: 'WATER_PRODUCT' | 'ACCESSORY' | 'RAW_MATERIAL' | 'PACKAGING';
  hsnCode?: string;
  gstRate: number;
  uom: string;
  minStockLevel: number;
  isJar: boolean;
  depositAmount: number;
  totalStock: number;
  availableStock: number;
  category?: { id: string; name: string };
}

export interface Vendor {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  pan?: string;
  address?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  currentBalance: number;
  isActive: boolean;
}

export interface ManufacturingCompany {
  id: string;
  name: string;
  externalTenantId?: string;
  gstin?: string;
  address?: string;
  city?: string;
  state?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  defaultCoPackingRate: number;
  currentPayable: number;
  isActive: boolean;
}

export interface ProductionBatch {
  id: string;
  batchNumber: string;
  manufacturerId: string;
  plannedQuantity: number;
  actualQuantity: number;
  rejectedQuantity: number;
  acceptedQuantity: number;
  qcPassedQuantity: number;
  qcRejectedQuantity: number;
  qcStatus: string;
  coPackingRate: number;
  coPackingCost: number;
  consumablesCost: number;
  totalProductionCost: number;
  unitCost: number;
  productionDate: string;
  manufacturer: { name: string; gstin?: string };
}

export interface DistributorOwnershipStatus {
  distributor: { id: string; name: string; phone?: string };
  ownership: {
    totalPhysicalInPossession: number;
    distributorOwned: number;
    edropsOwned: number;
    ratePerJar: number;
    pendingPaymentAmount: number;
  };
  ledger: Array<{
    id: string;
    transactionNumber: string;
    type: string;
    companyJarsBefore: number;
    distributorJarsBefore: number;
    companyJarsAfter: number;
    distributorJarsAfter: number;
    jarsTransferred: number;
    ratePerJar: number;
    settlementAmount: number;
    paymentReference?: string;
    createdAt: string;
  }>;
}

export interface FinancialSummaryReport {
  vendors: {
    totalVendors: number;
    totalPayable: number;
    items: Array<{ id: string; name: string; gstin?: string; currentBalance: number }>;
  };
  manufacturers: {
    totalManufacturers: number;
    totalPayable: number;
    items: Array<{ id: string; name: string; gstin?: string; currentPayable: number }>;
  };
  distributors: {
    totalDistributors: number;
    totalOwnershipPending: number;
    totalEdropsOwnedJars: number;
    totalDistributorOwnedJars: number;
    items: Array<{
      id: string;
      name: string;
      distributorOwnedJars: number;
      edropsOwnedJars: number;
      totalPhysicalJars: number;
      jarOwnershipPendingAmount: number;
    }>;
  };
  gst: {
    salesTaxable: number;
    salesGst: number;
    purchasesTaxable: number;
    itcAvailable: number;
    netGstPayable: number;
  };
  inventoryValuation: number;
}

export const biodropsApi = {
  // Products & Categories
  getProducts: (params?: { categoryId?: string; productType?: string; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.categoryId) query.set('categoryId', params.categoryId);
    if (params?.productType) query.set('productType', params.productType);
    if (params?.search) query.set('search', params.search);
    const qs = query.toString();
    return fetchWithAuth(`/biodrops/products${qs ? `?${qs}` : ''}`);
  },
  getCategories: () => fetchWithAuth('/biodrops/categories'),
  createProduct: (data: any) =>
    fetchWithAuth('/biodrops/products', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Vendors & Procurement
  getVendors: () => fetchWithAuth('/biodrops/vendors'),
  createVendor: (data: any) =>
    fetchWithAuth('/biodrops/vendors', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getVendorLedger: (vendorId: string) => fetchWithAuth(`/biodrops/vendors/${vendorId}/ledger`),
  recordVendorPayment: (data: any) =>
    fetchWithAuth('/biodrops/vendors/payment', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getPurchases: () => fetchWithAuth('/biodrops/purchases'),
  createPurchaseInvoice: (data: any) =>
    fetchWithAuth('/biodrops/purchases', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Manufacturing & Co-packing
  getManufacturers: () => fetchWithAuth('/biodrops/manufacturers'),
  createManufacturer: (data: any) =>
    fetchWithAuth('/biodrops/manufacturers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  setCoPackingRate: (data: any) =>
    fetchWithAuth('/biodrops/manufacturers/rate', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getMaterialIssues: (mfrId?: string) =>
    fetchWithAuth(`/biodrops/manufacturers/material-issues${mfrId ? `?manufacturerId=${mfrId}` : ''}`),
  createMaterialIssue: (data: any) =>
    fetchWithAuth('/biodrops/manufacturers/material-issues', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getProductionBatches: (mfrId?: string) =>
    fetchWithAuth(`/biodrops/manufacturers/batches${mfrId ? `?manufacturerId=${mfrId}` : ''}`),
  recordProductionBatch: (data: any) =>
    fetchWithAuth('/biodrops/manufacturers/batches', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  performQc: (batchId: string, data: any) =>
    fetchWithAuth(`/biodrops/manufacturers/batches/${batchId}/qc`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getManufacturerInvoices: (mfrId?: string) =>
    fetchWithAuth(`/biodrops/manufacturers/invoices${mfrId ? `?manufacturerId=${mfrId}` : ''}`),
  createManufacturerInvoice: (data: any) =>
    fetchWithAuth('/biodrops/manufacturers/invoices', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  recordManufacturerPayment: (data: any) =>
    fetchWithAuth('/biodrops/manufacturers/payment', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getManufacturerLedger: (mfrId: string) => fetchWithAuth(`/biodrops/manufacturers/${mfrId}/ledger`),

  // Distributor Commerce & Sales (₹28 / ₹35)
  getDistributorSales: (distributorId?: string) =>
    fetchWithAuth(`/biodrops/distributor/sales${distributorId ? `?distributorId=${distributorId}` : ''}`),
  createDistributorSale: (data: any) =>
    fetchWithAuth('/biodrops/distributor/sales', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Jar Ownership & Settle (₹250 Rule)
  getDistributorOwnershipStatus: (distributorId: string) =>
    fetchWithAuth(`/biodrops/distributor/ownership/${distributorId}`),
  settleJarOwnership: (data: any) =>
    fetchWithAuth('/biodrops/distributor/ownership/settle', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Accessories
  getAccessoryInventory: (distributorId?: string) =>
    fetchWithAuth(`/biodrops/accessories/inventory${distributorId ? `?distributorId=${distributorId}` : ''}`),
  createAccessorySale: (data: any) =>
    fetchWithAuth('/biodrops/accessories/sales', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Subscriptions
  getSubscriptionPlans: () => fetchWithAuth('/biodrops/subscriptions/plans'),
  configureSubscriptionPlan: (data: any) =>
    fetchWithAuth('/biodrops/subscriptions/plans', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  assignSubscriptionToCustomer: (data: any) =>
    fetchWithAuth('/biodrops/subscriptions/assign', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Financial Reports
  getFinancialSummary: () => fetchWithAuth('/biodrops/reports/financial-summary'),


  // Commercial Sales & Bulk Pricing
  getBulkPricingTiers: (productId?: string): Promise<BulkPricingTier[]> =>
    fetchWithAuth(`/biodrops/bulk-pricing-tiers${productId ? `?productId=${productId}` : ''}`),
  createBulkPricingTier: (data: any) =>
    fetchWithAuth('/biodrops/bulk-pricing-tiers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteBulkPricingTier: (id: string) =>
    fetchWithAuth(`/biodrops/bulk-pricing-tiers/${id}`, {
      method: 'DELETE',
    }),
  calculateBulkPrice: (productId: string, quantity: number, deliveryRequired: boolean) =>
    fetchWithAuth(
      `/biodrops/calculate-bulk-price?productId=${productId}&quantity=${quantity}&deliveryRequired=${deliveryRequired}`
    ),
  createBulkSale: (data: any) =>
    fetchWithAuth('/biodrops/bulk-sales', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Dual-Source Purchase Bills
  getDistributorPurchaseBills: (
    distributorId: string,
    source?: string
  ): Promise<DistributorPurchaseBillsResponse> =>
    fetchWithAuth(
      `/biodrops/distributor/${distributorId}/purchase-bills${source ? `?source=${source}` : ''}`
    ),

  // Commercial Subscriptions
  createCustomizedSubscription: (data: any) =>
    fetchWithAuth('/biodrops/subscriptions/customized', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Commercial Dashboard Analytics
  getCommercialDashboardMetrics: (): Promise<CommercialDashboardMetrics> =>
    fetchWithAuth('/biodrops/commercial-dashboard-metrics'),

  // Aquzio Upstream Finished Goods
  receiveAquzioFinishedGoods: (data: any) =>
    fetchWithAuth('/biodrops/aquzio/receive-finished-goods', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Upstream Aquora / Biofix Sync
  syncAquoraTenants: (tenants: any[]) =>
    fetchWithAuth('/biodrops/sync-aquora-tenants', {
      method: 'POST',
      body: JSON.stringify({ tenants }),
    }),
};

