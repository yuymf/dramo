import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock prisma before importing
jest.mock('../../lib/db', () => ({
  prisma: {
    locationAsset: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

// Mock agentos-client
jest.mock('../../lib/agentos-client', () => ({
  runImageGeneration: jest.fn(),
}));

// Mock storage service
jest.mock('../../services/storage.service', () => ({
  StorageService: jest.fn().mockImplementation(() => ({
    uploadImageFromUrl: jest.fn(),
    uploadImageFromBase64: jest.fn(),
  })),
}));

import { prisma } from '../../lib/db';
import { runImageGeneration } from '../../lib/agentos-client';
import { LocationAssetService } from '../../services/location-asset.service';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockRunImageGeneration = runImageGeneration as jest.MockedFunction<typeof runImageGeneration>;

function makeLocationAsset(overrides: Record<string, unknown> = {}) {
  return {
    id: 'loc-1',
    projectId: 'proj-1',
    name: 'Test Location',
    description: 'A forest',
    alias: null,
    images: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

describe('LocationAssetService', () => {
  let service: LocationAssetService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockStorageService: any;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LocationAssetService();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockStorageService = (service as any).storageService;
  });

  describe('listLocationAssets', () => {
    it('should return assets with success:true', async () => {
      const asset = makeLocationAsset({ images: [] });
      (mockPrisma.locationAsset.findMany as jest.MockedFunction<typeof mockPrisma.locationAsset.findMany>)
        .mockResolvedValue([asset as any]);

      const result = await service.listLocationAssets('proj-1', 'user-1');

      expect(result.success).toBe(true);
      expect(Array.isArray(result.dataV2)).toBe(true);
      expect(result.dataV2).toHaveLength(1);
    });

    it('should return empty dataV2 on error', async () => {
      (mockPrisma.locationAsset.findMany as jest.MockedFunction<typeof mockPrisma.locationAsset.findMany>)
        .mockRejectedValue(new Error('DB error'));

      const result = await service.listLocationAssets('proj-1', 'user-1');

      expect(result.success).toBe(false);
      expect(result.dataV2).toEqual([]);
    });

    it('should convert base64 images to URLs lazily', async () => {
      const base64Url = 'data:image/png;base64,abc123';
      const asset = makeLocationAsset({
        images: [{ url: base64Url, id: 'img-1', source: 'upload', createdAt: '2024-01-01' }],
      });
      (mockPrisma.locationAsset.findMany as jest.MockedFunction<typeof mockPrisma.locationAsset.findMany>)
        .mockResolvedValue([asset as any]);
      mockStorageService.uploadImageFromBase64.mockResolvedValue({ url: 'https://cdn.example.com/img.png', path: 'path/img.png' });
      (mockPrisma.locationAsset.update as jest.MockedFunction<typeof mockPrisma.locationAsset.update>)
        .mockResolvedValue(asset as any);

      const result = await service.listLocationAssets('proj-1', 'user-1');

      expect(result.success).toBe(true);
      expect(mockStorageService.uploadImageFromBase64).toHaveBeenCalled();
      expect(mockPrisma.locationAsset.update).toHaveBeenCalled();
    });
  });

  describe('createLocationAsset', () => {
    it('should create asset with non-base64 images unchanged', async () => {
      const asset = makeLocationAsset();
      (mockPrisma.locationAsset.create as jest.MockedFunction<typeof mockPrisma.locationAsset.create>)
        .mockResolvedValue(asset as any);

      const result = await service.createLocationAsset('proj-1', {
        name: 'Test Location',
        description: 'A forest',
        images: [{ id: 'img-1', url: 'https://example.com/img.png', source: 'upload', createdAt: '2024-01-01' }],
      });

      expect(mockPrisma.locationAsset.create).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should upload base64 images before creating', async () => {
      const asset = makeLocationAsset();
      mockStorageService.uploadImageFromBase64.mockResolvedValue({ url: 'https://cdn.example.com/img.png', path: 'path/img.png' });
      (mockPrisma.locationAsset.create as jest.MockedFunction<typeof mockPrisma.locationAsset.create>)
        .mockResolvedValue(asset as any);

      await service.createLocationAsset('proj-1', {
        name: 'Test',
        images: [{ id: 'img-1', url: 'data:image/png;base64,abc', source: 'upload', createdAt: '2024-01-01' }],
      });

      expect(mockStorageService.uploadImageFromBase64).toHaveBeenCalled();
    });

    it('should throw on DB error', async () => {
      (mockPrisma.locationAsset.create as jest.MockedFunction<typeof mockPrisma.locationAsset.create>)
        .mockRejectedValue(new Error('DB error'));

      await expect(service.createLocationAsset('proj-1', {
        name: 'Test',
        images: [],
      })).rejects.toThrow('DB error');
    });
  });

  describe('updateLocationAsset', () => {
    it('should update existing asset', async () => {
      const existing = makeLocationAsset();
      const updated = makeLocationAsset({ name: 'Updated' });
      (mockPrisma.locationAsset.findUnique as jest.MockedFunction<typeof mockPrisma.locationAsset.findUnique>)
        .mockResolvedValue(existing as any);
      (mockPrisma.locationAsset.update as jest.MockedFunction<typeof mockPrisma.locationAsset.update>)
        .mockResolvedValue(updated as any);

      const result = await service.updateLocationAsset('proj-1', 'loc-1', { name: 'Updated' });

      expect(result).toEqual({ success: true, asset: updated });
    });

    it('should throw if asset not found', async () => {
      (mockPrisma.locationAsset.findUnique as jest.MockedFunction<typeof mockPrisma.locationAsset.findUnique>)
        .mockResolvedValue(null);

      await expect(service.updateLocationAsset('proj-1', 'nonexistent', {}))
        .rejects.toThrow('Asset not found');
    });

    it('should throw if asset belongs to different project', async () => {
      const existing = makeLocationAsset({ projectId: 'other-proj' });
      (mockPrisma.locationAsset.findUnique as jest.MockedFunction<typeof mockPrisma.locationAsset.findUnique>)
        .mockResolvedValue(existing as any);

      await expect(service.updateLocationAsset('proj-1', 'loc-1', {}))
        .rejects.toThrow('Asset not found');
    });
  });

  describe('deleteLocationAsset', () => {
    it('should delete existing asset', async () => {
      const existing = makeLocationAsset();
      (mockPrisma.locationAsset.findUnique as jest.MockedFunction<typeof mockPrisma.locationAsset.findUnique>)
        .mockResolvedValue(existing as any);
      (mockPrisma.locationAsset.delete as jest.MockedFunction<typeof mockPrisma.locationAsset.delete>)
        .mockResolvedValue(existing as any);

      const result = await service.deleteLocationAsset('proj-1', 'loc-1');

      expect(result).toEqual({ success: true });
      expect(mockPrisma.locationAsset.delete).toHaveBeenCalledWith({ where: { id: 'loc-1' } });
    });

    it('should return success for non-existent asset', async () => {
      (mockPrisma.locationAsset.findUnique as jest.MockedFunction<typeof mockPrisma.locationAsset.findUnique>)
        .mockResolvedValue(null);

      const result = await service.deleteLocationAsset('proj-1', 'nonexistent');

      expect(result).toEqual({ success: true });
      expect(mockPrisma.locationAsset.delete).not.toHaveBeenCalled();
    });

    it('should return success when asset is in different project (forbidden but soft)', async () => {
      const existing = makeLocationAsset({ projectId: 'other-proj' });
      (mockPrisma.locationAsset.findUnique as jest.MockedFunction<typeof mockPrisma.locationAsset.findUnique>)
        .mockResolvedValue(existing as any);

      const result = await service.deleteLocationAsset('proj-1', 'loc-1');

      expect(result).toEqual({ success: true });
      expect(mockPrisma.locationAsset.delete).not.toHaveBeenCalled();
    });
  });

  describe('getLocationLibItems', () => {
    it('should return slim location list', async () => {
      (mockPrisma.locationAsset.findMany as jest.MockedFunction<typeof mockPrisma.locationAsset.findMany>)
        .mockResolvedValue([
          { name: 'Forest', description: 'Dark forest', alias: 'F' } as any,
          { name: 'City', description: null, alias: null } as any,
        ]);

      const result = await service.getLocationLibItems('proj-1');

      expect(result).toEqual([
        { name: 'Forest', description: 'Dark forest', alias: 'F' },
        { name: 'City', description: undefined, alias: undefined },
      ]);
    });

    it('should return empty array on error', async () => {
      (mockPrisma.locationAsset.findMany as jest.MockedFunction<typeof mockPrisma.locationAsset.findMany>)
        .mockRejectedValue(new Error('DB error'));

      const result = await service.getLocationLibItems('proj-1');

      expect(result).toEqual([]);
    });
  });

  describe('persistExtracted', () => {
    it('should clear existing and save new locations', async () => {
      (mockPrisma.locationAsset.deleteMany as jest.MockedFunction<typeof mockPrisma.locationAsset.deleteMany>)
        .mockResolvedValue({ count: 3 });
      (mockPrisma.locationAsset.create as jest.MockedFunction<typeof mockPrisma.locationAsset.create>)
        .mockResolvedValue(makeLocationAsset() as any);

      await service.persistExtracted('proj-1', {
        locations: [{ name: 'Forest', description: 'Dark', alias: 'F' }],
      });

      expect(mockPrisma.locationAsset.deleteMany).toHaveBeenCalledWith({ where: { projectId: 'proj-1' } });
      expect(mockPrisma.locationAsset.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: 'Forest', projectId: 'proj-1' }),
      });
    });

    it('should unwrap nested locations array', async () => {
      (mockPrisma.locationAsset.deleteMany as jest.MockedFunction<typeof mockPrisma.locationAsset.deleteMany>)
        .mockResolvedValue({ count: 0 });
      (mockPrisma.locationAsset.create as jest.MockedFunction<typeof mockPrisma.locationAsset.create>)
        .mockResolvedValue(makeLocationAsset() as any);

      // Nested format: locations: [ { locations: [...] } ]
      await service.persistExtracted('proj-1', {
        locations: [
          { locations: [{ name: 'Beach', description: 'Sunny' }] },
        ],
      });

      expect(mockPrisma.locationAsset.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: 'Beach' }),
      });
    });

    it('should handle missing locations gracefully', async () => {
      (mockPrisma.locationAsset.deleteMany as jest.MockedFunction<typeof mockPrisma.locationAsset.deleteMany>)
        .mockResolvedValue({ count: 0 });

      await expect(service.persistExtracted('proj-1', {})).resolves.toBeUndefined();
      expect(mockPrisma.locationAsset.create).not.toHaveBeenCalled();
    });
  });

  describe('generateLocationImage', () => {
    it('should generate image and return result', async () => {
      mockRunImageGeneration.mockResolvedValue({ images: [{ url: 'https://img.example.com/loc.png' }] } as any);
      mockStorageService.uploadImageFromUrl.mockResolvedValue('https://cdn.example.com/loc.png');

      const result = await service.generateLocationImage('proj-1', 'user-1', {
        locationId: 'loc-1',
        name: 'Forest',
        description: 'A dark forest',
        style: 'realistic',
      });

      expect(result.success).toBe(true);
      expect(result.locationId).toBe('loc-1');
      expect(result.images).toHaveLength(1);
    });

    it('should throw on generation failure', async () => {
      mockRunImageGeneration.mockRejectedValue(new Error('AgentOS failure'));

      await expect(service.generateLocationImage('proj-1', 'user-1', {
        locationId: 'loc-1',
        name: 'Forest',
        description: 'desc',
      })).rejects.toThrow('AgentOS failure');
    });
  });

  describe('AssetAdapter interface', () => {
    it('listAssets delegates to listLocationAssets', async () => {
      (mockPrisma.locationAsset.findMany as jest.MockedFunction<typeof mockPrisma.locationAsset.findMany>)
        .mockResolvedValue([]);

      const result = await service.listAssets('proj-1', 'user-1');
      expect((result as { success: boolean }).success).toBe(true);
    });

    it('getAsset returns asset when found', async () => {
      const asset = makeLocationAsset();
      (mockPrisma.locationAsset.findUnique as jest.MockedFunction<typeof mockPrisma.locationAsset.findUnique>)
        .mockResolvedValue(asset as any);

      const result = await service.getAsset('proj-1', 'loc-1');
      expect(result).toEqual(asset);
    });

    it('getAsset throws when not found', async () => {
      (mockPrisma.locationAsset.findUnique as jest.MockedFunction<typeof mockPrisma.locationAsset.findUnique>)
        .mockResolvedValue(null);

      await expect(service.getAsset('proj-1', 'nonexistent')).rejects.toThrow('Location asset not found');
    });
  });
});
