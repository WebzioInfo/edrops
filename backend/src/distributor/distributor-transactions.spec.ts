import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DistributorInventoryService } from './distributor-inventory.service';
import { InventoryTransactionsQuery } from './dto/inventory-transactions-query.dto';

describe('Distributor ownership history', () => {
  const log = {
    count: jest.fn(),
    findMany: jest.fn(),
    aggregate: jest.fn(),
    findFirst: jest.fn(),
  };
  const prisma = {
    distributor: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new DistributorInventoryService(prisma as any, {} as any);
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.distributor.findUnique.mockResolvedValue({
      companyOwnedJars: 100,
      distributorOwnedJars: 0,
    });
    prisma.$transaction.mockImplementation((callback) =>
      callback({ inventoryLog: log }),
    );
    log.count.mockResolvedValue(45);
    log.findMany.mockResolvedValue([
      {
        id: 'test-entry',
        action: 'ADJUSTMENT',
        quantity: -2,
        balanceAfter: 83,
      },
    ]);
    log.aggregate
      .mockResolvedValueOnce({ _sum: { quantity: 12 } })
      .mockResolvedValueOnce({ _sum: { quantity: -2 } });
    log.findFirst.mockResolvedValue({
      createdAt: new Date('2026-09-28T00:00:00Z'),
    });
  });
  it.each(['COMPANY_OWNED', 'DISTRIBUTOR_OWNED'] as const)(
    'scopes %s, paginates on the server and preserves stored balances',
    async (ownership) => {
      const result = await service.getTransactions('current-user', {
        ownership,
        page: 2,
        limit: 20,
        type: 'ADJUSTMENT',
        search: 'reference',
        from: '2026-09-01',
        to: '2026-09-28',
      });
      expect(log.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 20,
          orderBy: { sequence: 'desc' },
          where: expect.objectContaining({
            distributor: { userId: 'current-user' },
            ownership,
            action: 'ADJUSTMENT',
            createdAt: {
              gte: new Date('2026-09-01T00:00:00Z'),
              lt: new Date('2026-09-29T00:00:00Z'),
            },
            OR: expect.arrayContaining([
              { referenceId: { contains: 'reference', mode: 'insensitive' } },
            ]),
          }),
        }),
      );
      expect(result.items[0].balanceAfter).toBe(83);
      expect(result.pages).toBe(3);
      expect(result.incoming).toBe(12);
      expect(result.outgoing).toBe(2);
      expect(log.aggregate.mock.calls[0][0].where.AND[1].action).toEqual({
        not: 'OPENING_BALANCE',
      });
    },
  );
  it('rejects inverted date filters before querying the log', async () => {
    await expect(
      service.getTransactions('owner', {
        ownership: 'COMPANY_OWNED',
        page: 1,
        limit: 20,
        from: '2026-10-01',
        to: '2026-09-01',
      }),
    ).rejects.toThrow('Start date');
    expect(log.findMany).not.toHaveBeenCalled();
  });
  it('handles zero history without manufacturing entries', async () => {
    log.count.mockResolvedValue(0);
    log.findMany.mockResolvedValue([]);
    log.findFirst.mockResolvedValue(null);
    log.aggregate.mockReset().mockResolvedValue({ _sum: { quantity: null } });
    const result = await service.getTransactions('owner', {
      ownership: 'COMPANY_OWNED',
      page: 1,
      limit: 20,
    });
    expect(result).toMatchObject({
      items: [],
      total: 0,
      pages: 0,
      incoming: 0,
      outgoing: 0,
      trackingSince: null,
    });
  });
  it.each([
    { ownership: 'OTHER' },
    { ownership: 'COMPANY_OWNED', page: '0' },
    { ownership: 'COMPANY_OWNED', limit: '1000' },
    { ownership: 'COMPANY_OWNED', type: 'DISPATCH' },
    { ownership: 'COMPANY_OWNED', from: '2026-02-30' },
  ])('rejects invalid query %j', async (raw) => {
    expect(
      (await validate(plainToInstance(InventoryTransactionsQuery, raw))).length,
    ).toBeGreaterThan(0);
  });
});
