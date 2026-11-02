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

