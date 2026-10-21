import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { RawMaterialService } from './raw-material.service';

describe('Distributor Manufacturing & Jar Settlement Invariants', () => {
  let service: RawMaterialService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      rawMaterialItem: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      distributor: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      distributorRawMaterialStock: {
        findMany: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
      rawMaterialMovement: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      distributorProductionBatch: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      jarInventoryItem: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      distributorJarSettlement: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(async (callback) => callback(mockPrisma)),
      $queryRawUnsafe: jest.fn(),
    };

    service = new RawMaterialService(mockPrisma);
  });

  describe('PHASE 2 & 3: Manufacturing Authorization & Raw Material Issuance', () => {
    it('TEST 1: Issuing raw materials to a non-manufacturing distributor is REJECTED', async () => {
      mockPrisma.distributor.findFirst.mockResolvedValue({
        id: 'dist-1',
        agencyName: 'Distribution Only Agency',
        canManufacture: false,
        user: { firstName: 'John', lastName: 'Doe' },
      });

      await expect(
        service.issueMaterials(
          {
            distributorId: 'dist-1',
            items: [{ materialId: 'mat-cap', quantity: 500 }],
          },
          'staff-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('TEST 2: Issuing raw materials to an authorized distributor decreases central stock and increases distributor holding', async () => {
      mockPrisma.distributor.findFirst.mockResolvedValue({
        id: 'dist-1',
        agencyName: 'Authorized Plant Agency',
        canManufacture: true,
        user: { firstName: 'John', lastName: 'Doe' },
      });

      mockPrisma.$queryRawUnsafe.mockResolvedValue([
        {
          id: 'mat-cap',
          name: '20L Smart Cap',
          code: 'MAT-CAP-20L',
          centralStock: 10000,
        },
      ]);

      mockPrisma.rawMaterialItem.update.mockResolvedValue({
        id: 'mat-cap',
        centralStock: 9500,
      });

      mockPrisma.distributorRawMaterialStock.upsert.mockResolvedValue({
        id: 'stock-1',
        distributorId: 'dist-1',
        materialId: 'mat-cap',
        quantity: 500,
      });

      mockPrisma.rawMaterialMovement.create.mockResolvedValue({
        id: 'mov-1',
        quantity: 500,
      });

      const result = await service.issueMaterials(
        {
          distributorId: 'dist-1',
          items: [{ materialId: 'mat-cap', quantity: 500 }],
        },
        'staff-1',
      );

      expect(result.success).toBe(true);
      expect(mockPrisma.rawMaterialItem.update).toHaveBeenCalledWith({
        where: { id: 'mat-cap' },
        data: { centralStock: { decrement: 500 } },
      });
      expect(mockPrisma.distributorRawMaterialStock.upsert).toHaveBeenCalled();
      expect(mockPrisma.rawMaterialMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'ISSUED_TO_DISTRIBUTOR',
            quantity: 500,
          }),
        }),
      );
    });

    it('TEST 3: Issuing materials with insufficient central stock is REJECTED', async () => {
      mockPrisma.distributor.findFirst.mockResolvedValue({
        id: 'dist-1',
        canManufacture: true,
        user: { firstName: 'John', lastName: 'Doe' },
      });

      mockPrisma.$queryRawUnsafe.mockResolvedValue([
        {
          id: 'mat-cap',
          name: '20L Smart Cap',
          code: 'MAT-CAP-20L',
          centralStock: 200, // only 200 available
        },
      ]);

      await expect(
        service.issueMaterials(
          {
            distributorId: 'dist-1',
            items: [{ materialId: 'mat-cap', quantity: 500 }],
          },
          'staff-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('TEST 4: Non-manufacturing distributor attempting to record a production batch gets ForbiddenException', async () => {
      mockPrisma.distributor.findFirst.mockResolvedValue({
        id: 'dist-1',
        canManufacture: false, // NOT authorized
      });

      await expect(
        service.recordProductionBatch(
          'dist-1',
          { outputQuantity: 100 },
          'user-1',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('TEST 5: Authorized distributor records batch, consuming raw materials and logging wastage', async () => {
      mockPrisma.distributor.findFirst.mockResolvedValue({
        id: 'dist-1',
        canManufacture: true,
      });

      mockPrisma.$queryRawUnsafe.mockResolvedValue([
        {
          id: 'stock-cap',
          quantity: 200,
        },
      ]);

      mockPrisma.distributorRawMaterialStock.update.mockResolvedValue({
        id: 'stock-cap',
        quantity: 90,
      });

      mockPrisma.distributorProductionBatch.create.mockResolvedValue({
        id: 'batch-1',
        outputQuantity: 100,
        rejectedQuantity: 5,
        status: 'COMPLETED',
      });

      const res = await service.recordProductionBatch(
        'dist-1',
        {
          outputQuantity: 100,
          rejectedQuantity: 5,
          consumptions: [
            { materialId: 'mat-cap', quantity: 105, wastageQuantity: 5 },
          ],
        },
        'dist-user-1',
      );

      expect(res.success).toBe(true);
      expect(mockPrisma.distributorProductionBatch.create).toHaveBeenCalled();
      expect(mockPrisma.rawMaterialMovement.create).toHaveBeenCalled();
    });
  });

  describe('PHASE 4 & 5: Jar Ownership & Settlement Invariants', () => {
    it('TEST 6: Full Settlement Invariant: 100 physical jars (40 company + 60 distributor) settled for 40 -> 0 company, 100 distributor, physical total remains 100', async () => {
      mockPrisma.distributor.findFirst.mockResolvedValue({ id: 'dist-1' });

      // Before state: 40 company, 60 distributor -> physical total = 100
      mockPrisma.$queryRawUnsafe.mockResolvedValue([
        {
          id: 'dist-1',
          companyOwnedJars: 40,
          distributorOwnedJars: 60,
          jarDepositRate: 150.0,
        },
      ]);

      mockPrisma.distributorJarSettlement.findFirst.mockResolvedValue(null);

      mockPrisma.jarInventoryItem.findFirst
        .mockResolvedValueOnce({
          id: 'item-comp',
          distributorId: 'dist-1',
          ownershipType: 'COMPANY',
          ownedQuantity: 40,
          filledYardQuantity: 40,
          emptyYardQuantity: 0,
        })
        .mockResolvedValueOnce({
          id: 'item-dist',
          distributorId: 'dist-1',
          ownershipType: 'DISTRIBUTOR',
          ownedQuantity: 60,
          filledYardQuantity: 60,
          emptyYardQuantity: 0,
        });

      mockPrisma.distributor.update.mockResolvedValue({
        id: 'dist-1',
        companyOwnedJars: 0,
        distributorOwnedJars: 100,
      });

      mockPrisma.distributorJarSettlement.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'settle-1', ...data }),
      );

      const res = await service.settleJars(
        'dist-1',
        {
          jarsToSettle: 40,
          paymentMethod: 'BANK_TRANSFER',
          paymentReference: 'TXN-FULL-SETTLE',
        },
        'staff-1',
      );

      expect(res.success).toBe(true);
      expect(res.companyJarsBefore).toBe(40);
      expect(res.companyJarsAfter).toBe(0);
      expect(res.distributorJarsBefore).toBe(60);
      expect(res.distributorJarsAfter).toBe(100);
      // PHYSICAL INVARIANT: Physical stock remains exactly 100!
      expect(res.physicalJarsTotal).toBe(100);
      expect(res.companyJarsAfter + res.distributorJarsAfter).toBe(res.physicalJarsTotal);

      // Verify distributor update did NOT add physical stock
      expect(mockPrisma.distributor.update).toHaveBeenCalledWith({
        where: { id: 'dist-1' },
        data: {
          companyOwnedJars: 0,
          distributorOwnedJars: 100,
        },
      });

      // Verify settlement recorded
      expect(mockPrisma.distributorJarSettlement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            jarsSettled: 40,
            unitPrice: 150.0,
            totalAmount: 6000.0,
            physicalJarsTotal: 100,
          }),
        }),
      );
    });

    it('TEST 7: Partial Settlement Invariant: 10 jars settled out of 40 -> 30 company, 70 distributor, physical total remains 100', async () => {
      mockPrisma.distributor.findFirst.mockResolvedValue({ id: 'dist-1' });

      mockPrisma.$queryRawUnsafe.mockResolvedValue([
        {
          id: 'dist-1',
          companyOwnedJars: 40,
          distributorOwnedJars: 60,
          jarDepositRate: 150.0,
        },
      ]);

      mockPrisma.distributorJarSettlement.findFirst.mockResolvedValue(null);

      mockPrisma.jarInventoryItem.findFirst
        .mockResolvedValueOnce({
          id: 'item-comp',
          distributorId: 'dist-1',
          ownershipType: 'COMPANY',
          ownedQuantity: 40,
          filledYardQuantity: 40,
          emptyYardQuantity: 0,
        })
        .mockResolvedValueOnce({
          id: 'item-dist',
          distributorId: 'dist-1',
          ownershipType: 'DISTRIBUTOR',
          ownedQuantity: 60,
          filledYardQuantity: 60,
          emptyYardQuantity: 0,
        });

      mockPrisma.distributorJarSettlement.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'settle-2', ...data }),
      );

      const res = await service.settleJars(
        'dist-1',
        {
          jarsToSettle: 10,
          paymentMethod: 'UPI',
        },
        'staff-1',
      );

      expect(res.success).toBe(true);
      expect(res.companyJarsAfter).toBe(30);
      expect(res.distributorJarsAfter).toBe(70);
      expect(res.physicalJarsTotal).toBe(100);
      expect(res.companyJarsAfter + res.distributorJarsAfter).toBe(100);
    });

    it('TEST 8: Attempting to settle more jars than available in company ownership is REJECTED', async () => {
      mockPrisma.distributor.findFirst.mockResolvedValue({ id: 'dist-1' });

      mockPrisma.$queryRawUnsafe.mockResolvedValue([
        {
          id: 'dist-1',
          companyOwnedJars: 40,
          distributorOwnedJars: 60,
          jarDepositRate: 150.0,
        },
      ]);

      await expect(
        service.settleJars(
          'dist-1',
          { jarsToSettle: 50 }, // Only 40 available!
          'staff-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('TEST 9: Repeated settlement with same payment reference is IDEMPOTENT and does not transfer twice', async () => {
      mockPrisma.distributor.findFirst.mockResolvedValue({ id: 'dist-1' });

      mockPrisma.$queryRawUnsafe.mockResolvedValue([
        {
          id: 'dist-1',
          companyOwnedJars: 40,
          distributorOwnedJars: 60,
          jarDepositRate: 150.0,
        },
      ]);

      // Existing settlement already recorded
      mockPrisma.distributorJarSettlement.findFirst.mockResolvedValue({
        id: 'settle-existing',
        distributorId: 'dist-1',
        paymentReference: 'DUPLICATE-REF',
        jarsSettled: 40,
        companyJarsBefore: 40,
        companyJarsAfter: 0,
        distributorJarsBefore: 60,
        distributorJarsAfter: 100,
        physicalJarsTotal: 100,
      });

      const res = await service.settleJars(
        'dist-1',
        {
          jarsToSettle: 40,
          paymentReference: 'DUPLICATE-REF',
        },
        'staff-1',
      );

      expect(res.success).toBe(true);
      expect(res.message).toContain('idempotent');
      // No new distributor update should occur
      expect(mockPrisma.distributor.update).not.toHaveBeenCalled();
    });
  });
});
