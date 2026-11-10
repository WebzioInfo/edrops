import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { BiodropsService } from './biodrops.service';
import {
  CreateProductDto,
  CreateVendorDto,
  CreatePurchaseInvoiceDto,
  RecordVendorPaymentDto,
  CreateManufacturingCompanyDto,
  SetCoPackingRateDto,
  CreateMaterialIssueDto,
  RecordMfrProductionBatchDto,
  PerformQcDto,
  CreateManufacturerInvoiceDto,
  RecordMfrPaymentDto,
  CreateDistributorSaleDto,
  SettleJarOwnershipDto,
  CreateAccessorySaleDto,
  ConfigureSubscriptionPlanDto,
  AssignCustomerSubscriptionDto,
  CreateBulkPricingTierDto,
  CreateBulkSaleDto,
  ReceiveAquzioFinishedGoodsDto,
  CreateCustomizedSubscriptionSaleDto,
} from './dto/biodrops.dto';

@Controller('biodrops')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class BiodropsController {
  constructor(private readonly biodropsService: BiodropsService) {}

  // ============================================================================
  // PRODUCTS & UNIFIED CATALOGUE
  // ============================================================================
  @Get('products')
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.MANAGER, UserRole.DISTRIBUTOR)
  getProducts(
    @Query('categoryId') categoryId?: string,
    @Query('productType') productType?: string,
    @Query('search') search?: string,
  ) {
    return this.biodropsService.getProducts({ categoryId, productType, search });
  }

  @Get('categories')
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.MANAGER, UserRole.DISTRIBUTOR)
  getCategories() {
    return this.biodropsService.getCategories();
  }

  @Post('products')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  createProduct(@Body() dto: CreateProductDto) {
    return this.biodropsService.createProduct(dto);
  }

  // ============================================================================
  // VENDORS & RAW MATERIAL PROCUREMENT
  // ============================================================================
  @Get('vendors')
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.MANAGER)
  getVendors() {
    return this.biodropsService.getVendors();
  }

  @Post('vendors')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  createVendor(@Body() dto: CreateVendorDto) {
    return this.biodropsService.createVendor(dto);
  }

  @Get('vendors/:id/ledger')
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.MANAGER)
  getVendorLedger(@Param('id') vendorId: string) {
    return this.biodropsService.getVendorLedger(vendorId);
  }

  @Post('vendors/payment')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  recordVendorPayment(
    @Req() req: { user: { id: string } },
    @Body() dto: RecordVendorPaymentDto,
  ) {
    return this.biodropsService.recordVendorPayment(dto, req.user.id);
  }

  @Get('purchases')
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.MANAGER)
  getPurchaseInvoices() {
    return this.biodropsService.getPurchaseInvoices();
  }

  @Post('purchases')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  createPurchaseInvoice(
    @Req() req: { user: { id: string } },
    @Body() dto: CreatePurchaseInvoiceDto,
  ) {
    return this.biodropsService.createPurchaseInvoice(dto, req.user.id);
  }

  // ============================================================================
  // CONTRACT MANUFACTURING & CO-PACKING
  // ============================================================================
  @Get('manufacturers')
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.MANAGER)
  getManufacturers() {
    return this.biodropsService.getManufacturers();
  }

  @Post('manufacturers')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  createManufacturer(@Body() dto: CreateManufacturingCompanyDto) {
    return this.biodropsService.createManufacturer(dto);
  }

  @Post('manufacturers/rate')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  setCoPackingRate(@Body() dto: SetCoPackingRateDto) {
    return this.biodropsService.setCoPackingRate(dto);
  }

  @Get('manufacturers/material-issues')
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.MANAGER)
  getMaterialIssues(@Query('manufacturerId') manufacturerId?: string) {
    return this.biodropsService.getMaterialIssues(manufacturerId);
  }

  @Post('manufacturers/material-issues')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  createMaterialIssue(
    @Req() req: { user: { id: string } },
    @Body() dto: CreateMaterialIssueDto,
  ) {
    return this.biodropsService.createMaterialIssue(dto, req.user.id);
  }

  @Get('manufacturers/batches')
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.MANAGER)
  getProductionBatches(@Query('manufacturerId') manufacturerId?: string) {
    return this.biodropsService.getProductionBatches(manufacturerId);
  }

  @Post('manufacturers/batches')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  recordProductionBatch(
    @Req() req: { user: { id: string } },
    @Body() dto: RecordMfrProductionBatchDto,
  ) {
    return this.biodropsService.recordMfrProductionBatch(dto, req.user.id);
  }

  @Post('manufacturers/batches/:id/qc')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  performQc(
    @Req() req: { user: { id: string } },
    @Param('id') batchId: string,
    @Body() dto: PerformQcDto,
  ) {
    return this.biodropsService.performQc(batchId, dto, req.user.id);
  }

  @Get('manufacturers/invoices')
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.MANAGER)
  getManufacturerInvoices(@Query('manufacturerId') manufacturerId?: string) {
    return this.biodropsService.getManufacturerInvoices(manufacturerId);
  }

  @Post('manufacturers/invoices')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  createManufacturerInvoice(
    @Req() req: { user: { id: string } },
    @Body() dto: CreateManufacturerInvoiceDto,
  ) {
    return this.biodropsService.createManufacturerInvoice(dto, req.user.id);
  }

  @Post('manufacturers/payment')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  recordManufacturerPayment(
    @Req() req: { user: { id: string } },
    @Body() dto: RecordMfrPaymentDto,
  ) {
    return this.biodropsService.recordManufacturerPayment(dto, req.user.id);
  }

  @Get('manufacturers/:id/ledger')
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.MANAGER)
  getManufacturerLedger(@Param('id') mfrId: string) {
    return this.biodropsService.getManufacturerLedger(mfrId);
  }

  // ============================================================================
  // DISTRIBUTOR PRODUCT SALES (₹28 / ₹35)
  // ============================================================================
  @Get('distributor/sales')
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.MANAGER, UserRole.DISTRIBUTOR)
  getDistributorSales(
    @Req() req: { user: { id: string; role: string } },
    @Query('distributorId') distributorId?: string,
  ) {
    const targetDist =
      req.user.role === UserRole.DISTRIBUTOR ? req.user.id : distributorId;
    return this.biodropsService.getDistributorSales(targetDist);
  }

  @Post('distributor/sales')
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.DISTRIBUTOR)
  createDistributorSale(
    @Req() req: { user: { id: string; role: string } },
    @Body() dto: CreateDistributorSaleDto,
  ) {
    // If distributor ordering for themselves:
    if (req.user.role === UserRole.DISTRIBUTOR) {
      dto.distributorId = req.user.id;
    }
    return this.biodropsService.createDistributorSale(dto, req.user.id);
  }

  @Post('distributor/sales/:id/payments')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  recordDistributorSalePayment(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: { amount: number; paymentMethod?: string; notes?: string },
  ) {
    return this.biodropsService.recordDistributorSalePayment(id, dto, req.user.id);
  }

  // ============================================================================
  // EMPTY JAR OWNERSHIP TRANSFER ENGINE (₹250 RULE)
  // ============================================================================
  @Get('distributor/ownership/:distributorId')
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.MANAGER, UserRole.DISTRIBUTOR)
  getDistributorOwnershipStatus(
    @Req() req: { user: { id: string; role: string } },
    @Param('distributorId') distributorId: string,
  ) {
    const target = req.user.role === UserRole.DISTRIBUTOR ? req.user.id : distributorId;
    return this.biodropsService.getDistributorOwnershipStatus(target);
  }

  @Post('distributor/ownership/settle')
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.DISTRIBUTOR)
  settleJarOwnership(
    @Req() req: { user: { id: string; role: string } },
    @Body() dto: SettleJarOwnershipDto,
  ) {
    if (req.user.role === UserRole.DISTRIBUTOR) {
      dto.distributorId = req.user.id;
    }
    return this.biodropsService.settleJarOwnership(dto, req.user.id);
  }

  // ============================================================================
  // ACCESSORY INVENTORY & MULTI-CHANNEL SALES
  // ============================================================================
  @Get('accessories/inventory')
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.MANAGER, UserRole.DISTRIBUTOR)
  getAccessoryInventory(
    @Req() req: { user: { id: string; role: string } },
    @Query('distributorId') distributorId?: string,
  ) {
    const targetDist =
      req.user.role === UserRole.DISTRIBUTOR ? req.user.id : distributorId;
    return this.biodropsService.getAccessoryInventory(targetDist);
  }

  @Post('accessories/sales')
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.DISTRIBUTOR)
  createAccessorySale(
    @Req() req: { user: { id: string; role: string } },
    @Body() dto: CreateAccessorySaleDto,
  ) {
    if (req.user.role === UserRole.DISTRIBUTOR) {
      dto.distributorId = req.user.id;
    }
    return this.biodropsService.createAccessorySale(dto, req.user.id);
  }

  // ============================================================================
  // SUBSCRIPTION PLANS WITH ACCESSORIES & CUSTOMIZATION
  // ============================================================================
  @Get('subscriptions/plans')
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.MANAGER, UserRole.DISTRIBUTOR, UserRole.CUSTOMER)
  getSubscriptionPlans() {
    return this.biodropsService.getSubscriptionPlans();
  }

  @Post('subscriptions/plans')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  configureSubscriptionPlan(@Body() dto: ConfigureSubscriptionPlanDto) {
    return this.biodropsService.configureSubscriptionPlan(dto);
  }

  @Post('subscriptions/assign')
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.DISTRIBUTOR)
  assignCustomerSubscription(
    @Req() req: { user: { id: string; role: string } },
    @Body() dto: AssignCustomerSubscriptionDto,
  ) {
    const distId = req.user.role === UserRole.DISTRIBUTOR ? req.user.id : undefined;
    return this.biodropsService.assignSubscriptionToCustomer(dto, distId);
  }

  // ============================================================================
  // FINANCIAL REPORTS & RECONCILIATION
  // ============================================================================
  @Get('reports/financial-summary')
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.MANAGER)
  getFinancialReports() {
    return this.biodropsService.getFinancialReports();
  }

  // ============================================================================
  // AQUORA / BIOFIX UPSTREAM TENANT SYNC
  // ============================================================================
  @Post('sync-aquora-tenants')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  syncAquoraTenants(@Body() body: { tenants: any[] }) {
    return this.biodropsService.syncUpstreamTenants(body.tenants || []);
  }
  // ============================================================================
  // BULK PRICING TIERS & CALCULATION
  // ============================================================================
  @Post('bulk-pricing-tiers')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  createBulkPricingTier(@Body() dto: CreateBulkPricingTierDto) {
    return this.biodropsService.createBulkPricingTier(dto);
  }

  @Get('bulk-pricing-tiers')
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.MANAGER, UserRole.DISTRIBUTOR)
  getBulkPricingTiers(@Query('productId') productId?: string) {
    return this.biodropsService.getBulkPricingTiers(productId);
  }

  @Delete('bulk-pricing-tiers/:id')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  deleteBulkPricingTier(@Param('id') id: string) {
    return this.biodropsService.deleteBulkPricingTier(id);
  }

  @Get('calculate-bulk-price')
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.MANAGER, UserRole.DISTRIBUTOR)
  calculateBulkPrice(
    @Query('productId') productId: string,
    @Query('quantity') quantity: string,
    @Query('deliveryRequired') deliveryRequired: string,
  ) {
    const qty = parseInt(quantity, 10) || 1;
    const delivery = deliveryRequired === 'true';
    return this.biodropsService.calculateBulkPricing(productId, qty, delivery);
  }

  @Post('bulk-sales')
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.DISTRIBUTOR)
  createBulkSale(
    @Req() req: { user: { id: string; role: string } },
    @Body() dto: CreateBulkSaleDto,
  ) {
    if (req.user.role === UserRole.DISTRIBUTOR) {
      dto.distributorId = req.user.id;
    }
    return this.biodropsService.processBulkSale(dto, req.user.id);
  }

  // ============================================================================
  // AQUZIO FINISHED GOODS RECEIPT (IDEMPOTENT COMMERCIAL WAREHOUSE ADMISSION)
  // ============================================================================
  @Post('aquzio/receive-finished-goods')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  receiveAquzioFinishedGoods(@Body() dto: ReceiveAquzioFinishedGoodsDto) {
    return this.biodropsService.receiveAquzioFinishedGoods(dto);
  }

  // ============================================================================
  // DISTRIBUTOR PURCHASE PORTAL (DUAL-SOURCE BILLS SEPARATION)
  // ============================================================================
  @Get('distributor/:id/purchase-bills')
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.MANAGER, UserRole.DISTRIBUTOR)
  getDistributorPurchaseBills(
    @Req() req: { user: { id: string; role: string } },
    @Param('id') distId: string,
    @Query('source') source?: string,
  ) {
    const target = req.user.role === UserRole.DISTRIBUTOR ? req.user.id : distId;
    return this.biodropsService.getDistributorPurchaseBills(target, source);
  }

  // ============================================================================
  // ADVANCED SUBSCRIPTION CUSTOMIZATION (FREE & DISCOUNTED ACCESSORIES)
  // ============================================================================
  @Post('subscriptions/customized')
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.DISTRIBUTOR)
  createCustomizedSubscription(
    @Req() req: { user: { id: string; role: string } },
    @Body() dto: CreateCustomizedSubscriptionSaleDto,
  ) {
    if (req.user.role === UserRole.DISTRIBUTOR) {
      dto.distributorId = req.user.id;
    }
    return this.biodropsService.createCustomizedSubscription(dto, req.user.id);
  }

  // ============================================================================
  // COMMERCIAL REVENUE-FIRST DASHBOARD METRICS
  // ============================================================================
  @Get('commercial-dashboard-metrics')
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.MANAGER)
  getCommercialDashboardMetrics() {
    return this.biodropsService.getCommercialDashboardMetrics();
  }

}
