import { BadRequestException, ConflictException } from '@nestjs/common';
import { BiodropsService } from './biodrops.service';

describe('Biodrops ERP Master Ecosystem Test Suite', () => {
  let service: BiodropsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      brand: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      category: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      warehouse: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      product: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      warehouseStock: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      stockMovement: {
        create: jest.fn(),
      },
      rawMaterialItem: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      rawMaterialMovement: {
        create: jest.fn(),
      },
      vendor: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      vendorLedgerEntry: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      rawMaterialPurchaseInvoice: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      manufacturingCompany: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      manufacturerCoPackingRate: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      manufacturerRawMaterialStock: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
      materialIssueChallan: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      materialIssueItem: {
        create: jest.fn(),
      },
      manufacturingBatch: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      manufacturerServiceInvoice: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      manufacturerLedgerEntry: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      distributor: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      distributorSale: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      distributorOwnershipLedger: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      jarInventoryItem: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      distributorAccessoryStock: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      accessorySale: {
        create: jest.fn(),
      },
      package: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      packagePurchase: {
        create: jest.fn(),
      },
      subscriptionPlanConfig: {
        upsert: jest.fn(),
      },
      customer: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(async (callback) => callback(mockPrisma)),
      $queryRawUnsafe: jest.fn(),
    };

    service = new BiodropsService(mockPrisma);
  });

  // ============================================================================
  // SCENARIO A: RAW MATERIAL PROCUREMENT
  // ============================================================================
  describe('SCENARIO A: Vendor and Raw Material Procurement', () => {
    it('records raw material purchase, increases central stock, creates vendor payable and calculates GST', async () => {
      mockPrisma.vendor.findUnique.mockResolvedValue({
        id: 'vendor-1',
        name: 'Alpha PolyPack Industries',
        state: 'Kerala',
        currentBalance: 0.0,
      });

      mockPrisma.rawMaterialPurchaseInvoice.findUnique.mockResolvedValue(null);

      mockPrisma.rawMaterialItem.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.id === 'mat-jar') {
          return { id: 'mat-jar', name: '20L Empty Jar', centralStock: 1000 };
        }
        if (where.id === 'mat-cap') {
          return { id: 'mat-cap', name: 'Smart Cap', centralStock: 5000 };
        }
        return null;
      });

      mockPrisma.rawMaterialItem.update.mockResolvedValue({});
      mockPrisma.rawMaterialMovement.create.mockResolvedValue({});
      mockPrisma.vendor.update.mockResolvedValue({});
      mockPrisma.vendorLedgerEntry.create.mockResolvedValue({});

      mockPrisma.rawMaterialPurchaseInvoice.create.mockImplementation(async ({ data }: any) => ({
        id: 'inv-1',
        ...data,
      }));

      const result = await service.createPurchaseInvoice(
        {
          vendorId: 'vendor-1',
          invoiceNumber: 'INV-RAW-001',
          items: [
            { materialId: 'mat-jar', quantity: 1000, unitPrice: 150.0, gstRate: 18.0 },
            { materialId: 'mat-cap', quantity: 1000, unitPrice: 4.5, gstRate: 18.0 },
          ],
          amountPaid: 50000.0,
        },
        'admin-user',
      );

      // Verify subtotal: (1000 * 150) + (1000 * 4.5) = 150,000 + 4,500 = 154,500
      expect(result.subtotal).toBe(154500.0);
      // Tax: 18% of 154,500 = 27,810 (CGST: 13,905, SGST: 13,905)
      expect(result.taxAmount).toBe(27810.0);
      expect(result.cgst).toBe(13905.0);
      expect(result.sgst).toBe(13905.0);
      expect(result.totalAmount).toBe(182310.0);
      expect(result.paymentStatus).toBe('PARTIALLY_PAID');

      // Verify raw material stock increments
      expect(mockPrisma.rawMaterialItem.update).toHaveBeenCalledWith({
        where: { id: 'mat-jar' },
        data: { centralStock: { increment: 1000 } },
      });
      expect(mockPrisma.rawMaterialItem.update).toHaveBeenCalledWith({
        where: { id: 'mat-cap' },
        data: { centralStock: { increment: 1000 } },
      });

      // Verify vendor payable updated: total 182,310 - 50,000 paid = 132,310
      expect(mockPrisma.vendor.update).toHaveBeenCalledWith({
        where: { id: 'vendor-1' },
        data: { currentBalance: 132310.0 },
      });
    });

    it('rejects duplicate purchase invoice numbers (Idempotency)', async () => {
      mockPrisma.vendor.findUnique.mockResolvedValue({ id: 'vendor-1', name: 'Alpha PolyPack' });
      mockPrisma.rawMaterialPurchaseInvoice.findUnique.mockResolvedValue({
        id: 'inv-existing',
        invoiceNumber: 'INV-DUP-01',
      });

      await expect(
        service.createPurchaseInvoice({
          vendorId: 'vendor-1',
          invoiceNumber: 'INV-DUP-01',
          items: [{ materialId: 'mat-1', quantity: 100, unitPrice: 10.0 }],
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ============================================================================
  // SCENARIO B: CONTRACT MANUFACTURING & QC
  // ============================================================================
  describe('SCENARIO B: Contract Manufacturing & QC Approval', () => {
    it('issues raw materials free-of-charge for co-packing and tracks manufacturer-held balances', async () => {
      mockPrisma.manufacturingCompany.findUnique.mockResolvedValue({
        id: 'mfr-1',
        name: 'Faiha Water Solutions',
      });

      mockPrisma.$queryRawUnsafe.mockResolvedValue([
        { id: 'mat-cap', name: 'Smart Cap', code: 'MAT-CAP-20L', centralStock: 5000 },
      ]);

      mockPrisma.rawMaterialItem.update.mockResolvedValue({});
      mockPrisma.manufacturerRawMaterialStock.upsert.mockResolvedValue({});
      mockPrisma.materialIssueChallan.create.mockResolvedValue({ id: 'challan-1' });
      mockPrisma.materialIssueItem.create.mockResolvedValue({ id: 'item-1' });
      mockPrisma.rawMaterialMovement.create.mockResolvedValue({});

      const result = await service.createMaterialIssue(
        {
          manufacturerId: 'mfr-1',
          items: [{ materialId: 'mat-cap', quantity: 500 }],
        },
        'staff-1',
      );

      expect(result.success).toBe(true);
      // Central stock decremented
      expect(mockPrisma.rawMaterialItem.update).toHaveBeenCalledWith({
        where: { id: 'mat-cap' },
        data: { centralStock: { decrement: 500 } },
      });
      // Manufacturer holding incremented
      expect(mockPrisma.manufacturerRawMaterialStock.upsert).toHaveBeenCalledWith({
        where: {
          manufacturerId_materialId: { manufacturerId: 'mfr-1', materialId: 'mat-cap' },
        },
        create: { manufacturerId: 'mfr-1', materialId: 'mat-cap', quantity: 500 },
        update: { quantity: { increment: 500 } },
      });
    });

    it('records batch production, consumes materials and calculates co-packing service fee', async () => {
      mockPrisma.manufacturingCompany.findUnique.mockResolvedValue({
        id: 'mfr-1',
        name: 'Faiha Water Solutions',
        defaultCoPackingRate: 15.0,
      });

      mockPrisma.manufacturerRawMaterialStock.findUnique.mockResolvedValue({
        id: 'stock-1',
        quantity: 500,
        material: { category: 'CAP', unitCost: 4.5 },
      });

      mockPrisma.manufacturerRawMaterialStock.update.mockResolvedValue({});
      mockPrisma.manufacturingBatch.create.mockImplementation(async ({ data }: any) => ({
        id: 'batch-1',
        ...data,
      }));

      const result = await service.recordMfrProductionBatch(
        {
          manufacturerId: 'mfr-1',
          plannedQuantity: 500,
          actualQuantity: 480,
          rejectedQuantity: 0,
          consumptions: [{ materialId: 'mat-cap', consumed: 480, wastage: 10, returned: 10 }],
        },
        'supervisor-1',
      );

      expect(result.success).toBe(true);
      // Co-packing fee: 480 jars * ₹15.0 = ₹7,200
      expect(result.batch.coPackingCost).toBe(7200.0);
      expect(result.batch.coPackingRate).toBe(15.0);
    });

    it('QC approval increments Edrops saleable warehouse stock only for passed items', async () => {
      mockPrisma.manufacturingBatch.findUnique.mockResolvedValue({
        id: 'batch-1',
        batchNumber: 'BATCH-001',
        actualQuantity: 480,
        qcStatus: 'PENDING',
        manufacturer: { name: 'Faiha Water Solutions' },
        productId: 'prod-jar-20l',
      });

      mockPrisma.warehouse.findFirst.mockResolvedValue({ id: 'wh-central' });
      mockPrisma.warehouseStock.upsert.mockResolvedValue({});
      mockPrisma.stockMovement.create.mockResolvedValue({});
      mockPrisma.manufacturingBatch.update.mockResolvedValue({});

      const qcResult = await service.performQc('batch-1', {
        passedQuantity: 475,
        rejectedQuantity: 5,
      });

      expect(qcResult.success).toBe(true);
      expect(qcResult.inventoryIncremented).toBe(475);
      expect(qcResult.rejectedQuantity).toBe(5);
      expect(qcResult.qcStatus).toBe('PARTIALLY_PASSED');

      // Saleable finished goods stock increased by exactly 475 (not 480!)
      expect(mockPrisma.warehouseStock.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { quantity: { increment: 475 } },
        }),
      );
    });

    it('creates manufacturer GST co-packing invoice without double counting raw materials', async () => {
      mockPrisma.manufacturingCompany.findUnique.mockResolvedValue({
        id: 'mfr-1',
        name: 'Faiha Water Solutions',
        defaultCoPackingRate: 15.0,
        state: 'Kerala',
        currentPayable: 0.0,
      });

      mockPrisma.manufacturerServiceInvoice.findUnique.mockResolvedValue(null);
      mockPrisma.manufacturerServiceInvoice.create.mockImplementation(async ({ data }: any) => ({
        id: 'mfr-inv-1',
        ...data,
      }));
      mockPrisma.manufacturingCompany.update.mockResolvedValue({});
      mockPrisma.manufacturerLedgerEntry.create.mockResolvedValue({});

      const invoice = await service.createManufacturerInvoice({
        manufacturerId: 'mfr-1',
        invoiceNumber: 'MFR-INV-480',
        serviceQuantity: 480,
        coPackingRate: 15.0,
        sacCode: '9988',
        gstRate: 18.0,
      });

      // 480 * ₹15 = ₹7,200
      expect(invoice.taxableAmount).toBe(7200.0);
      // 18% GST = ₹1,296 (CGST: ₹648, SGST: ₹648)
      expect(invoice.cgst + invoice.sgst + invoice.igst).toBe(1296.0);
      expect(invoice.cgst).toBe(648.0);
      expect(invoice.sgst).toBe(648.0);
      expect(invoice.totalAmount).toBe(8496.0);

      // Payable updated
      expect(mockPrisma.manufacturingCompany.update).toHaveBeenCalledWith({
        where: { id: 'mfr-1' },
        data: { currentPayable: 8496.0 },
      });
    });
  });

  // ============================================================================
  // SCENARIO C: DISTRIBUTOR PRODUCT SALES (₹28 / ₹35 RULE)
  // ============================================================================
  describe('SCENARIO C: Distributor Sales & Delivery-Inclusive Pricing', () => {
    it('applies ₹28 per jar for pickup without delivery and decrements central warehouse stock', async () => {
      mockPrisma.distributor.findFirst.mockResolvedValue({
        id: 'dist-1',
        agencyName: 'Calicut Pure Drops',
        user: { firstName: 'Ali', lastName: 'Khan' },
      });

      mockPrisma.warehouse.findFirst.mockResolvedValue({ id: 'wh-1' });
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'prod-jar',
        name: '20L Biodrops Water Jar',
        sku: 'BIO-JAR-20L',
        isJar: true,
        gstRate: 18.0,
        hsnCode: '2201',
      });

      mockPrisma.warehouseStock.findUnique.mockResolvedValue({
        quantity: 500,
      });
      mockPrisma.warehouseStock.update.mockResolvedValue({});
      mockPrisma.stockMovement.create.mockResolvedValue({});
      mockPrisma.jarInventoryItem.findFirst.mockResolvedValue({ id: 'company-item' });
      mockPrisma.jarInventoryItem.update.mockResolvedValue({});

      mockPrisma.distributorSale.create.mockImplementation(async ({ data }: any) => ({
        id: 'sale-1',
        ...data,
      }));

      const sale = await service.createDistributorSale({
        distributorId: 'dist-1',
        deliveryRequired: false, // PICKUP
        items: [{ productId: 'prod-jar', quantity: 100 }],
        paymentStatus: 'PAID',
      });

      // Price: 100 * ₹28 = ₹2,800
      expect(sale.subtotal).toBe(2800.0);
      // 18% GST: 504 (CGST: 252, SGST: 252)
      expect(sale.taxAmount).toBe(504.0);
      expect(sale.totalAmount).toBe(3304.0);
      // Finished goods stock decreased by 100
      expect(mockPrisma.warehouseStock.update).toHaveBeenCalledWith({
        where: {
          warehouseId_productId: { warehouseId: 'wh-1', productId: 'prod-jar' },
        },
        data: { quantity: { decrement: 100 } },
      });
    });

    it('applies ₹35 per jar for delivery-inclusive sale as a single product price (NO separate freight line)', async () => {
      mockPrisma.distributor.findFirst.mockResolvedValue({
        id: 'dist-1',
        agencyName: 'Calicut Pure Drops',
        user: { firstName: 'Ali', lastName: 'Khan' },
      });

      mockPrisma.warehouse.findFirst.mockResolvedValue({ id: 'wh-1' });
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'prod-jar',
        name: '20L Biodrops Water Jar',
        sku: 'BIO-JAR-20L',
        isJar: true,
        gstRate: 18.0,
        hsnCode: '2201',
      });

      mockPrisma.warehouseStock.findUnique.mockResolvedValue({ quantity: 500 });
      mockPrisma.warehouseStock.update.mockResolvedValue({});
      mockPrisma.stockMovement.create.mockResolvedValue({});
      mockPrisma.jarInventoryItem.findFirst.mockResolvedValue({ id: 'company-item' });
      mockPrisma.jarInventoryItem.update.mockResolvedValue({});

      mockPrisma.distributorSale.create.mockImplementation(async ({ data }: any) => ({
        id: 'sale-2',
        ...data,
        items: data.items.create,
      }));

      const sale: any = await service.createDistributorSale({
        distributorId: 'dist-1',
        deliveryRequired: true, // WITH DELIVERY
        items: [{ productId: 'prod-jar', quantity: 100 }],
        paymentStatus: 'PAID',
      });

      // Single rate: 100 * ₹35 = ₹3,500
      expect(sale.subtotal).toBe(3500.0);
      // 18% GST: 630 (CGST: 315, SGST: 315)
      expect(sale.taxAmount).toBe(630.0);
      expect(sale.totalAmount).toBe(4130.0);
      // Only 1 item line generated (NO separate ₹7 freight line)
      expect(sale.items.length).toBe(1);
      expect(sale.items[0].unitPrice).toBe(35.0);
    });
  });

  // ============================================================================
  // SCENARIO D: EMPTY JAR OWNERSHIP TRANSFER (THE EXACT TEST SCENARIO)
  // ============================================================================
  describe('SCENARIO D: Payment-Based Empty Jar Ownership Transfer (₹250 Rule)', () => {
    it('executes exact multi-stage ownership transfer: 200 jars, ₹37.5k payment (150 jars), ₹5k payment (20 jars), ₹7.5k remaining', async () => {
      // Step 1: Initial state: Distributor holds 200 jars (all Edrops-owned initially)
      mockPrisma.distributor.findFirst.mockResolvedValue({ id: 'dist-1' });

      // Stage 1: Distributor pays ₹37,500 (150 jars @ ₹250)
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([
        { id: 'dist-1', companyOwnedJars: 200, distributorOwnedJars: 0, jarDepositRate: 250.0 },
      ]);
      mockPrisma.distributorOwnershipLedger.findFirst.mockResolvedValue(null);
      mockPrisma.distributor.update.mockResolvedValue({});
      mockPrisma.jarInventoryItem.findFirst.mockResolvedValue({
        id: 'item-comp',
        filledYardQuantity: 150,
        emptyYardQuantity: 50,
      });
      mockPrisma.jarInventoryItem.update.mockResolvedValue({});
      mockPrisma.distributorOwnershipLedger.create.mockImplementation(async ({ data }: any) => ({
        id: 'own-1',
        ...data,
      }));

      const step1 = await service.settleJarOwnership({
        distributorId: 'dist-1',
        paymentAmount: 37500.0,
      });

      expect(step1.jarsTransferred).toBe(150);
      expect(step1.companyJarsAfter).toBe(50);
      expect(step1.distributorJarsAfter).toBe(150);
      expect(step1.physicalJarsTotal).toBe(200);
      expect(step1.outstandingOwnershipBalance).toBe(12500.0); // 50 * ₹250

      // Stage 2: Distributor pays ₹5,000 (transfers 20 jars @ ₹250)
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([
        { id: 'dist-1', companyOwnedJars: 50, distributorOwnedJars: 150, jarDepositRate: 250.0 },
      ]);

      const step2 = await service.settleJarOwnership({
        distributorId: 'dist-1',
        paymentAmount: 5000.0,
      });

      expect(step2.jarsTransferred).toBe(20);
      expect(step2.companyJarsAfter).toBe(30);
      expect(step2.distributorJarsAfter).toBe(170);
      expect(step2.physicalJarsTotal).toBe(200);
      expect(step2.outstandingOwnershipBalance).toBe(7500.0); // 30 * ₹250

      // Stage 3: Distributor pays remaining ₹7,500 (transfers remaining 30 jars)
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([
        { id: 'dist-1', companyOwnedJars: 30, distributorOwnedJars: 170, jarDepositRate: 250.0 },
      ]);

      const step3 = await service.settleJarOwnership({
        distributorId: 'dist-1',
        paymentAmount: 7500.0,
      });

      expect(step3.jarsTransferred).toBe(30);
      expect(step3.companyJarsAfter).toBe(0);
      expect(step3.distributorJarsAfter).toBe(200);
      expect(step3.physicalJarsTotal).toBe(200);
      expect(step3.outstandingOwnershipBalance).toBe(0.0); // 0 * ₹250
    });

    it('preserves unapplied remainder when payment does not evenly divide by ₹250 without fractional jars', async () => {
      mockPrisma.distributor.findFirst.mockResolvedValue({ id: 'dist-1' });
      mockPrisma.$queryRawUnsafe.mockResolvedValue([
        { id: 'dist-1', companyOwnedJars: 50, distributorOwnedJars: 10, jarDepositRate: 250.0 },
      ]);
      mockPrisma.distributorOwnershipLedger.findFirst.mockResolvedValue(null);
      mockPrisma.distributor.update.mockResolvedValue({});
      mockPrisma.jarInventoryItem.findFirst.mockResolvedValue(null);
      mockPrisma.distributorOwnershipLedger.create.mockImplementation(async ({ data }: any) => ({
        id: 'own-rem',
        ...data,
      }));

      // Pay ₹1,200: 4 jars @ ₹250 = ₹1,000. Remainder = ₹200.
      const result = await service.settleJarOwnership({
        distributorId: 'dist-1',
        paymentAmount: 1200.0,
      });

      expect(result.jarsTransferred).toBe(4);
      expect(result.settlementCost).toBe(1000.0);
      expect(result.unappliedCredit).toBe(200.0);
    });

    it('rejects attempt to settle more jars than available in Edrops ownership', async () => {
      mockPrisma.distributor.findFirst.mockResolvedValue({ id: 'dist-1' });
      mockPrisma.$queryRawUnsafe.mockResolvedValue([
        { id: 'dist-1', companyOwnedJars: 10, distributorOwnedJars: 190, jarDepositRate: 250.0 },
      ]);

      // Attempt to settle 20 jars (payment of ₹5,000) when only 10 are available
      await expect(
        service.settleJarOwnership({
          distributorId: 'dist-1',
          paymentAmount: 5000.0,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ============================================================================
  // SCENARIO E & F: ACCESSORIES & SUBSCRIPTION CUSTOMIZATION
  // ============================================================================
  describe('SCENARIO E & F: Accessories & Subscription Customization', () => {
    it('manages accessory inventory movement across Edrops and Distributor channels', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'acc-disp',
        name: 'Electric Water Dispenser',
        productType: 'ACCESSORY',
        price: 1800.0,
        gstRate: 18.0,
      });

      mockPrisma.distributor.findFirst.mockResolvedValue({ id: 'dist-1' });
      mockPrisma.warehouse.findFirst.mockResolvedValue({ id: 'wh-1' });
      mockPrisma.warehouseStock.findUnique.mockResolvedValue({ quantity: 50 });
      mockPrisma.warehouseStock.update.mockResolvedValue({});
      mockPrisma.distributorAccessoryStock.upsert.mockResolvedValue({});
      mockPrisma.accessorySale.create.mockImplementation(async ({ data }: any) => ({
        id: 'acc-sale-1',
        ...data,
      }));

      // Edrops sells 10 dispensers to Distributor
      const sale = await service.createAccessorySale({
        channel: 'EDROPS_TO_DISTRIBUTOR',
        distributorId: 'dist-1',
        productId: 'acc-disp',
        quantity: 10,
        unitPrice: 1350.0,
      });

      expect(sale.quantity).toBe(10);
      expect(sale.taxableAmount).toBe(13500.0);
      // Decrements central warehouse stock
      expect(mockPrisma.warehouseStock.update).toHaveBeenCalledWith({
        where: { warehouseId_productId: { warehouseId: 'wh-1', productId: 'acc-disp' } },
        data: { quantity: { decrement: 10 } },
      });
      // Increments distributor accessory holding
      expect(mockPrisma.distributorAccessoryStock.upsert).toHaveBeenCalledWith({
        where: { distributorId_productId: { distributorId: 'dist-1', productId: 'acc-disp' } },
        create: { distributorId: 'dist-1', productId: 'acc-disp', quantity: 10 },
        update: { quantity: { increment: 10 } },
      });
    });

    it('assigns custom subscription and deducts promotional free accessory stock', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue({
        id: 'cust-1',
        user: { firstName: 'Rahul', lastName: 'Nair' },
      });

      mockPrisma.package.findUnique.mockResolvedValue({
        id: 'pkg-premium',
        name: 'Biodrops Premium Plan',
        price: 999.0,
        planConfig: {
          waterQuotaPerCycle: 30,
          freeAccessories: [{ productId: 'acc-stand', quantity: 1 }],
        },
      });

      mockPrisma.packagePurchase.create.mockResolvedValue({ id: 'purchase-1' });
      mockPrisma.warehouse.findFirst.mockResolvedValue({ id: 'wh-1' });
      mockPrisma.warehouseStock.update.mockResolvedValue({});

      const result = await service.assignSubscriptionToCustomer({
        customerId: 'cust-1',
        packageId: 'pkg-premium',
      });

      expect(result.success).toBe(true);
      // Stock deducted for free accessory
      expect(mockPrisma.warehouseStock.update).toHaveBeenCalledWith({
        where: { warehouseId_productId: { warehouseId: 'wh-1', productId: 'acc-stand' } },
        data: { quantity: { decrement: 1 } },
      });
    });
  });
});
