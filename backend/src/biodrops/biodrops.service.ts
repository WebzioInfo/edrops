import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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
} from './dto/biodrops.dto';

@Injectable()
export class BiodropsService {
  private readonly logger = new Logger(BiodropsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // 1. DEFAULT DATA INITIALIZATION
  // ============================================================================
  async ensureEcosystemDefaults() {
    // 1. Ensure Brand 'Biodrops' exists
    let brand = await this.prisma.brand.findFirst({
      where: { name: 'Biodrops' },
    });
    if (!brand) {
      brand = await this.prisma.brand.create({
        data: {
          name: 'Biodrops',
          description: 'Premium Packaged Drinking Water & Accessories',
        },
      });
    }

    // 2. Ensure standard Categories exist
    const categories = [
      { name: 'Drinking Water Products', description: 'Packaged drinking water products' },
      { name: 'Water Accessories', description: 'Dispensers, stands and accessories' },
      { name: 'Packaging and Raw Materials', description: 'Bottles, preforms, caps, sleeves, labels' },
    ];

    const categoryMap = new Map<string, string>();
    for (const cat of categories) {
      let c = await this.prisma.category.findUnique({
        where: { name: cat.name },
      });
      if (!c) {
        c = await this.prisma.category.create({
          data: cat,
        });
      }
      categoryMap.set(cat.name, c.id);
    }

    // 3. Ensure Default Godown/Warehouse exists
    let warehouse = await this.prisma.warehouse.findFirst({
      where: { name: 'Edrops Central Godown' },
    });
    if (!warehouse) {
      warehouse = await this.prisma.warehouse.create({
        data: {
          name: 'Edrops Central Godown',
          location: 'Main Distribution Hub, Sector 1',
          managerName: 'Operations Lead',
        },
      });
    }

    // 4. Ensure Baseline Products exist
    const defaultProducts = [
      {
        sku: 'BIO-JAR-20L',
        name: '20L Biodrops Water Jar',
        description: '20L Packed Mineral Water Jar with Tamper-Proof Smart Seal',
        price: 35.0, // Customer direct price
        distributorPrice: 28.0, // Distributor pickup default price
        customerPrice: 35.0,
        costPrice: 22.5, // Standard reference cost
        productType: 'WATER_PRODUCT',
        hsnCode: '2201',
        gstRate: 18.0,
        uom: 'JAR',
        isJar: true,
        depositAmount: 250.0, // Reference empty jar deposit / acquisition price
        categoryId: categoryMap.get('Drinking Water Products')!,
        brandId: brand.id,
      },
      {
        sku: 'BIO-WATER-5L',
        name: '5L Biodrops Drinking Water',
        description: '5L Convenient Family Pack Mineral Water',
        price: 65.0,
        distributorPrice: 50.0,
        customerPrice: 65.0,
        costPrice: 35.0,
        productType: 'WATER_PRODUCT',
        hsnCode: '2201',
        gstRate: 18.0,
        uom: 'CAN',
        isJar: false,
        depositAmount: 0.0,
        categoryId: categoryMap.get('Drinking Water Products')!,
        brandId: brand.id,
      },
      {
        sku: 'ACC-ELEC-DISP',
        name: 'Electric Water Dispenser',
        description: 'Rechargeable Automatic Water Pump with USB Charging',
        price: 1800.0,
        distributorPrice: 1350.0,
        customerPrice: 1800.0,
        costPrice: 950.0,
        productType: 'ACCESSORY',
        hsnCode: '8413',
        gstRate: 18.0,
        uom: 'PCS',
        isJar: false,
        depositAmount: 0.0,
        categoryId: categoryMap.get('Water Accessories')!,
        brandId: brand.id,
      },
      {
        sku: 'ACC-STAND-DISP',
        name: 'Stand Dispenser',
        description: 'Ergonomic Tabletop Stand Dispenser for 20L Jars',
        price: 650.0,
        distributorPrice: 480.0,
        customerPrice: 650.0,
        costPrice: 320.0,
        productType: 'ACCESSORY',
        hsnCode: '3926',
        gstRate: 18.0,
        uom: 'PCS',
        isJar: false,
        depositAmount: 0.0,
        categoryId: categoryMap.get('Water Accessories')!,
        brandId: brand.id,
      },
      {
        sku: 'ACC-NORMAL-5L',
        name: 'Normal 5L Dispenser Tap',
        description: 'Manual Water Tap Attachment for 5L Jars',
        price: 350.0,
        distributorPrice: 240.0,
        customerPrice: 350.0,
        costPrice: 150.0,
        productType: 'ACCESSORY',
        hsnCode: '3926',
        gstRate: 18.0,
        uom: 'PCS',
        isJar: false,
        depositAmount: 0.0,
        categoryId: categoryMap.get('Water Accessories')!,
        brandId: brand.id,
      },
      {
        sku: 'ACC-JAR-STAND',
        name: 'Water Jar Metal Stand',
        description: 'Heavy Duty Metal Floor Stand for 20L Water Jars',
        price: 450.0,
        distributorPrice: 320.0,
        customerPrice: 450.0,
        costPrice: 210.0,
        productType: 'ACCESSORY',
        hsnCode: '7326',
        gstRate: 18.0,
        uom: 'PCS',
        isJar: false,
        depositAmount: 0.0,
        categoryId: categoryMap.get('Water Accessories')!,
        brandId: brand.id,
      },
    ];

    for (const p of defaultProducts) {
      const existing = await this.prisma.product.findFirst({
        where: { OR: [{ sku: p.sku }, { name: p.name }] },
      });
      if (!existing) {
        const createdProd = await this.prisma.product.create({
          data: p,
        });
        // Create initial stock record in central warehouse
        await this.prisma.warehouseStock.upsert({
          where: {
            warehouseId_productId: {
              warehouseId: warehouse.id,
              productId: createdProd.id,
            },
          },
          create: {
            warehouseId: warehouse.id,
            productId: createdProd.id,
            quantity: 500,
            reservedQty: 0,
          },
          update: {},
        });
      }
    }

    // 5. Ensure baseline raw materials exist
    const defaultRawMaterials = [
      {
        code: 'MAT-JAR-EMPTY-20L',
        name: '20L Empty Polycarbonate Water Jar (Raw Container)',
        category: 'EMPTY_JAR',
        unit: 'PCS',
        centralStock: 5000,
        reorderLevel: 500,
        unitCost: 150.0,
      },
      {
        code: 'MAT-CAP-20L',
        name: '20L Jar Non-Spill Smart Cap',
        category: 'CAP',
        unit: 'PCS',
        centralStock: 25000,
        reorderLevel: 2500,
        unitCost: 4.5,
      },
      {
        code: 'MAT-STICKER-20L',
        name: 'Biodrops 20L Front Brand Sticker',
        category: 'STICKER',
        unit: 'PCS',
        centralStock: 25000,
        reorderLevel: 2500,
        unitCost: 2.0,
      },
      {
        code: 'MAT-SLEEVE-20L',
        name: 'Biodrops 20L Neck Shrink Sleeve',
        category: 'SLEEVE',
        unit: 'PCS',
        centralStock: 25000,
        reorderLevel: 2500,
        unitCost: 1.5,
      },
      {
        code: 'MAT-LABEL-20L',
        name: 'Biodrops 20L Regulatory Batch Label',
        category: 'LABEL',
        unit: 'PCS',
        centralStock: 25000,
        reorderLevel: 2500,
        unitCost: 1.0,
      },
    ];

    for (const m of defaultRawMaterials) {
      const existing = await this.prisma.rawMaterialItem.findUnique({
        where: { code: m.code },
      });
      if (!existing) {
        await this.prisma.rawMaterialItem.create({
          data: m,
        });
      }
    }

    // 6. Ensure default mineral water manufacturing companies exist
    const defaultMfrs = [
      {
        name: 'Faiha Water Solutions',
        gstIN: '32AABCF1234F1Z5',
        address: 'Plot 12, Industrial Estate, Wayanad Road',
        city: 'Calicut',
        state: 'Kerala',
        contactPerson: 'Mujeeb Rahman',
        phone: '+919847012345',
        email: 'faiha.water@example.com',
        defaultCoPackingRate: 15.0,
      },
      {
        name: 'Gangothri Aqua Tech',
        gstIN: '32AABCG5678G1Z8',
        address: 'SIPCOT Industrial Park',
        city: 'Palakkad',
        state: 'Kerala',
        contactPerson: 'Suresh Kumar',
        phone: '+919847123456',
        email: 'gangothri.aqua@example.com',
        defaultCoPackingRate: 16.0,
      },
      {
        name: 'Greenmount Aquaa',
        gstIN: '32AABCG9101G1Z1',
        address: 'Highland Springs Zone',
        city: 'Kochi',
        state: 'Kerala',
        contactPerson: 'Antony Joseph',
        phone: '+919847234567',
        email: 'greenmount@example.com',
        defaultCoPackingRate: 14.5,
      },
      {
        name: 'Greenway Water Manufactures',
        gstIN: '32AABCG3456G1Z4',
        address: 'Bypass Road, West Hill',
        city: 'Kannur',
        state: 'Kerala',
        contactPerson: 'Nidhin Das',
        phone: '+919847345678',
        email: 'greenway.mfg@example.com',
        defaultCoPackingRate: 15.0,
      },
    ];

    for (const mfr of defaultMfrs) {
      const existing = await this.prisma.manufacturingCompany.findFirst({
        where: { name: mfr.name },
      });
      if (!existing) {
        await this.prisma.manufacturingCompany.create({
          data: {
            name: mfr.name,
            gstin: mfr.gstIN,
            address: mfr.address,
            city: mfr.city,
            state: mfr.state,
            contactPerson: mfr.contactPerson,
            phone: mfr.phone,
            email: mfr.email,
            defaultCoPackingRate: mfr.defaultCoPackingRate,
            currentPayable: 0.0,
          },
        });
      }
    }

    // 7. Ensure baseline Vendor exists
    const defaultVendor = await this.prisma.vendor.findFirst({
      where: { name: 'Alpha PolyPack Industries' },
    });
    if (!defaultVendor) {
      await this.prisma.vendor.create({
        data: {
          name: 'Alpha PolyPack Industries',
          contactPerson: 'Rajesh Varma',
          phone: '+919895012345',
          email: 'sales@alphapolypack.com',
          gstin: '32AAACA1234A1Z9',
          city: 'Coimbatore',
          state: 'Tamil Nadu',
          openingBalance: 0.0,
          currentBalance: 0.0,
        },
      });
    }
  }

  // ============================================================================
  // 2. PRODUCT CATALOGUE & PRICING
  // ============================================================================
  async getProducts(query?: { categoryId?: string; productType?: string; search?: string }) {
    await this.ensureEcosystemDefaults();

    const where: any = { status: 'ACTIVE' };
    if (query?.categoryId) where.categoryId = query.categoryId;
    if (query?.productType) where.productType = query.productType;
    if (query?.search?.trim()) {
      where.OR = [
        { name: { contains: query.search.trim(), mode: 'insensitive' } },
        { sku: { contains: query.search.trim(), mode: 'insensitive' } },
      ];
    }

    const products = await this.prisma.product.findMany({
      where,
      include: {
        category: true,
        brand: true,
        stock: {
          include: { warehouse: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return products.map((p) => {
      const totalWarehouseStock = p.stock.reduce((acc, s) => acc + s.quantity, 0);
      const reservedStock = p.stock.reduce((acc, s) => acc + s.reservedQty, 0);
      return {
        ...p,
        totalStock: totalWarehouseStock,
        availableStock: Math.max(0, totalWarehouseStock - reservedStock),
      };
    });
  }

  async getCategories() {
    await this.ensureEcosystemDefaults();
    return this.prisma.category.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async createProduct(dto: CreateProductDto) {
    if (dto.sku) {
      const existing = await this.prisma.product.findFirst({
        where: { sku: dto.sku.trim() },
      });
      if (existing) {
        throw new ConflictException(`Product with SKU ${dto.sku} already exists`);
      }
    }

    const warehouse = await this.prisma.warehouse.findFirst({
      where: { name: 'Edrops Central Godown' },
    });

    const product = await this.prisma.product.create({
      data: {
        name: dto.name,
        sku: dto.sku?.trim().toUpperCase(),
        description: dto.description,
        price: dto.price,
        distributorPrice: dto.distributorPrice ?? dto.price,
        customerPrice: dto.customerPrice ?? dto.price,
        costPrice: dto.costPrice ?? 0.0,
        productType: dto.productType ?? 'WATER_PRODUCT',
        hsnCode: dto.hsnCode,
        gstRate: dto.gstRate ?? 18.0,
        uom: dto.uom ?? 'PCS',
        minStockLevel: dto.minStockLevel ?? 10,
        isJar: dto.isJar ?? false,
        depositAmount: dto.depositAmount ?? 0.0,
        categoryId: dto.categoryId,
        brandId: dto.brandId,
      },
    });

    if (warehouse) {
      await this.prisma.warehouseStock.create({
        data: {
          warehouseId: warehouse.id,
          productId: product.id,
          quantity: 0,
          reservedQty: 0,
        },
      });
    }

    return product;
  }

  // ============================================================================
  // 3. VENDOR & RAW MATERIAL PROCUREMENT
  // ============================================================================
  async getVendors() {
    await this.ensureEcosystemDefaults();
    return this.prisma.vendor.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async createVendor(dto: CreateVendorDto) {
    return this.prisma.vendor.create({
      data: {
        name: dto.name,
        contactPerson: dto.contactPerson,
        phone: dto.phone,
        email: dto.email,
        gstin: dto.gstin,
        pan: dto.pan,
        address: dto.address,
        city: dto.city,
        state: dto.state,
        pinCode: dto.pinCode,
        bankName: dto.bankName,
        accountNumber: dto.accountNumber,
        ifscCode: dto.ifscCode,
        openingBalance: dto.openingBalance ?? 0.0,
        currentBalance: dto.openingBalance ?? 0.0,
      },
    });
  }

  async getVendorLedger(vendorId: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');

    const ledger = await this.prisma.vendorLedgerEntry.findMany({
      where: { vendorId },
      orderBy: { date: 'asc' },
    });

    return {
      vendor,
      ledger,
    };
  }

  async createPurchaseInvoice(dto: CreatePurchaseInvoiceDto, actingUserId?: string) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one line item is required');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Verify vendor
      const vendor = await tx.vendor.findUnique({
        where: { id: dto.vendorId },
      });
      if (!vendor) throw new NotFoundException('Vendor not found');

      // 2. Check invoice uniqueness (Idempotency)
      const existing = await tx.rawMaterialPurchaseInvoice.findUnique({
        where: { invoiceNumber: dto.invoiceNumber.trim() },
      });
      if (existing) {
        throw new ConflictException(`Invoice number ${dto.invoiceNumber} already recorded`);
      }

      // 3. Calculate Line Items and Taxes
      let subtotal = 0;
      let totalTax = 0;
      let totalCgst = 0;
      let totalSgst = 0;
      let totalIgst = 0;

      const processedItems: any[] = [];

      for (const item of dto.items) {
        const material = await tx.rawMaterialItem.findUnique({
          where: { id: item.materialId },
        });
        if (!material) {
          throw new NotFoundException(`Raw material item ${item.materialId} not found`);
        }

        const taxable = item.quantity * item.unitPrice;
        const rate = item.gstRate ?? 18.0;
        const taxVal = (taxable * rate) / 100.0;

        // Determine inter-state (IGST) vs intra-state (CGST + SGST) based on vendor state
        const isInterState = vendor.state && vendor.state.toLowerCase() !== 'kerala';
        const cgst = isInterState ? 0 : taxVal / 2.0;
        const sgst = isInterState ? 0 : taxVal / 2.0;
        const igst = isInterState ? taxVal : 0;
        const lineTotal = taxable + taxVal;

        subtotal += taxable;
        totalTax += taxVal;
        totalCgst += cgst;
        totalSgst += sgst;
        totalIgst += igst;

        processedItems.push({
          materialId: item.materialId,
          productId: item.productId || null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          hsnCode: item.hsnCode || '3923',
          gstRate: rate,
          taxableAmount: taxable,
          cgst,
          sgst,
          igst,
          totalAmount: lineTotal,
        });

        // 4. ATOMIC RAW MATERIAL INVENTORY INCREMENT (CENTRAL STOCK)
        await tx.rawMaterialItem.update({
          where: { id: material.id },
          data: {
            centralStock: { increment: item.quantity },
          },
        });

        // Log material movement
        await tx.rawMaterialMovement.create({
          data: {
            materialId: material.id,
            type: 'CENTRAL_RECEIPT',
            quantity: item.quantity,
            balanceAfter: material.centralStock + item.quantity,
            referenceId: dto.invoiceNumber,
            notes: `Purchased from ${vendor.name} via Invoice #${dto.invoiceNumber}`,
            createdById: actingUserId || null,
          },
        });
      }

      const totalAmount = subtotal + totalTax;
      const amountPaid = dto.amountPaid ?? 0.0;
      const paymentStatus =
        amountPaid >= totalAmount ? 'PAID' : amountPaid > 0 ? 'PARTIALLY_PAID' : 'PENDING';

      // 5. Create Purchase Invoice
      const invoice = await tx.rawMaterialPurchaseInvoice.create({
        data: {
          invoiceNumber: dto.invoiceNumber.trim(),
          invoiceDate: dto.invoiceDate ? new Date(dto.invoiceDate) : new Date(),
          vendorId: vendor.id,
          subtotal,
          cgst: totalCgst,
          sgst: totalSgst,
          igst: totalIgst,
          taxAmount: totalTax,
          totalAmount,
          paymentStatus,
          amountPaid,
          payments:
            amountPaid > 0
              ? [
                  {
                    amount: amountPaid,
                    date: new Date().toISOString(),
                    method: dto.paymentMethod || 'BANK_TRANSFER',
                  },
                ]
              : [],
          stockUpdated: true,
          notes: dto.notes,
          createdById: actingUserId || null,
          items: {
            create: processedItems,
          },
        },
        include: { items: true },
      });

      // 6. Post Financial Ledger Entry for Vendor Payable
      const newPayableBalance = vendor.currentBalance + (totalAmount - amountPaid);
      await tx.vendor.update({
        where: { id: vendor.id },
        data: { currentBalance: newPayableBalance },
      });

      // Credit entry: Vendor bill
      await tx.vendorLedgerEntry.create({
        data: {
          vendorId: vendor.id,
          type: 'PURCHASE_INVOICE',
          referenceNumber: invoice.invoiceNumber,
          description: `Raw Material Purchase Invoice #${invoice.invoiceNumber}`,
          debit: 0.0,
          credit: totalAmount,
          balance: vendor.currentBalance + totalAmount,
          invoiceId: invoice.id,
        },
      });

      // Debit entry if payment made upfront
      if (amountPaid > 0) {
        await tx.vendorLedgerEntry.create({
          data: {
            vendorId: vendor.id,
            type: 'PAYMENT',
            referenceNumber: `PMT-${invoice.invoiceNumber}`,
            description: `Payment for Purchase Invoice #${invoice.invoiceNumber}`,
            debit: amountPaid,
            credit: 0.0,
            balance: newPayableBalance,
            invoiceId: invoice.id,
          },
        });
      }

      return invoice;
    });
  }

  async recordVendorPayment(dto: RecordVendorPaymentDto, actingUserId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const vendor = await tx.vendor.findUnique({
        where: { id: dto.vendorId },
      });
      if (!vendor) throw new NotFoundException('Vendor not found');

      const updatedBalance = vendor.currentBalance - dto.amount;
      await tx.vendor.update({
        where: { id: vendor.id },
        data: { currentBalance: updatedBalance },
      });

      const entry = await tx.vendorLedgerEntry.create({
        data: {
          vendorId: vendor.id,
          type: 'PAYMENT',
          referenceNumber: dto.referenceNumber || `PMT-${Date.now()}`,
          description: dto.notes || `Vendor Payment via ${dto.paymentMethod || 'BANK_TRANSFER'}`,
          debit: dto.amount,
          credit: 0.0,
          balance: updatedBalance,
        },
      });

      return {
        success: true,
        vendorBalance: updatedBalance,
        ledgerEntry: entry,
      };
    });
  }

  async getPurchaseInvoices() {
    await this.ensureEcosystemDefaults();
    return this.prisma.rawMaterialPurchaseInvoice.findMany({
      include: {
        vendor: { select: { id: true, name: true, gstin: true } },
        items: {
          include: {
            material: { select: { id: true, name: true, code: true, unit: true } },
          },
        },
      },
      orderBy: { invoiceDate: 'desc' },
    });
  }

  // ============================================================================
  // 4. CONTRACT MANUFACTURING / CO-PACKING MANAGEMENT
  // ============================================================================
  async getManufacturers() {
    await this.ensureEcosystemDefaults();
    return this.prisma.manufacturingCompany.findMany({
      where: { isActive: true },
      include: {
        rates: true,
        stocks: {
          include: { material: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createManufacturer(dto: CreateManufacturingCompanyDto) {
    return this.prisma.manufacturingCompany.create({
      data: {
        name: dto.name,
        externalTenantId: dto.externalTenantId,
        gstin: dto.gstin,
        address: dto.address,
        city: dto.city,
        state: dto.state,
        contactPerson: dto.contactPerson,
        phone: dto.phone,
        email: dto.email,
        bankName: dto.bankName,
        accountNumber: dto.accountNumber,
        ifscCode: dto.ifscCode,
        defaultCoPackingRate: dto.defaultCoPackingRate ?? 15.0,
      },
    });
  }

  async setCoPackingRate(dto: SetCoPackingRateDto) {
    const mfr = await this.prisma.manufacturingCompany.findUnique({
      where: { id: dto.manufacturerId },
    });
    if (!mfr) throw new NotFoundException('Manufacturing company not found');

    const rate = await this.prisma.manufacturerCoPackingRate.create({
      data: {
        manufacturerId: mfr.id,
        productId: dto.productId || null,
        rate: dto.rate,
        effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date(),
        notes: dto.notes,
      },
    });

    // Also update default rate if no product specific
    if (!dto.productId) {
      await this.prisma.manufacturingCompany.update({
        where: { id: mfr.id },
        data: { defaultCoPackingRate: dto.rate },
      });
    }

    return rate;
  }

  /**
   * ISSUE RAW MATERIALS TO MANUFACTURER (FREE OF CHARGE FOR CO-PACKING)
   * Material remains Edrops-owned. It is NOT a sale.
   */
  async createMaterialIssue(dto: CreateMaterialIssueDto, actingUserId?: string) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one material must be issued');
    }

    return this.prisma.$transaction(async (tx) => {
      const mfr = await tx.manufacturingCompany.findUnique({
        where: { id: dto.manufacturerId },
      });
      if (!mfr) throw new NotFoundException('Manufacturing company not found');

      const challanNumber = `CHALLAN-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

      const challan = await tx.materialIssueChallan.create({
        data: {
          challanNumber,
          issueDate: new Date(),
          manufacturerId: mfr.id,
          warehouseId: dto.warehouseId || null,
          status: 'ISSUED',
          notes: dto.notes || `Issued raw materials free-of-charge for Biodrops co-packing`,
          createdById: actingUserId || null,
        },
      });

      const issueItems: any[] = [];

      for (const item of dto.items) {
        // Lock material row in central warehouse
        const rows = await tx.$queryRawUnsafe<any[]>(
          `SELECT "id", "name", "code", "centralStock" FROM "raw_material_items" WHERE "id" = $1 FOR UPDATE`,
          item.materialId,
        );
        if (!rows || rows.length === 0) {
          throw new NotFoundException(`Material ${item.materialId} not found`);
        }
        const material = rows[0];

        if (material.centralStock < item.quantity) {
          throw new BadRequestException(
            `Insufficient central stock for ${material.name}. Available: ${material.centralStock}, Requested: ${item.quantity}`,
          );
        }

        // Deduct central stock
        await tx.rawMaterialItem.update({
          where: { id: material.id },
          data: { centralStock: { decrement: item.quantity } },
        });

        // Increment manufacturer-held stock
        await tx.manufacturerRawMaterialStock.upsert({
          where: {
            manufacturerId_materialId: {
              manufacturerId: mfr.id,
              materialId: material.id,
            },
          },
          create: {
            manufacturerId: mfr.id,
            materialId: material.id,
            quantity: item.quantity,
          },
          update: {
            quantity: { increment: item.quantity },
          },
        });

        // Create challan item
        const challanItem = await tx.materialIssueItem.create({
          data: {
            challanId: challan.id,
            materialId: material.id,
            quantity: item.quantity,
          },
        });

        // Log movement
        await tx.rawMaterialMovement.create({
          data: {
            materialId: material.id,
            type: 'ISSUED_TO_MANUFACTURER',
            quantity: item.quantity,
            balanceAfter: material.centralStock - item.quantity,
            referenceId: challanNumber,
            notes: `Issued ${item.quantity} units to manufacturer ${mfr.name}`,
            createdById: actingUserId || null,
          },
        });

        issueItems.push(challanItem);
      }

      return {
        success: true,
        challan,
        items: issueItems,
      };
    });
  }

  async getMaterialIssues(mfrId?: string) {
    const where: any = {};
    if (mfrId) where.manufacturerId = mfrId;

    return this.prisma.materialIssueChallan.findMany({
      where,
      include: {
        manufacturer: { select: { id: true, name: true, gstin: true } },
        items: {
          include: {
            material: { select: { id: true, name: true, code: true, unit: true } },
          },
        },
      },
      orderBy: { issueDate: 'desc' },
    });
  }

  /**
   * RECORD PRODUCTION BATCH & CONSUMPTIONS
   */
  async recordMfrProductionBatch(dto: RecordMfrProductionBatchDto, actingUserId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const mfr = await tx.manufacturingCompany.findUnique({
        where: { id: dto.manufacturerId },
      });
      if (!mfr) throw new NotFoundException('Manufacturing company not found');

      // Fetch dynamic co-packing rate for this manufacturer
      let effectiveRate = mfr.defaultCoPackingRate || 15.0;
      if (dto.productId) {
        const prodRate = await tx.manufacturerCoPackingRate.findFirst({
          where: {
            manufacturerId: mfr.id,
            productId: dto.productId,
          },
          orderBy: { effectiveFrom: 'desc' },
        });
        if (prodRate) effectiveRate = prodRate.rate;
      }

      const batchNumber = `BATCH-BIO-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

      // Deduct consumed materials from manufacturer stock
      const consumptionsLog: any[] = [];
      let totalConsumablesCost = 0.0;

      if (dto.consumptions && dto.consumptions.length > 0) {
        for (const c of dto.consumptions) {
          const totalDeduction = c.consumed + (c.wastage || 0);
          if (totalDeduction <= 0) continue;

          const mfrStock = await tx.manufacturerRawMaterialStock.findUnique({
            where: {
              manufacturerId_materialId: {
                manufacturerId: mfr.id,
                materialId: c.materialId,
              },
            },
            include: { material: true },
          });

          if (!mfrStock || mfrStock.quantity < totalDeduction) {
            const avail = mfrStock ? mfrStock.quantity : 0;
            throw new BadRequestException(
              `Insufficient manufacturer stock for material ${c.materialId}. Available: ${avail}, Required: ${totalDeduction}`,
            );
          }

          // Decrement manufacturer stock
          await tx.manufacturerRawMaterialStock.update({
            where: {
              manufacturerId_materialId: {
                manufacturerId: mfr.id,
                materialId: c.materialId,
              },
            },
            data: {
              quantity: { decrement: totalDeduction },
            },
          });

          // Calculate consumable cost (caps + stickers + sleeves + labels; note: empty jars are assets)
          if (mfrStock.material.category !== 'EMPTY_JAR') {
            totalConsumablesCost += totalDeduction * mfrStock.material.unitCost;
          }

          // Return unused materials to Edrops central stock if any
          if (c.returned && c.returned > 0) {
            await tx.rawMaterialItem.update({
              where: { id: c.materialId },
              data: { centralStock: { increment: c.returned } },
            });
            await tx.rawMaterialMovement.create({
              data: {
                materialId: c.materialId,
                type: 'RETURNED_TO_EDROPS',
                quantity: c.returned,
                balanceAfter: 0,
                referenceId: batchNumber,
                batchNumber,
                notes: `Returned unused ${c.returned} units from batch ${batchNumber}`,
                createdById: actingUserId || null,
              },
            });
          }

          consumptionsLog.push({
            materialId: c.materialId,
            consumed: c.consumed,
            wastage: c.wastage || 0,
            returned: c.returned || 0,
          });
        }
      }

      const acceptedQuantity = dto.actualQuantity - (dto.rejectedQuantity || 0);
      const coPackingCost = acceptedQuantity * effectiveRate;
      const totalProductionCost = coPackingCost + totalConsumablesCost;
      const unitCost = acceptedQuantity > 0 ? totalProductionCost / acceptedQuantity : 0.0;

      const batch = await tx.manufacturingBatch.create({
        data: {
          batchNumber,
          manufacturerId: mfr.id,
          productId: dto.productId || null,
          challanId: dto.challanId || null,
          productionDate: new Date(),
          plannedQuantity: dto.plannedQuantity,
          actualQuantity: dto.actualQuantity,
          rejectedQuantity: dto.rejectedQuantity || 0,
          acceptedQuantity,
          qcStatus: 'PENDING',
          coPackingRate: effectiveRate,
          coPackingCost,
          consumablesCost: totalConsumablesCost,
          totalProductionCost,
          unitCost,
          consumptions: consumptionsLog,
          notes: dto.notes,
          createdById: actingUserId || null,
        },
      });

      return {
        success: true,
        batch,
      };
    });
  }

  async getProductionBatches(mfrId?: string) {
    const where: any = {};
    if (mfrId) where.manufacturerId = mfrId;

    return this.prisma.manufacturingBatch.findMany({
      where,
      include: {
        manufacturer: { select: { id: true, name: true, gstin: true } },
      },
      orderBy: { productionDate: 'desc' },
    });
  }

  /**
   * QUALITY CHECK APPROVAL & FINISHED GOODS INVENTORY RECEIPT
   * Only QC passed units enter saleable Edrops finished inventory.
   * Rejected units are quarantined.
   */
  async performQc(batchId: string, dto: PerformQcDto, actingUserId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.manufacturingBatch.findUnique({
        where: { id: batchId },
        include: { manufacturer: true },
      });
      if (!batch) throw new NotFoundException('Production batch not found');

      if (batch.qcStatus === 'PASSED') {
        throw new BadRequestException('Batch has already passed QC and inventory has been posted');
      }

      if (dto.passedQuantity + dto.rejectedQuantity > batch.actualQuantity) {
        throw new BadRequestException('QC quantity cannot exceed actual produced quantity');
      }

      // Determine product: default to 20L Biodrops Jar if not specified
      let productId = batch.productId;
      if (!productId) {
        const defaultJar = await tx.product.findFirst({
          where: { sku: 'BIO-JAR-20L' },
        });
        if (defaultJar) productId = defaultJar.id;
      }

      if (!productId) {
        throw new NotFoundException('Biodrops 20L Water Jar product not configured');
      }

      // 1. Update batch QC status
      const qcStatus = dto.rejectedQuantity > 0 ? (dto.passedQuantity > 0 ? 'PARTIALLY_PASSED' : 'REJECTED') : 'PASSED';
      await tx.manufacturingBatch.update({
        where: { id: batch.id },
        data: {
          qcPassedQuantity: dto.passedQuantity,
          qcRejectedQuantity: dto.rejectedQuantity,
          qcStatus,
          qcNotes: dto.notes,
          qcApprovedAt: new Date(),
          qcApprovedById: actingUserId || null,
          goodsReceiptRecorded: true,
        },
      });

      // 2. Receipt into Edrops Central Godown ONLY for passedQuantity
      if (dto.passedQuantity > 0) {
        const warehouse = await tx.warehouse.findFirst({
          where: dto.warehouseId ? { id: dto.warehouseId } : { name: 'Edrops Central Godown' },
        });

        if (warehouse) {
          await tx.warehouseStock.upsert({
            where: {
              warehouseId_productId: {
                warehouseId: warehouse.id,
                productId,
              },
            },
            create: {
              warehouseId: warehouse.id,
              productId,
              quantity: dto.passedQuantity,
              reservedQty: 0,
            },
            update: {
              quantity: { increment: dto.passedQuantity },
            },
          });

          // Log stock movement
          await tx.stockMovement.create({
            data: {
              warehouseId: warehouse.id,
              productId,
              type: 'FINISHED_GOODS_RECEIPT',
              quantity: dto.passedQuantity,
              referenceId: batch.batchNumber,
              reason: `QC Passed receipt from batch ${batch.batchNumber} (${batch.manufacturer.name})`,
            },
          });
        }
      }

      return {
        success: true,
        batchNumber: batch.batchNumber,
        passedQuantity: dto.passedQuantity,
        rejectedQuantity: dto.rejectedQuantity,
        qcStatus,
        inventoryIncremented: dto.passedQuantity,
      };
    });
  }

  // ============================================================================
  // 5. MANUFACTURER PURCHASE INVOICE & GST (CO-PACKING SERVICE CHARGE)
  // ============================================================================
  /**
   * The invoice represents the co-packing service fee (e.g. 480 × ₹15 = ₹7,200 + GST).
   * Does NOT include Edrops-owned raw materials as a second purchase.
   */
  async createManufacturerInvoice(dto: CreateManufacturerInvoiceDto, actingUserId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const mfr = await tx.manufacturingCompany.findUnique({
        where: { id: dto.manufacturerId },
      });
      if (!mfr) throw new NotFoundException('Manufacturing company not found');

      // Check unique invoice
      const existing = await tx.manufacturerServiceInvoice.findUnique({
        where: { invoiceNumber: dto.invoiceNumber.trim() },
      });
      if (existing) {
        throw new ConflictException(`Invoice number ${dto.invoiceNumber} already recorded`);
      }

      const rate = dto.coPackingRate ?? mfr.defaultCoPackingRate ?? 15.0;
      const taxableAmount = dto.serviceQuantity * rate;
      const gstRate = dto.gstRate ?? 18.0;
      const taxVal = (taxableAmount * gstRate) / 100.0;

      const isInterState = mfr.state && mfr.state.toLowerCase() !== 'kerala';
      const cgst = isInterState ? 0 : taxVal / 2.0;
      const sgst = isInterState ? 0 : taxVal / 2.0;
      const igst = isInterState ? taxVal : 0;
      const totalAmount = taxableAmount + taxVal;

      const amountPaid = dto.amountPaid ?? 0.0;
      const paymentStatus =
        amountPaid >= totalAmount ? 'PAID' : amountPaid > 0 ? 'PARTIALLY_PAID' : 'PENDING';

      const invoice = await tx.manufacturerServiceInvoice.create({
        data: {
          invoiceNumber: dto.invoiceNumber.trim(),
          invoiceDate: dto.invoiceDate ? new Date(dto.invoiceDate) : new Date(),
          manufacturerId: mfr.id,
          batchId: dto.batchId || null,
          sacCode: dto.sacCode || '9988', // Job work / manufacturing services on physical inputs owned by others
          serviceQuantity: dto.serviceQuantity,
          coPackingRate: rate,
          taxableAmount,
          gstRate,
          cgst,
          sgst,
          igst,
          totalAmount,
          paymentStatus,
          amountPaid,
          payments:
            amountPaid > 0
              ? [
                  {
                    amount: amountPaid,
                    date: new Date().toISOString(),
                    method: 'BANK_TRANSFER',
                  },
                ]
              : [],
          notes: dto.notes,
          createdById: actingUserId || null,
        },
      });

      // Update manufacturer payable
      const newPayable = mfr.currentPayable + (totalAmount - amountPaid);
      await tx.manufacturingCompany.update({
        where: { id: mfr.id },
        data: { currentPayable: newPayable },
      });

      // Post to Manufacturer Ledger (Credit entry for service bill)
      await tx.manufacturerLedgerEntry.create({
        data: {
          manufacturerId: mfr.id,
          type: 'SERVICE_INVOICE',
          referenceNumber: invoice.invoiceNumber,
          description: `Co-packing service invoice #${invoice.invoiceNumber} (${dto.serviceQuantity} jars @ ₹${rate})`,
          debit: 0.0,
          credit: totalAmount,
          balance: mfr.currentPayable + totalAmount,
          invoiceId: invoice.id,
        },
      });

      // Debit entry if payment made
      if (amountPaid > 0) {
        await tx.manufacturerLedgerEntry.create({
          data: {
            manufacturerId: mfr.id,
            type: 'PAYMENT',
            referenceNumber: `PMT-${invoice.invoiceNumber}`,
            description: `Payment for co-packing invoice #${invoice.invoiceNumber}`,
            debit: amountPaid,
            credit: 0.0,
            balance: newPayable,
            invoiceId: invoice.id,
          },
        });
      }

      return invoice;
    });
  }

  async recordManufacturerPayment(dto: RecordMfrPaymentDto, actingUserId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const mfr = await tx.manufacturingCompany.findUnique({
        where: { id: dto.manufacturerId },
      });
      if (!mfr) throw new NotFoundException('Manufacturing company not found');

      const updatedPayable = mfr.currentPayable - dto.amount;
      await tx.manufacturingCompany.update({
        where: { id: mfr.id },
        data: { currentPayable: updatedPayable },
      });

      const entry = await tx.manufacturerLedgerEntry.create({
        data: {
          manufacturerId: mfr.id,
          type: 'PAYMENT',
          referenceNumber: dto.referenceNumber || `PMT-MFR-${Date.now()}`,
          description: dto.notes || `Payment made via ${dto.paymentMethod || 'BANK_TRANSFER'}`,
          debit: dto.amount,
          credit: 0.0,
          balance: updatedPayable,
        },
      });

      return {
        success: true,
        manufacturerPayable: updatedPayable,
        ledgerEntry: entry,
      };
    });
  }

  async getManufacturerInvoices(mfrId?: string) {
    const where: any = {};
    if (mfrId) where.manufacturerId = mfrId;

    return this.prisma.manufacturerServiceInvoice.findMany({
      where,
      include: {
        manufacturer: { select: { id: true, name: true, gstin: true } },
      },
      orderBy: { invoiceDate: 'desc' },
    });
  }

  async getManufacturerLedger(mfrId: string) {
    const mfr = await this.prisma.manufacturingCompany.findUnique({
      where: { id: mfrId },
    });
    if (!mfr) throw new NotFoundException('Manufacturing company not found');

    const ledger = await this.prisma.manufacturerLedgerEntry.findMany({
      where: { manufacturerId: mfrId },
      orderBy: { date: 'asc' },
    });

    return {
      manufacturer: mfr,
      ledger,
    };
  }

  // ============================================================================
  // 6. DISTRIBUTOR COMMERCE & DELIVERY-INCLUSIVE GST (₹28 / ₹35)
  // ============================================================================
  /**
   * ₹28 without delivery (pickup)
   * ₹35 with delivery
   * The ₹35 delivery-inclusive price is ONE product selling price.
   * NO separate ₹7 transportation line.
   */
  async createDistributorSale(dto: CreateDistributorSaleDto, actingUserId?: string) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one item is required in the sale');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Verify distributor
      const distributor = await tx.distributor.findFirst({
        where: {
          OR: [{ id: dto.distributorId }, { userId: dto.distributorId }],
        },
        include: { user: true },
      });
      if (!distributor) throw new NotFoundException('Distributor not found');

      const warehouse = await tx.warehouse.findFirst({
        where: { name: 'Edrops Central Godown' },
      });

      const invoiceNumber = `INV-DIST-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

      let subtotal = 0;
      let totalCgst = 0;
      let totalSgst = 0;
      let totalIgst = 0;
      let totalTax = 0;

      const processedItems: any[] = [];
      let totalWaterJars = 0;

      for (const item of dto.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });
        if (!product) throw new NotFoundException(`Product ${item.productId} not found`);

        // Check central stock
        if (warehouse) {
          const stock = await tx.warehouseStock.findUnique({
            where: {
              warehouseId_productId: {
                warehouseId: warehouse.id,
                productId: product.id,
              },
            },
          });
          if (!stock || stock.quantity < item.quantity) {
            const avail = stock ? stock.quantity : 0;
            throw new BadRequestException(
              `Insufficient warehouse stock for ${product.name}. Available: ${avail}, Requested: ${item.quantity}`,
            );
          }

          // Decrement Edrops warehouse finished goods stock
          await tx.warehouseStock.update({
            where: {
              warehouseId_productId: {
                warehouseId: warehouse.id,
                productId: product.id,
              },
            },
            data: { quantity: { decrement: item.quantity } },
          });

          // Log movement
          await tx.stockMovement.create({
            data: {
              warehouseId: warehouse.id,
              productId: product.id,
              type: 'DISTRIBUTOR_SALE',
              quantity: -item.quantity,
              referenceId: invoiceNumber,
              reason: `Sold to distributor ${distributor.agencyName || distributor.user.firstName}`,
            },
          });
        }

        // Determine price according to business rule:
        // If 20L water jar: ₹35 with delivery, ₹28 without delivery
        let unitPrice = item.unitPrice;
        if (!unitPrice) {
          if (product.isJar || product.sku === 'BIO-JAR-20L') {
            unitPrice = dto.deliveryRequired ? 35.0 : 28.0;
          } else {
            unitPrice = product.distributorPrice ?? product.price;
          }
        }

        if (product.isJar || product.sku === 'BIO-JAR-20L') {
          totalWaterJars += item.quantity;
        } else if (product.productType === 'ACCESSORY') {
          // Increment distributor accessory inventory
          await tx.distributorAccessoryStock.upsert({
            where: {
              distributorId_productId: {
                distributorId: distributor.id,
                productId: product.id,
              },
            },
            create: {
              distributorId: distributor.id,
              productId: product.id,
              quantity: item.quantity,
            },
            update: {
              quantity: { increment: item.quantity },
            },
          });
        }

        const taxable = item.quantity * unitPrice - (item.discount || 0);
        const rate = product.gstRate || 18.0;
        const taxVal = (taxable * rate) / 100.0;
        const cgst = taxVal / 2.0;
        const sgst = taxVal / 2.0;
        const igst = 0;
        const lineTotal = taxable + taxVal;

        subtotal += taxable;
        totalTax += taxVal;
        totalCgst += cgst;
        totalSgst += sgst;
        totalIgst += igst;

        processedItems.push({
          productId: product.id,
          quantity: item.quantity,
          unitPrice,
          discount: item.discount || 0.0,
          hsnCode: product.hsnCode || '2201',
          gstRate: rate,
          taxableAmount: taxable,
          cgst,
          sgst,
          igst,
          totalAmount: lineTotal,
        });
      }

      // If 20L water jars purchased, increment distributor filled stock
      if (totalWaterJars > 0) {
        let companyItem = await tx.jarInventoryItem.findFirst({
          where: { distributorId: distributor.id, ownershipType: 'COMPANY' },
        });
        if (companyItem) {
          await tx.jarInventoryItem.update({
            where: { id: companyItem.id },
            data: {
              filledYardQuantity: { increment: totalWaterJars },
            },
          });
        }
      }

      const totalAmount = subtotal + totalTax;
      const amountPaid = dto.amountPaid ?? (dto.paymentStatus === 'PAID' ? totalAmount : 0.0);
      const outstandingAmount = Math.max(0, totalAmount - amountPaid);
      const paymentStatus =
        amountPaid >= totalAmount ? 'PAID' : amountPaid > 0 ? 'PARTIAL' : 'CREDIT';

      const sale = await tx.distributorSale.create({
        data: {
          invoiceNumber,
          saleDate: new Date(),
          distributorId: distributor.id,
          warehouseId: warehouse?.id || null,
          deliveryRequired: dto.deliveryRequired,
          subtotal,
          discount: 0.0,
          cgst: totalCgst,
          sgst: totalSgst,
          igst: totalIgst,
          taxAmount: totalTax,
          totalAmount,
          paymentStatus,
          paymentMethod: dto.paymentMethod || 'BANK_TRANSFER',
          amountPaid,
          outstandingAmount,
          payments:
            amountPaid > 0
              ? [
                  {
                    amount: amountPaid,
                    date: new Date().toISOString(),
                    method: dto.paymentMethod || 'BANK_TRANSFER',
                  },
                ]
              : [],
          notes: dto.notes,
          createdById: actingUserId || null,
          items: {
            create: processedItems,
          },
        },
        include: { items: { include: { product: true } } },
      });

      return sale;
    });
  }

  async getDistributorSales(distributorId?: string) {
    const where: any = {};
    if (distributorId) {
      const dist = await this.prisma.distributor.findFirst({
        where: { OR: [{ id: distributorId }, { userId: distributorId }] },
      });
      if (dist) where.distributorId = dist.id;
    }

    return this.prisma.distributorSale.findMany({
      where,
      include: {
        distributor: {
          select: {
            id: true,
            agencyName: true,
            user: { select: { firstName: true, lastName: true, phone: true } },
          },
        },
        items: { include: { product: true } },
      },
      orderBy: { saleDate: 'desc' },
    });
  }

  // ============================================================================
  // 7. EMPTY JAR OWNERSHIP & PAYMENT-BASED SETTLEMENT TRANSFER
  // ============================================================================
  /**
   * Reference acquisition price: ₹250 per empty 20L jar.
   * Physical jars held != Ownership.
   * Ownership transfers ONLY when distributor pays for the jars!
   * Partial payment transfers whole integer jars (e.g. ₹5,000 / 250 = 20 jars).
   * Remainder stays as unapplied customer credit. Never fractional.
   */
  async settleJarOwnership(dto: SettleJarOwnershipDto, actingUserId?: string) {
    if (dto.paymentAmount <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }

    const ratePerJar = dto.ratePerJar ?? 250.0;
    const wholeJarsToTransfer = Math.floor(dto.paymentAmount / ratePerJar);
    const unappliedCredit = dto.paymentAmount % ratePerJar;

    if (wholeJarsToTransfer <= 0) {
      throw new BadRequestException(
        `Payment amount (₹${dto.paymentAmount}) is insufficient to transfer even 1 jar at ₹${ratePerJar}. Minimum required is ₹${ratePerJar}.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Lock distributor row for concurrency safety
      const distLookup = await tx.distributor.findFirst({
        where: {
          OR: [{ id: dto.distributorId }, { userId: dto.distributorId }],
        },
        select: { id: true },
      });
      if (!distLookup) throw new NotFoundException('Distributor not found');

      const rows = await tx.$queryRawUnsafe<any[]>(
        `SELECT "id", "companyOwnedJars", "distributorOwnedJars", "jarDepositRate"
         FROM "Distributor"
         WHERE "id" = $1
         FOR UPDATE`,
        distLookup.id,
      );
      if (!rows || rows.length === 0) throw new NotFoundException('Distributor not found');

      const dist = rows[0];
      const companyJarsBefore = Number(dist.companyOwnedJars || 0);
      const distributorJarsBefore = Number(dist.distributorOwnedJars || 0);
      const physicalJarsTotal = companyJarsBefore + distributorJarsBefore;

      if (companyJarsBefore < wholeJarsToTransfer) {
        throw new BadRequestException(
          `Cannot transfer ${wholeJarsToTransfer} jars. Distributor only has ${companyJarsBefore} Edrops-owned jars eligible for ownership transfer.`,
        );
      }

      // Check idempotency if payment reference is provided
      if (dto.paymentReference) {
        const existing = await tx.distributorOwnershipLedger.findFirst({
          where: {
            distributorId: dist.id,
            paymentReference: dto.paymentReference.trim(),
          },
        });
        if (existing) {
          return {
            success: true,
            message: 'Ownership transfer already recorded for this payment reference (idempotent)',
            ledgerEntry: existing,
            companyJarsBefore: existing.companyJarsBefore,
            companyJarsAfter: existing.companyJarsAfter,
            distributorJarsBefore: existing.distributorJarsBefore,
            distributorJarsAfter: existing.distributorJarsAfter,
            jarsTransferred: existing.jarsTransferred,
          };
        }
      }

      const settlementCost = wholeJarsToTransfer * ratePerJar;
      const companyJarsAfter = companyJarsBefore - wholeJarsToTransfer;
      const distributorJarsAfter = distributorJarsBefore + wholeJarsToTransfer;

      // Invariant check: Physical total NEVER changes during ownership transfer
      if (companyJarsAfter + distributorJarsAfter !== physicalJarsTotal) {
        throw new BadRequestException('Physical jar total invariant violation');
      }

      // 2. Update Distributor ownership counts
      await tx.distributor.update({
        where: { id: dist.id },
        data: {
          companyOwnedJars: companyJarsAfter,
          distributorOwnedJars: distributorJarsAfter,
        },
      });

      // 3. Update JarInventoryItem breakdown
      const companyItem = await tx.jarInventoryItem.findFirst({
        where: { distributorId: dist.id, ownershipType: 'COMPANY' },
      });

      if (companyItem) {
        const deductYard = Math.min(companyItem.filledYardQuantity, wholeJarsToTransfer);
        const remainingDeduct = wholeJarsToTransfer - deductYard;
        const deductEmpty = Math.min(companyItem.emptyYardQuantity, remainingDeduct);

        await tx.jarInventoryItem.update({
          where: { id: companyItem.id },
          data: {
            ownedQuantity: { decrement: wholeJarsToTransfer },
            filledYardQuantity: { decrement: deductYard },
            emptyYardQuantity: { decrement: deductEmpty },
          },
        });

        // Find or create distributor owned item
        let distItem = await tx.jarInventoryItem.findFirst({
          where: { distributorId: dist.id, ownershipType: 'DISTRIBUTOR' },
        });

        if (!distItem) {
          distItem = await tx.jarInventoryItem.create({
            data: {
              distributorId: dist.id,
              name: 'Distributor 20L Water Jar',
              ownershipType: 'DISTRIBUTOR',
              ownedQuantity: wholeJarsToTransfer,
              filledYardQuantity: deductYard,
              emptyYardQuantity: deductEmpty,
              reservedQuantity: 0,
              customerQuantity: 0,
              washingQuantity: 0,
              fillingQuantity: 0,
              quarantineQuantity: 0,
              damagedQuantity: 0,
              lostQuantity: 0,
              isActive: true,
            },
          });
        } else {
          await tx.jarInventoryItem.update({
            where: { id: distItem.id },
            data: {
              ownedQuantity: { increment: wholeJarsToTransfer },
              filledYardQuantity: { increment: deductYard },
              emptyYardQuantity: { increment: deductEmpty },
            },
          });
        }
      }

      // 4. Record Immutable Ownership Ledger Entry
      const transactionNumber = `OWN-TRF-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

      const ledgerEntry = await tx.distributorOwnershipLedger.create({
        data: {
          transactionNumber,
          distributorId: dist.id,
          type: 'PAYMENT_TRANSFER',
          companyJarsBefore,
          distributorJarsBefore,
          companyJarsAfter,
          distributorJarsAfter,
          jarsTransferred: wholeJarsToTransfer,
          ratePerJar,
          settlementAmount: settlementCost,
          paymentReference: dto.paymentReference || null,
          paymentMethod: dto.paymentMethod || 'BANK_TRANSFER',
          notes:
            dto.notes ||
            `Transferred ${wholeJarsToTransfer} jars on payment of ₹${dto.paymentAmount} @ ₹${ratePerJar}/jar.${unappliedCredit > 0 ? ` (Unapplied credit: ₹${unappliedCredit})` : ''}`,
          createdById: actingUserId || null,
        },
      });

      return {
        success: true,
        transactionNumber,
        companyJarsBefore,
        companyJarsAfter,
        distributorJarsBefore,
        distributorJarsAfter,
        physicalJarsTotal,
        jarsTransferred: wholeJarsToTransfer,
        settlementCost,
        unappliedCredit,
        outstandingEdropsJars: companyJarsAfter,
        outstandingOwnershipBalance: companyJarsAfter * ratePerJar,
        ledgerEntry,
      };
    });
  }

  async getDistributorOwnershipStatus(distributorId: string) {
    const dist = await this.prisma.distributor.findFirst({
      where: { OR: [{ id: distributorId }, { userId: distributorId }] },
      include: {
        user: { select: { firstName: true, lastName: true, phone: true } },
      },
    });
    if (!dist) throw new NotFoundException('Distributor not found');

    const ratePerJar = 250.0;
    const companyOwned = dist.companyOwnedJars || 0;
    const distributorOwned = dist.distributorOwnedJars || 0;
    const totalPhysicalInPossession = companyOwned + distributorOwned;
    const pendingPaymentAmount = companyOwned * ratePerJar;

    const ledger = await this.prisma.distributorOwnershipLedger.findMany({
      where: { distributorId: dist.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return {
      distributor: {
        id: dist.id,
        name: dist.agencyName || `${dist.user.firstName} ${dist.user.lastName}`,
        phone: dist.user.phone,
      },
      ownership: {
        totalPhysicalInPossession,
        distributorOwned,
        edropsOwned: companyOwned,
        ratePerJar,
        pendingPaymentAmount,
      },
      ledger,
    };
  }

  // ============================================================================
  // 8. ACCESSORY INVENTORY & MULTI-CHANNEL SALES
  // ============================================================================
  async getAccessoryInventory(distributorId?: string) {
    await this.ensureEcosystemDefaults();

    // Central accessories in Edrops Godown
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { name: 'Edrops Central Godown' },
    });

    const centralAccessories = await this.prisma.product.findMany({
      where: { productType: 'ACCESSORY' },
      include: {
        stock: {
          where: warehouse ? { warehouseId: warehouse.id } : undefined,
        },
      },
    });

    let distributorStock: any[] = [];
    if (distributorId) {
      const dist = await this.prisma.distributor.findFirst({
        where: { OR: [{ id: distributorId }, { userId: distributorId }] },
      });
      if (dist) {
        distributorStock = await this.prisma.distributorAccessoryStock.findMany({
          where: { distributorId: dist.id },
          include: { product: true },
        });
      }
    }

    return {
      centralAccessories: centralAccessories.map((a) => ({
        id: a.id,
        name: a.name,
        sku: a.sku,
        price: a.price,
        distributorPrice: a.distributorPrice,
        stock: a.stock.reduce((acc, s) => acc + s.quantity, 0),
      })),
      distributorStock: distributorStock.map((s) => ({
        productId: s.productId,
        name: s.product.name,
        sku: s.product.sku,
        quantity: s.quantity,
      })),
    };
  }

  async createAccessorySale(dto: CreateAccessorySaleDto, actingUserId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: dto.productId },
      });
      if (!product || product.productType !== 'ACCESSORY') {
        throw new BadRequestException('Selected product is not a valid accessory');
      }

      const invoiceNumber = `INV-ACC-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

      // Decrement inventory according to channel:
      if (dto.channel === 'EDROPS_TO_DISTRIBUTOR') {
        if (!dto.distributorId) throw new BadRequestException('distributorId is required for this channel');
        const dist = await tx.distributor.findFirst({
          where: { OR: [{ id: dto.distributorId }, { userId: dto.distributorId }] },
        });
        if (!dist) throw new NotFoundException('Distributor not found');

        // Central Godown stock check & decrement
        const warehouse = await tx.warehouse.findFirst({
          where: { name: 'Edrops Central Godown' },
        });
        if (warehouse) {
          const wStock = await tx.warehouseStock.findUnique({
            where: {
              warehouseId_productId: { warehouseId: warehouse.id, productId: product.id },
            },
          });
          if (!wStock || wStock.quantity < dto.quantity) {
            throw new BadRequestException(`Insufficient central warehouse stock for ${product.name}`);
          }
          await tx.warehouseStock.update({
            where: {
              warehouseId_productId: { warehouseId: warehouse.id, productId: product.id },
            },
            data: { quantity: { decrement: dto.quantity } },
          });
        }

        // Increment distributor accessory holding
        await tx.distributorAccessoryStock.upsert({
          where: {
            distributorId_productId: { distributorId: dist.id, productId: product.id },
          },
          create: {
            distributorId: dist.id,
            productId: product.id,
            quantity: dto.quantity,
          },
          update: {
            quantity: { increment: dto.quantity },
          },
        });
      } else if (dto.channel === 'DISTRIBUTOR_TO_CUSTOMER') {
        if (!dto.distributorId) throw new BadRequestException('distributorId is required for this channel');
        const dist = await tx.distributor.findFirst({
          where: { OR: [{ id: dto.distributorId }, { userId: dto.distributorId }] },
        });
        if (!dist) throw new NotFoundException('Distributor not found');

        // Decrement distributor accessory stock
        const distStock = await tx.distributorAccessoryStock.findUnique({
          where: {
            distributorId_productId: { distributorId: dist.id, productId: product.id },
          },
        });
        if (!distStock || distStock.quantity < dto.quantity) {
          const avail = distStock ? distStock.quantity : 0;
          throw new BadRequestException(`Insufficient distributor stock for ${product.name}. Available: ${avail}`);
        }
        await tx.distributorAccessoryStock.update({
          where: {
            distributorId_productId: { distributorId: dist.id, productId: product.id },
          },
          data: { quantity: { decrement: dto.quantity } },
        });
      } else {
        // EDROPS_TO_CUSTOMER: Central stock decrement
        const warehouse = await tx.warehouse.findFirst({
          where: { name: 'Edrops Central Godown' },
        });
        if (warehouse) {
          await tx.warehouseStock.update({
            where: {
              warehouseId_productId: { warehouseId: warehouse.id, productId: product.id },
            },
            data: { quantity: { decrement: dto.quantity } },
          });
        }
      }

      const unitPrice = dto.unitPrice ?? product.price;
      const taxable = dto.quantity * unitPrice - (dto.discount || 0);
      const rate = product.gstRate || 18.0;
      const taxAmount = (taxable * rate) / 100.0;
      const totalAmount = taxable + taxAmount;

      const sale = await tx.accessorySale.create({
        data: {
          invoiceNumber,
          saleDate: new Date(),
          channel: dto.channel,
          distributorId: dto.distributorId || null,
          customerId: dto.customerId || null,
          productId: product.id,
          quantity: dto.quantity,
          unitPrice,
          discount: dto.discount || 0.0,
          gstRate: rate,
          taxableAmount: taxable,
          taxAmount,
          totalAmount,
          paymentStatus: dto.paymentStatus || 'PAID',
          paymentMethod: dto.paymentMethod || 'UPI',
          notes: dto.notes,
          createdById: actingUserId || null,
        },
        include: { product: true },
      });

      return sale;
    });
  }

  // ============================================================================
  // 9. CONFIGURABLE SUBSCRIPTIONS & DISTRIBUTOR CUSTOMER ASSIGNMENT
  // ============================================================================
  async configureSubscriptionPlan(dto: ConfigureSubscriptionPlanDto) {
    const pkg = await this.prisma.package.findUnique({
      where: { id: dto.packageId },
    });
    if (!pkg) throw new NotFoundException('Package/Plan not found');

    const config = await this.prisma.subscriptionPlanConfig.upsert({
      where: { packageId: pkg.id },
      create: {
        packageId: pkg.id,
        waterQuotaPerCycle: dto.waterQuotaPerCycle,
        freeAccessories: dto.freeAccessories || [],
        discountedAccessories: dto.discountedAccessories || [],
        promotionalBadge: dto.promotionalBadge || null,
      },
      update: {
        waterQuotaPerCycle: dto.waterQuotaPerCycle,
        freeAccessories: dto.freeAccessories || [],
        discountedAccessories: dto.discountedAccessories || [],
        promotionalBadge: dto.promotionalBadge || null,
      },
    });

    return config;
  }

  async getSubscriptionPlans() {
    return this.prisma.package.findMany({
      where: { isActive: true },
      include: { planConfig: true },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async assignSubscriptionToCustomer(dto: AssignCustomerSubscriptionDto, distributorUserId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({
        where: { id: dto.customerId },
        include: { user: true },
      });
      if (!customer) throw new NotFoundException('Customer not found');

      const pkg = await tx.package.findUnique({
        where: { id: dto.packageId },
        include: { planConfig: true },
      });
      if (!pkg) throw new NotFoundException('Package not found');

      // Create PackagePurchase
      const purchase = await tx.packagePurchase.create({
        data: {
          customerId: customer.id,
          packageId: pkg.id,
          amount: pkg.price,
          paymentStatus: 'PAID',
        },
      });

      // Deduct stock for free accessories included in promotional plan
      if (pkg.planConfig?.freeAccessories && Array.isArray(pkg.planConfig.freeAccessories)) {
        for (const freeItem of pkg.planConfig.freeAccessories as any[]) {
          if (freeItem.productId && freeItem.quantity > 0) {
            // Deduct from distributor stock if assigned by distributor, else warehouse
            if (distributorUserId) {
              const dist = await tx.distributor.findUnique({
                where: { userId: distributorUserId },
              });
              if (dist) {
                await tx.distributorAccessoryStock.upsert({
                  where: {
                    distributorId_productId: {
                      distributorId: dist.id,
                      productId: freeItem.productId,
                    },
                  },
                  create: {
                    distributorId: dist.id,
                    productId: freeItem.productId,
                    quantity: 0,
                  },
                  update: {
                    quantity: { decrement: freeItem.quantity },
                  },
                });
              }
            } else {
              const warehouse = await tx.warehouse.findFirst({
                where: { name: 'Edrops Central Godown' },
              });
              if (warehouse) {
                await tx.warehouseStock.update({
                  where: {
                    warehouseId_productId: {
                      warehouseId: warehouse.id,
                      productId: freeItem.productId,
                    },
                  },
                  data: { quantity: { decrement: freeItem.quantity } },
                });
              }
            }
          }
        }
      }

      return {
        success: true,
        purchase,
        message: `Subscription plan ${pkg.name} assigned to customer successfully`,
      };
    });
  }

  // ============================================================================
  // 10. FINANCIAL RECONCILIATION & REPORTS
  // ============================================================================
  async getFinancialReports() {
    await this.ensureEcosystemDefaults();

    // 1. Vendor Outstandings
    const vendors = await this.prisma.vendor.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        gstin: true,
        currentBalance: true,
      },
    });

    // 2. Manufacturer Outstandings
    const manufacturers = await this.prisma.manufacturingCompany.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        gstin: true,
        currentPayable: true,
      },
    });

    // 3. Distributor Outstandings & Jar Ownership Summary
    const distributors = await this.prisma.distributor.findMany({
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
    });

    const ratePerJar = 250.0;
    const distributorSummary = distributors.map((d) => {
      const companyJars = d.companyOwnedJars || 0;
      const distributorJars = d.distributorOwnedJars || 0;
      return {
        id: d.id,
        name: d.agencyName || `${d.user.firstName} ${d.user.lastName}`,
        distributorOwnedJars: distributorJars,
        edropsOwnedJars: companyJars,
        totalPhysicalJars: companyJars + distributorJars,
        jarOwnershipPendingAmount: companyJars * ratePerJar,
      };
    });

    // 4. GST Sales Summary
    const sales = await this.prisma.distributorSale.findMany({
      take: 100,
      orderBy: { saleDate: 'desc' },
    });
    const totalTaxableSales = sales.reduce((acc, s) => acc + s.subtotal, 0);
    const totalGstCollected = sales.reduce((acc, s) => acc + s.taxAmount, 0);

    // 5. GST Purchase Summary (Input Tax Credit)
    const rawPurchases = await this.prisma.rawMaterialPurchaseInvoice.findMany({
      take: 100,
      orderBy: { invoiceDate: 'desc' },
    });
    const totalTaxablePurchases = rawPurchases.reduce((acc, p) => acc + p.subtotal, 0);
    const totalItc = rawPurchases.reduce((acc, p) => acc + p.taxAmount, 0);

    // 6. Finished Goods Stock Valuation
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { name: 'Edrops Central Godown' },
    });
    const stocks = await this.prisma.warehouseStock.findMany({
      where: warehouse ? { warehouseId: warehouse.id } : undefined,
      include: { product: true },
    });
    const inventoryValuation = stocks.reduce((acc, s) => {
      return acc + s.quantity * (s.product.costPrice || s.product.price);
    }, 0);

    return {
      vendors: {
        totalVendors: vendors.length,
        totalPayable: vendors.reduce((acc, v) => acc + v.currentBalance, 0),
        items: vendors,
      },
      manufacturers: {
        totalManufacturers: manufacturers.length,
        totalPayable: manufacturers.reduce((acc, m) => acc + m.currentPayable, 0),
        items: manufacturers,
      },
      distributors: {
        totalDistributors: distributors.length,
        totalOwnershipPending: distributorSummary.reduce(
          (acc, d) => acc + d.jarOwnershipPendingAmount,
          0,
        ),
        totalEdropsOwnedJars: distributorSummary.reduce((acc, d) => acc + d.edropsOwnedJars, 0),
        totalDistributorOwnedJars: distributorSummary.reduce(
          (acc, d) => acc + d.distributorOwnedJars,
          0,
        ),
        items: distributorSummary,
      },
      gst: {
        salesTaxable: totalTaxableSales,
        salesGst: totalGstCollected,
        purchasesTaxable: totalTaxablePurchases,
        itcAvailable: totalItc,
        netGstPayable: Math.max(0, totalGstCollected - totalItc),
      },
      inventoryValuation,
    };
  }

  // ============================================================================
  // 11. UPSTREAM AQUORA / BIOFIX SYNCHRONIZATION
  // ============================================================================
  async syncUpstreamTenants(aquoraTenants: any[]) {
    let synced = 0;
    for (const t of aquoraTenants) {
      if (!t.id || !t.name) continue;

      const existing = await this.prisma.manufacturingCompany.findFirst({
        where: {
          OR: [{ externalTenantId: t.id }, { name: t.name }],
        },
      });

      if (!existing) {
        await this.prisma.manufacturingCompany.create({
          data: {
            name: t.name,
            externalTenantId: t.id,
            gstin: t.taxNumber || t.gstin || null,
            address: t.address || null,
            city: t.city || null,
            state: t.state || 'Kerala',
            contactPerson: t.contactPerson || null,
            phone: t.phone || null,
            defaultCoPackingRate: 15.0,
          },
        });
        synced++;
      } else if (!existing.externalTenantId) {
        await this.prisma.manufacturingCompany.update({
          where: { id: existing.id },
          data: { externalTenantId: t.id },
        });
        synced++;
      }
    }
    return { synced, totalTenants: aquoraTenants.length };
  }
  // ============================================================================
  // 12. COMMERCIAL SALES ENGINE: BULK PRICING & TIER MANAGEMENT
  // ============================================================================

  async createBulkPricingTier(dto: any) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product) {
      throw new NotFoundException(`Product ${dto.productId} not found`);
    }

    return this.prisma.bulkPricingTier.create({
      data: {
        productId: dto.productId,
        minQuantity: dto.minQuantity,
        maxQuantity: dto.maxQuantity ?? null,
        pickupPrice: dto.pickupPrice,
        deliveryPrice: dto.deliveryPrice,
        description: dto.description ?? null,
      },
    });
  }

  async getBulkPricingTiers(productId?: string) {
    return this.prisma.bulkPricingTier.findMany({
      where: productId ? { productId, isActive: true } : { isActive: true },
      include: {
        product: {
          select: { id: true, name: true, sku: true },
        },
      },
      orderBy: { minQuantity: 'asc' },
    });
  }

  async deleteBulkPricingTier(id: string) {
    return this.prisma.bulkPricingTier.delete({
      where: { id },
    });
  }

  async calculateBulkPricing(productId: string, quantity: number, deliveryRequired: boolean) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        bulkPricingTiers: {
          where: { isActive: true },
          orderBy: { minQuantity: 'desc' },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }

    // Match tier: minQuantity <= quantity and (maxQuantity == null or maxQuantity >= quantity)
    const tier = product.bulkPricingTiers.find(
      (t) => t.minQuantity <= quantity && (t.maxQuantity === null || t.maxQuantity >= quantity)
    );

    let unitPrice: number;
    let appliedTierDescription: string | null = null;

    if (tier) {
      unitPrice = deliveryRequired ? tier.deliveryPrice : tier.pickupPrice;
      appliedTierDescription = tier.description || `Tier ${tier.minQuantity}+ units`;
    } else {
      unitPrice = deliveryRequired
        ? (product.distributorPriceDelivery ?? 35.0)
        : (product.distributorPricePickup ?? 28.0);
    }

    const taxable = unitPrice * quantity;
    const gstRate = product.gstRate || 18.0;
    const taxAmount = (taxable * gstRate) / 100.0;
    const total = taxable + taxAmount;

    return {
      productId: product.id,
      productName: product.name,
      quantity,
      deliveryRequired,
      unitPrice,
      appliedTier: appliedTierDescription,
      taxableAmount: taxable,
      gstRate,
      taxAmount,
      totalAmount: total,
    };
  }

  async processBulkSale(dto: any, actingUserId?: string) {
    const distributor = await this.prisma.distributor.findUnique({
      where: { id: dto.distributorId },
      include: { user: true },
    });

    if (!distributor) {
      throw new NotFoundException(`Distributor ${dto.distributorId} not found`);
    }

    const invoiceNumber = `INV-BULK-${Date.now().toString().slice(-6)}`;
    const orderStage = dto.orderStage || 'INVOICE';

    return this.prisma.$transaction(async (tx) => {
      let subtotal = 0;
      let totalTax = 0;
      let totalCgst = 0;
      let totalSgst = 0;
      let totalIgst = 0;

      const processedItems: any[] = [];

      for (const item of dto.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          include: {
            bulkPricingTiers: {
              where: { isActive: true },
              orderBy: { minQuantity: 'desc' },
            },
          },
        });

        if (!product) {
          throw new NotFoundException(`Product ${item.productId} not found`);
        }

        let unitPrice: number;
        if (typeof item.unitPriceOverride === 'number' && item.unitPriceOverride > 0) {
          unitPrice = item.unitPriceOverride;
        } else {
          const tier = product.bulkPricingTiers.find(
            (t) => t.minQuantity <= item.quantity && (t.maxQuantity === null || t.maxQuantity >= item.quantity)
          );
          if (tier) {
            unitPrice = dto.deliveryRequired ? tier.deliveryPrice : tier.pickupPrice;
          } else {
            unitPrice = dto.deliveryRequired
              ? (product.distributorPriceDelivery ?? 35.0)
              : (product.distributorPricePickup ?? 28.0);
          }
        }

        const discount = item.discount || 0.0;
        const taxable = Math.max(0, item.quantity * unitPrice - discount);
        const rate = item.gstRate ?? product.gstRate ?? 18.0;
        const taxVal = (taxable * rate) / 100.0;

        const isInterState = distributor.address && distributor.address.toLowerCase().includes('inter-state');
        const cgst = isInterState ? 0 : taxVal / 2.0;
        const sgst = isInterState ? 0 : taxVal / 2.0;
        const igst = isInterState ? taxVal : 0;
        const lineTotal = taxable + taxVal;

        subtotal += taxable;
        totalTax += taxVal;
        totalCgst += cgst;
        totalSgst += sgst;
        totalIgst += igst;

        processedItems.push({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice,
          discount,
          hsnCode: product.hsnCode || '2201',
          gstRate: rate,
          taxableAmount: taxable,
          cgst,
          sgst,
          igst,
          totalAmount: lineTotal,
        });

        // Deduct from central warehouse and increment distributor inventory only when dispatched/invoiced
        if (orderStage === 'DISPATCHED' || orderStage === 'INVOICE') {
          // Decrement central stock
          let warehouse = await tx.warehouse.findFirst({
            where: { isActive: true },
          });
          if (!warehouse) {
            warehouse = await tx.warehouse.create({
              data: {
                name: 'Central Finished Goods Godown',
                location: 'Kochi Main Facility',
              },
            });
          }

          const existingStock = await tx.warehouseStock.findFirst({
            where: { warehouseId: warehouse.id, productId: product.id },
          });

          if (existingStock && existingStock.quantity >= item.quantity) {
            await tx.warehouseStock.update({
              where: { id: existingStock.id },
              data: { quantity: { decrement: item.quantity } },
            });
          }

          // Increment distributor stock
          if (product.isJar || product.name.includes('20L')) {
            await tx.distributor.update({
              where: { id: distributor.id },
              data: {
                companyOwnedJars: { increment: item.quantity },
              },
            });
          } else if (product.productType === 'ACCESSORY') {
            await tx.distributorAccessoryStock.upsert({
              where: {
                distributorId_productId: {
                  distributorId: distributor.id,
                  productId: product.id,
                },
              },
              create: {
                distributorId: distributor.id,
                productId: product.id,
                quantity: item.quantity,
              },
              update: {
                quantity: { increment: item.quantity },
              },
            });
          }
        }
      }

      const totalAmount = subtotal + totalTax;
      const amountPaid = dto.amountPaid || (dto.paymentStatus === 'PAID' ? totalAmount : 0.0);
      const outstandingAmount = Math.max(0, totalAmount - amountPaid);
      const paymentStatus = outstandingAmount === 0 ? 'PAID' : amountPaid > 0 ? 'PARTIAL' : 'CREDIT';

      const sale = await tx.distributorSale.create({
        data: {
          invoiceNumber,
          distributorId: distributor.id,
          deliveryRequired: dto.deliveryRequired,
          orderStage,
          externalSource: 'EDROPS',
          subtotal,
          discount: 0.0,
          cgst: totalCgst,
          sgst: totalSgst,
          igst: totalIgst,
          taxAmount: totalTax,
          totalAmount,
          paymentStatus,
          paymentMethod: dto.paymentMethod || 'BANK_TRANSFER',
          amountPaid,
          outstandingAmount,
          notes: dto.notes || null,
          createdById: actingUserId || null,
          items: {
            create: processedItems,
          },
        },
        include: {
          items: {
            include: { product: true },
          },
          distributor: true,
        },
      });

      return sale;
    });
  }

  // ============================================================================
  // 13. AQUZIO FINISHED GOODS RECEIPT (IDEMPOTENT WAREHOUSE ADMISSION)
  // ============================================================================

  async receiveAquzioFinishedGoods(dto: any) {
    // 1. Idempotency Check
    const existing = await this.prisma.aquzioSyncLog.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
    });

    if (existing) {
      return {
        alreadyProcessed: true,
        message: 'Event already processed. Duplicate stock increment prevented.',
        syncLog: existing,
      };
    }

    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });

    if (!product) {
      throw new NotFoundException(`Product ${dto.productId} not found in commercial catalogue`);
    }

    return this.prisma.$transaction(async (tx) => {
      let warehouse = await tx.warehouse.findFirst({
        where: { isActive: true },
      });

      if (!warehouse) {
        warehouse = await tx.warehouse.create({
          data: {
            name: 'Central Finished Goods Godown',
            location: 'Kochi Main Facility',
          },
        });
      }

      // 2. Increment central warehouse stock strictly for accepted QC units
      const existingStock = await tx.warehouseStock.findFirst({
        where: { warehouseId: warehouse.id, productId: product.id },
      });

      if (existingStock) {
        await tx.warehouseStock.update({
          where: { id: existingStock.id },
          data: { quantity: { increment: dto.acceptedQuantity } },
        });
      } else {
        await tx.warehouseStock.create({
          data: {
            warehouseId: warehouse.id,
            productId: product.id,
            quantity: dto.acceptedQuantity,
          },
        });
      }

      // 3. Log stock movement
      await tx.stockMovement.create({
        data: {
          warehouseId: warehouse.id,
          productId: product.id,
          type: 'IN',
          quantity: dto.acceptedQuantity,
          referenceId: `AQUZIO-BATCH-${dto.externalBatchId}`,
          reason: `Aquzio production receipt: ${dto.acceptedQuantity} accepted, ${dto.rejectedQuantity} rejected (QC: ${dto.qcApprovalStatus})`,
        },
      });

      // 4. Create immutable sync log
      const syncLog = await tx.aquzioSyncLog.create({
        data: {
          syncType: 'FINISHED_GOODS',
          status: 'SUCCESS',
          externalBatchId: dto.externalBatchId,
          acceptedQuantity: dto.acceptedQuantity,
          rejectedQuantity: dto.rejectedQuantity,
          idempotencyKey: dto.idempotencyKey,
          details: {
            productId: dto.productId,
            qcApprovalStatus: dto.qcApprovalStatus,
            notes: dto.notes || null,
          },
        },
      });

      return {
        alreadyProcessed: false,
        message: 'Successfully admitted Aquzio finished goods to commercial warehouse.',
        acceptedQuantity: dto.acceptedQuantity,
        rejectedQuantity: dto.rejectedQuantity,
        syncLog,
      };
    });
  }

  // ============================================================================
  // 14. DISTRIBUTOR PURCHASE PORTAL (DUAL-SOURCE BILLS SEPARATION)
  // ============================================================================

  async getDistributorPurchaseBills(distributorId: string, sourceFilter?: string) {
    const distributor = await this.prisma.distributor.findUnique({
      where: { id: distributorId },
      include: { user: true },
    });

    if (!distributor) {
      throw new NotFoundException(`Distributor ${distributorId} not found`);
    }

    // 1. Fetch Edrops Commercial Invoices
    const edropsSales = await this.prisma.distributorSale.findMany({
      where: {
        distributorId,
        externalSource: 'EDROPS',
      },
      include: {
        items: {
          include: { product: true },
        },
      },
      orderBy: { saleDate: 'desc' },
    });

    const edropsBills = edropsSales.map((s) => ({
      id: s.id,
      invoiceNumber: s.invoiceNumber,
      date: s.saleDate,
      documentSource: 'EDROPS',
      sourceBadge: 'Edrops Commercial Invoice',
      orderStage: s.orderStage,
      subtotal: s.subtotal,
      taxAmount: s.taxAmount,
      totalAmount: s.totalAmount,
      amountPaid: s.amountPaid,
      outstandingAmount: s.outstandingAmount,
      paymentStatus: s.paymentStatus,
      paymentMethod: s.paymentMethod,
      items: s.items.map((i) => ({
        productName: i.product.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        total: i.totalAmount,
      })),
    }));

    // 2. Fetch Aquzio-Sourced Purchase Bills
    const aquzioSales = await this.prisma.distributorSale.findMany({
      where: {
        distributorId,
        externalSource: 'AQUZIO',
      },
      include: {
        items: {
          include: { product: true },
        },
      },
      orderBy: { saleDate: 'desc' },
    });

    const aquzioBills = aquzioSales.map((s) => ({
      id: s.id,
      invoiceNumber: s.externalBillId || s.invoiceNumber,
      date: s.saleDate,
      documentSource: 'AQUZIO',
      sourceBadge: 'Aquzio Manufacturing Bill',
      orderStage: s.orderStage,
      subtotal: s.subtotal,
      taxAmount: s.taxAmount,
      totalAmount: s.totalAmount,
      amountPaid: s.amountPaid,
      outstandingAmount: s.outstandingAmount,
      paymentStatus: s.paymentStatus,
      paymentMethod: s.paymentMethod,
      items: s.items.map((i) => ({
        productName: i.product.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        total: i.totalAmount,
      })),
    }));

    // Calculate aggregated metrics
    const totalEdropsAmount = edropsBills.reduce((acc, b) => acc + b.totalAmount, 0);
    const totalAquzioAmount = aquzioBills.reduce((acc, b) => acc + b.totalAmount, 0);
    const totalPurchases = totalEdropsAmount + totalAquzioAmount;
    const totalPaid =
      edropsBills.reduce((acc, b) => acc + b.amountPaid, 0) +
      aquzioBills.reduce((acc, b) => acc + b.amountPaid, 0);
    const totalOutstanding =
      edropsBills.reduce((acc, b) => acc + b.outstandingAmount, 0) +
      aquzioBills.reduce((acc, b) => acc + b.outstandingAmount, 0);

    return {
      distributor: {
        id: distributor.id,
        businessName: distributor.agencyName || `${distributor.user?.firstName || ''} ${distributor.user?.lastName || ''}`.trim() || 'Distributor',
        gstin: distributor.referralCode,
      },
      summary: {
        totalPurchases,
        edropsTotal: totalEdropsAmount,
        aquzioTotal: totalAquzioAmount,
        totalPaid,
        totalOutstanding,
      },
      edropsBills: sourceFilter === 'AQUZIO' ? [] : edropsBills,
      aquzioBills: sourceFilter === 'EDROPS' ? [] : aquzioBills,
    };
  }

  // ============================================================================
  // 15. ADVANCED CUSTOMIZED SUBSCRIPTIONS WITH ACCESSORIES
  // ============================================================================

  async createCustomizedSubscription(dto: any, actingUserId?: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
      include: { user: true },
    });

    if (!customer) {
      throw new NotFoundException(`Customer ${dto.customerId} not found`);
    }

    const pkg = await this.prisma.package.findUnique({
      where: { id: dto.packageId },
      include: {
        planConfig: true,
      },
    });

    if (!pkg) {
      throw new NotFoundException(`Package ${dto.packageId} not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Process free promotional accessories (deduct inventory, record promotional expense)
      const freeAccessories = dto.selectedFreeAccessories || [];
      for (const freeItem of freeAccessories) {
        if (dto.distributorId) {
          const accStock = await tx.distributorAccessoryStock.findUnique({
            where: {
              distributorId_productId: {
                distributorId: dto.distributorId,
                productId: freeItem.productId,
              },
            },
          });
          if (accStock && accStock.quantity >= freeItem.quantity) {
            await tx.distributorAccessoryStock.update({
              where: { id: accStock.id },
              data: { quantity: { decrement: freeItem.quantity } },
            });
          }
        }
      }

      // 2. Process paid discounted accessories
      let accessoryAddonTotal = 0;
      const discountedAccessories = dto.selectedDiscountedAccessories || [];
      for (const paidItem of discountedAccessories) {
        accessoryAddonTotal += paidItem.quantity * paidItem.unitPrice;
        if (dto.distributorId) {
          const accStock = await tx.distributorAccessoryStock.findUnique({
            where: {
              distributorId_productId: {
                distributorId: dto.distributorId,
                productId: paidItem.productId,
              },
            },
          });
          if (accStock && accStock.quantity >= paidItem.quantity) {
            await tx.distributorAccessoryStock.update({
              where: { id: accStock.id },
              data: { quantity: { decrement: paidItem.quantity } },
            });
          }
        }
      }

      const totalSubscriptionPrice = pkg.price + accessoryAddonTotal;

      // 3. Create PackagePurchase record (Active subscription)
      const purchase = await tx.packagePurchase.create({
        data: {
          customerId: customer.id,
          packageId: pkg.id,
          amount: totalSubscriptionPrice,
          paymentStatus: 'PAID',
        },
      });

      return {
        purchaseId: purchase.id,
        customerId: customer.id,
        packageName: pkg.name,
        bottleCount: pkg.jarCount,
        validityDays: 30,
        basePrice: pkg.price,
        accessoryAddonsCost: accessoryAddonTotal,
        totalPrice: totalSubscriptionPrice,
        status: 'ACTIVE',
        freeAccessoriesIncluded: freeAccessories,
        discountedAccessoriesAdded: discountedAccessories,
      };
    });
  }

  // ============================================================================
  // 16. REVENUE-FIRST COMMERCIAL DASHBOARD ANALYTICS
  // ============================================================================

  async getCommercialDashboardMetrics() {
    const [
      distributorSales,
      accessorySales,
      packagePurchases,
      distributors,
      warehouses,
      syncLogs,
    ] = await Promise.all([
      this.prisma.distributorSale.findMany(),
      this.prisma.accessorySale.findMany(),
      this.prisma.packagePurchase.findMany({ where: { paymentStatus: 'PAID' } }),
      this.prisma.distributor.findMany(),
      this.prisma.warehouseStock.findMany({ include: { product: true } }),
      this.prisma.aquzioSyncLog.findMany({ take: 5, orderBy: { syncedAt: 'desc' } }),
    ]);

    const totalBulkSales = distributorSales.reduce((acc, s) => acc + s.totalAmount, 0);
    const totalAccessorySales = accessorySales.reduce((acc, s) => acc + s.totalAmount, 0);
    const totalSubscriptionRevenue = packagePurchases.reduce((acc, p) => acc + p.amount, 0);
    const totalCommercialRevenue = totalBulkSales + totalAccessorySales + totalSubscriptionRevenue;

    const totalOutstandingPayments = distributorSales.reduce(
      (acc, s) => acc + s.outstandingAmount,
      0
    );

    const totalCompanyJars = distributors.reduce((acc, d) => acc + d.companyOwnedJars, 0);
    const totalDistributorJars = distributors.reduce((acc, d) => acc + d.distributorOwnedJars, 0);
    const jarOwnershipOutstanding = totalCompanyJars * 250.0;

    const waterStocks = warehouses.filter((w) => w.product.isJar || w.product.name.includes('20L'));
    const totalAvailableWaterJars = waterStocks.reduce((acc, w) => acc + w.quantity, 0);

    return {
      kpis: {
        totalCommercialRevenue,
        totalBulkSales,
        totalSubscriptionRevenue,
        totalAccessorySales,
        totalOutstandingPayments,
        activeSubscriptionsCount: packagePurchases.length,
        distributorCount: distributors.length,
        totalCompanyOwnedJars: totalCompanyJars,
        totalDistributorOwnedJars: totalDistributorJars,
        jarOwnershipOutstanding,
        availableFinishedGoodsJars: totalAvailableWaterJars,
      },
      revenueByChannel: [
        { channel: 'Bulk Distributor Sales', revenue: totalBulkSales },
        { channel: 'Customer Subscriptions', revenue: totalSubscriptionRevenue },
        { channel: 'Accessories Commerce', revenue: totalAccessorySales },
      ],
      recentAquzioSync: syncLogs,
    };
  }

}
