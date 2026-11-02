import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
  Min,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  distributorPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  customerPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @IsOptional()
  @IsString()
  @IsIn(['WATER_PRODUCT', 'ACCESSORY', 'RAW_MATERIAL', 'PACKAGING'])
  productType?: string;

  @IsOptional()
  @IsString()
  hsnCode?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  gstRate?: number;

  @IsOptional()
  @IsString()
  uom?: string;

  @IsOptional()
  @IsNumber()
  minStockLevel?: number;

  @IsOptional()
  @IsBoolean()
  isJar?: boolean;

  @IsOptional()
  @IsNumber()
  depositAmount?: number;

  @IsString()
  categoryId: string;

  @IsString()
  brandId: string;
}

export class CreateVendorDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  contactPerson?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  gstin?: string;

  @IsOptional()
  @IsString()
  pan?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  pinCode?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsString()
  ifscCode?: string;

  @IsOptional()
  @IsNumber()
  openingBalance?: number;
}

export class PurchaseItemInput {
  @IsString()
  materialId: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsOptional()
  @IsString()
  hsnCode?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  gstRate?: number;
}

export class CreatePurchaseInvoiceDto {
  @IsString()
  vendorId: string;

  @IsString()
  invoiceNumber: string;

  @IsOptional()
  @IsString()
  invoiceDate?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemInput)
  items: PurchaseItemInput[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  amountPaid?: number;

  @IsOptional()
  @IsString()
  paymentMethod?: string;
}

export class RecordVendorPaymentDto {
  @IsString()
  vendorId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateManufacturingCompanyDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  externalTenantId?: string;

  @IsOptional()
  @IsString()
  gstin?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  contactPerson?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsString()
  ifscCode?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultCoPackingRate?: number;
}

export class SetCoPackingRateDto {
  @IsString()
  manufacturerId: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsNumber()
  @Min(0)
  rate: number;

  @IsOptional()
  @IsString()
  effectiveFrom?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class MaterialIssueItemInput {
  @IsString()
  materialId: string;

  @IsNumber()
  @Min(1)
  quantity: number;
}

export class CreateMaterialIssueDto {
  @IsString()
  manufacturerId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MaterialIssueItemInput)
  items: MaterialIssueItemInput[];

  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class MaterialConsumptionInput {
  @IsString()
  materialId: string;

  @IsNumber()
  @Min(0)
  consumed: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  wastage?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  returned?: number;
}

export class RecordMfrProductionBatchDto {
  @IsString()
  manufacturerId: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  challanId?: string;

  @IsNumber()
  @Min(1)
  plannedQuantity: number;

  @IsNumber()
  @Min(1)
  actualQuantity: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  rejectedQuantity?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MaterialConsumptionInput)
  consumptions?: MaterialConsumptionInput[];

  @IsOptional()
  @IsString()
  notes?: string;
}

export class PerformQcDto {
  @IsNumber()
  @Min(0)
  passedQuantity: number;

  @IsNumber()
  @Min(0)
  rejectedQuantity: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  warehouseId?: string;
}

export class CreateManufacturerInvoiceDto {
  @IsString()
  manufacturerId: string;

  @IsString()
  invoiceNumber: string;

  @IsOptional()
  @IsString()
  invoiceDate?: string;

  @IsOptional()
  @IsString()
  batchId?: string;

  @IsNumber()
  @Min(1)
  serviceQuantity: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  coPackingRate?: number;

  @IsOptional()
  @IsString()
  sacCode?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  gstRate?: number;

  @IsOptional()
  @IsNumber()
  amountPaid?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class RecordMfrPaymentDto {
  @IsString()
  manufacturerId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class SaleItemInput {
  @IsString()
  productId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;
}

export class CreateDistributorSaleDto {
  @IsString()
  distributorId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaleItemInput)
  items: SaleItemInput[];

  @IsBoolean()
  deliveryRequired: boolean;

  @IsOptional()
  @IsString()
  paymentStatus?: string; // PAID, CREDIT, PARTIAL

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsNumber()
  amountPaid?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class SettleJarOwnershipDto {
  @IsString()
  distributorId: string;

  @IsNumber()
  @Min(1)
  paymentAmount: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  ratePerJar?: number; // Default 250.0

  @IsOptional()
  @IsString()
  paymentReference?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateAccessorySaleDto {
  @IsString()
  @IsIn(['EDROPS_TO_DISTRIBUTOR', 'DISTRIBUTOR_TO_CUSTOMER', 'EDROPS_TO_CUSTOMER'])
  channel: string;

  @IsOptional()
  @IsString()
  distributorId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsString()
  productId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsOptional()
  @IsString()
  paymentStatus?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ConfigureSubscriptionPlanDto {
  @IsString()
  packageId: string;

  @IsNumber()
  @Min(1)
  waterQuotaPerCycle: number;

  @IsOptional()
  @IsArray()
  freeAccessories?: { productId: string; quantity: number }[];

  @IsOptional()
  @IsArray()
  discountedAccessories?: { productId: string; discountedPrice: number }[];

  @IsOptional()
  @IsString()
  promotionalBadge?: string;
}

export class AssignCustomerSubscriptionDto {
  @IsString()
  customerId: string;

  @IsString()
  packageId: string;

  @IsOptional()
  @IsArray()
  selectedAddOns?: { productId: string; quantity: number }[];

  @IsOptional()
  @IsString()
  startDate?: string;
}


export class CreateBulkPricingTierDto {
  @IsString()
  productId: string;

  @IsNumber()
  @Min(1)
  minQuantity: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxQuantity?: number;

  @IsNumber()
  @Min(0)
  pickupPrice: number;

  @IsNumber()
  @Min(0)
  deliveryPrice: number;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateBulkSaleDto {
  @IsString()
  distributorId: string;

  @IsBoolean()
  deliveryRequired: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['QUOTATION', 'CONFIRMED', 'DISPATCHED', 'INVOICE', 'CANCELLED'])
  orderStage?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaleItemInput)
  items: SaleItemInput[];

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  paymentStatus?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amountPaid?: number;

  @IsOptional()
  @IsString()
  distributorPoNumber?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReceiveAquzioFinishedGoodsDto {
  @IsString()
  externalBatchId: string;

  @IsString()
  productId: string;

  @IsNumber()
  @Min(1)
  productionQuantity: number;

  @IsNumber()
  @Min(0)
  acceptedQuantity: number;

  @IsNumber()
  @Min(0)
  rejectedQuantity: number;

  @IsString()
  qcApprovalStatus: string;

  @IsString()
  idempotencyKey: string;

  @IsOptional()
  @IsString()
  productionDate?: string;

  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateCustomizedSubscriptionSaleDto {
  @IsString()
  customerId: string;

  @IsString()
  packageId: string;

  @IsOptional()
  @IsString()
  distributorId?: string;

  @IsOptional()
  @IsArray()
  selectedFreeAccessories?: { productId: string; quantity: number }[];

  @IsOptional()
  @IsArray()
  selectedDiscountedAccessories?: { productId: string; quantity: number; unitPrice: number }[];

  @IsOptional()
  @IsString()
  frequency?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsNumber()
  amountPaid?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
