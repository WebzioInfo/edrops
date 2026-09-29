import { NotFoundException } from '@nestjs/common';
import { DistributorInventoryService } from './distributor-inventory.service';
import { DistributorInventoryController } from './distributor-inventory.controller';
import { ROLES_KEY } from '../auth/roles.guard';
import { UserRole } from '@prisma/client';

describe('Distributor inventory', () => {
  const distributor = { findUnique: jest.fn(), update: jest.fn() };
  const storage = { uploadImage: jest.fn(), deleteImage: jest.fn() };
  const service = new DistributorInventoryService(
    { distributor } as any,
    storage as any,
  );
  beforeEach(() => jest.resetAllMocks());
  it('returns recorded ownership totals without inventing status quantities', async () => {
    distributor.findUnique.mockResolvedValue({
      companyOwnedJars: 17,
      distributorOwnedJars: 9,
      jarImageUrl: 'saved-url',
    });
    const result = await service.getInventory('signed-in-user');
    expect(distributor.findUnique.mock.calls[0][0].where).toEqual({
      userId: 'signed-in-user',
    });
    expect(result.total).toBe(26);
    expect(result.companyOwned).toEqual({
      total: 17,
      available: null,
      withCustomers: null,
      damaged: null,
    });
    expect(result.distributorOwned).toEqual({
      total: 9,
      available: null,
      withCustomers: null,
      damaged: null,
      imageUrl: 'saved-url',
    });
  });
  it('returns zero for empty inventory', async () => {
    distributor.findUnique.mockResolvedValue({
      companyOwnedJars: 0,
      distributorOwnedJars: 0,
      jarImageUrl: null,
    });
    const result = await service.getInventory('empty-user');
    expect(result.total).toBe(0);
    expect(result.companyOwned).toEqual({
      total: 0,
      available: 0,
      withCustomers: 0,
      damaged: 0,
    });
    expect(result.distributorOwned.imageUrl).toBeNull();
  });
  it('rejects missing distributor profiles before uploading', async () => {
    distributor.findUnique.mockResolvedValue(null);
    await expect(service.uploadImage('missing', {} as any)).rejects.toThrow(
      NotFoundException,
    );
    expect(storage.uploadImage).not.toHaveBeenCalled();
  });
  it('persists the cloud URL only on the authenticated distributor', async () => {
    distributor.findUnique.mockResolvedValue({ jarImageUrl: 'old-url' });
    storage.uploadImage.mockResolvedValue({
      secure_url: 'new-url',
      public_id: 'asset',
    });
    distributor.update.mockResolvedValue({ jarImageUrl: 'new-url' });
    expect(await service.uploadImage('owner', {} as any)).toEqual({
      jarImageUrl: 'new-url',
    });
    expect(distributor.update).toHaveBeenCalledWith({
      where: { userId: 'owner' },
      data: { jarImageUrl: 'new-url' },
      select: { jarImageUrl: true },
    });
  });
  it('cleans up a new upload if persistence fails', async () => {
    distributor.findUnique.mockResolvedValue({});
    storage.uploadImage.mockResolvedValue({
      secure_url: 'new-url',
      public_id: 'asset',
    });
    distributor.update.mockRejectedValue(new Error('Database unavailable'));
    await expect(service.uploadImage('owner', {} as any)).rejects.toThrow(
      'Database unavailable',
    );
    expect(storage.deleteImage).toHaveBeenCalledWith('asset');
  });
  it('restricts the controller to distributors and ignores supplied ownership IDs', async () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, DistributorInventoryController),
    ).toEqual([UserRole.DISTRIBUTOR]);
    const inventory = { getInventory: jest.fn(), uploadImage: jest.fn() };
    const controller = new DistributorInventoryController(inventory as any);
    const request = {
      user: { id: 'owner' },
      body: { userId: 'other' },
      query: { distributorId: 'other' },
    };
    controller.getInventory(request);
    controller.uploadImage(request, {} as any);
    expect(inventory.getInventory).toHaveBeenCalledWith('owner');
    expect(inventory.uploadImage).toHaveBeenCalledWith('owner', {});
  });
});
