export interface BiodropsTenantSummary {
  totalFinishedJars: number;
  rawMaterialsCount: number;
  lowStockAlerts: number;
  lastUpdated?: string;
}

export interface BiodropsTenant {
  id: string;
  companyName: string;
  code: string;
  subdomain?: string;
  productionStatus: 'ACTIVE' | 'ENABLED' | 'INACTIVE' | 'DISABLED' | string;
  isBiodropsEnabled: boolean;
  inventorySummary: BiodropsTenantSummary;
  lastRetrievedAt: string;
}

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

