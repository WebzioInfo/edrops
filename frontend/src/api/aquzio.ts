import { fetchWithAuth } from './client';

export interface AquzioTenantSummary {
  totalFinishedJars: number;
  rawMaterialsCount: number;
  lowStockAlerts: number;
  lastUpdated?: string;
}

// Backward-compatible alias
export type BiodropsTenantSummary = AquzioTenantSummary;

export interface AquzioTenant {
  id: string;
  companyName: string;
  code: string;
  subdomain?: string;
  productionStatus: 'ACTIVE' | 'ENABLED' | 'INACTIVE' | 'DISABLED' | string;
  isBiodropsEnabled: boolean;
  inventorySummary: AquzioTenantSummary;
  lastRetrievedAt: string;
}

// Backward-compatible alias
export type BiodropsTenant = AquzioTenant;

export interface FinishedProductItem {
  id?: string;
  name: string;
  sku: string;
  availableStock: number;
  reservedStock: number;
  damagedStock: number;
  unit: string;
  lastUpdated?: string;
  lastUpdatedUtc?: string;
  lastUpdatedBy?: string;
  lastSource?: 'AQUZIO' | 'EDROPS' | string;
  lastMovementNotes?: string;
}

export interface RawMaterialItem {
  id?: string;
  name: string;
  sku: string;
  category: string;
  availableQuantity: number;
  usedQuantity: number;
  wastedQuantity: number;
  unit: string;
  reorderLevel: number;
  isLowStock?: boolean;
  lastUpdated?: string;
  lastUpdatedUtc?: string;
  lastUpdatedBy?: string;
  lastSource?: 'AQUZIO' | 'EDROPS' | string;
  lastMovementNotes?: string;
}

export interface TenantInventoryResponse {
  tenantId: string;
  tenantName?: string;
  tenantCode?: string;
  retrievedAt: string;
  finishedProducts: FinishedProductItem[];
  rawMaterials: RawMaterialItem[];
}

export interface RawMaterialUnitGroup {
  unit: string;
  totalAvailable: number;
  totalUsed: number;
  totalWasted: number;
  itemCount: number;
  lowStockCount: number;
  items: RawMaterialItem[];
}

export interface StockSummaryResponse {
  tenantId: string;
  tenantName?: string;
  tenantCode?: string;
  retrievedAt: string;
  finishedProductsSummary: {
    totalAvailableStock: number;
    totalReservedStock: number;
    totalDamagedStock: number;
    totalStock: number;
    unit: string;
    items: FinishedProductItem[];
  };
  rawMaterialsGroupedByUnit: RawMaterialUnitGroup[];
  individualMaterialBalances: RawMaterialItem[];
  lowStockAlerts: Array<{
    name: string;
    sku: string;
    category: string;
    availableQuantity: number;
    reorderLevel: number;
    unit: string;
    deficit: number;
  }>;
}

/**
 * Fetch list of active Aquzio Biodrops manufacturing tenants.
 */
export async function fetchAquzioTenants(): Promise<AquzioTenant[]> {
  return fetchWithAuth('/api/v1/integrations/biodrops/tenants');
}

// Backward-compatible alias
export const fetchBiodropsTenants = fetchAquzioTenants;

/**
 * Fetch detailed live inventory for a specific Aquzio tenant.
 */
export async function fetchTenantInventory(
  tenantId: string,
): Promise<TenantInventoryResponse> {
  return fetchWithAuth(
    `/api/v1/integrations/biodrops/tenants/${encodeURIComponent(tenantId)}/inventory`,
  );
}

/**
 * Fetch stock summary and raw material unit groupings for a specific Aquzio tenant.
 */
export async function fetchTenantStockSummary(
  tenantId: string,
): Promise<StockSummaryResponse> {
  return fetchWithAuth(
    `/api/v1/integrations/biodrops/tenants/${encodeURIComponent(tenantId)}/stock-summary`,
  );
}

export interface AdjustTenantStockPayload {
  sku: string;
  itemType?: 'RAW_MATERIAL' | 'FINISHED_PRODUCT';
  action: 'ADD' | 'SET' | 'DEDUCT';
  quantity: number;
  reason: string;
  notes?: string;
}

export interface AdjustTenantStockResponse {
  success: boolean;
  tenantId: string;
  sku: string;
  previousQuantity: number;
  newQuantity: number;
  unit: string;
  action: 'ADD' | 'SET' | 'DEDUCT';
  message: string;
  updatedAt: string;
}

/**
 * Adjust or update stock for a specific Aquzio tenant product or raw material.
 */
export async function adjustTenantStock(
  tenantId: string,
  payload: AdjustTenantStockPayload,
): Promise<AdjustTenantStockResponse> {
  return fetchWithAuth(
    `/api/v1/integrations/biodrops/tenants/${encodeURIComponent(tenantId)}/stock/adjust`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export interface AquzioSale {
  transactionId: string;
  transactionNumber: string;
  transactionDate: string;
  customerId?: string;
  customerName: string;
  productId: string;
  productName: string;
  sku?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalAmount: number;
  amountPaid: number;
  outstandingAmount: number;
  paymentStatus: string;
  paymentMethod?: string;
  status: string;
  remarks?: string;
  source: string;
  badgeLabel: string;
  createdAtUtc: string;
  updatedAtUtc?: string;
  tenantId?: string;
  tenantName?: string;
}

export type BiodropsSale = AquzioSale;

/**
 * Fetch 20L finished product sales for a specific Aquzio manufacturing tenant.
 */
export async function fetchTenantSales(tenantId: string): Promise<AquzioSale[]> {
  return fetchWithAuth(
    `/api/v1/integrations/biodrops/tenants/${encodeURIComponent(tenantId)}/sales`,
  );
}

/**
 * Fetch consolidated 20L finished product sales across all active Aquzio tenants in a single call.
 */
export async function fetchAllTenantSales(): Promise<AquzioSale[]> {
  return fetchWithAuth('/api/v1/integrations/biodrops/tenants/all/sales');
}


