import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock prisma before importing
jest.mock('../../lib/db', () => ({
  prisma: {
    characterAsset: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    characterRelation: {
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        characterRelation: { deleteMany: (jest.fn() as any).mockResolvedValue({ count: 0 }) },
        characterAsset: {
          deleteMany: (jest.fn() as any).mockResolvedValue({ count: 0 }),
          create: (jest.fn() as any).mockResolvedValue({ id: 'asset-1' }),
        },
      };
      return fn(tx);
    }),
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
import { CharacterAssetService } from '../../services/character-asset.service';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockRunImageGeneration = runImageGeneration as jest.MockedFunction<typeof runImageGeneration>;

function makeCharacterAsset(overrides: Record<string, unknown> = {}) {
  return {
    id: 'asset-1',
    projectId: 'proj-1',
    name: 'Test Character',
    description: 'A brave hero',
    alias: null,
    images: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

describe('CharacterAssetService', () => {
  let service: CharacterAssetService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockStorageService: any;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CharacterAssetService();
    // Access internal storageService mock
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockStorageService = (service as any).storageService;
  });

  describe('listCharacterAssets', () => {
    it('should return assets with success:true', async () => {
      const asset = makeCharacterAsset({ images: [] });
      (mockPrisma.characterAsset.findMany as jest.MockedFunction<typeof mockPrisma.characterAsset.findMany>)
        .mockResolvedValue([asset as any]);

      const result = await service.listCharacterAssets('proj-1', 'user-1');

      expect(result.success).toBe(true);
      expect(Array.isArray(result.dataV2)).toBe(true);
      expect(result.dataV2).toHaveLength(1);
    });

    it('should return empty dataV2 on error', async () => {
      (mockPrisma.characterAsset.findMany as jest.MockedFunction<typeof mockPrisma.characterAsset.findMany>)
        .mockRejectedValue(new Error('DB error'));

      const result = await service.listCharacterAssets('proj-1', 'user-1');

      expect(result.success).toBe(false);
      expect(result.dataV2).toEqual([]);
    });

    it('should convert base64 images to URLs lazily', async () => {
      const base64Url = 'data:image/png;base64,abc123';
      const asset = makeCharacterAsset({ images: [{ url: base64Url, id: 'img-1', source: 'upload', createdAt: '2024-01-01' }] });
      (mockPrisma.characterAsset.findMany as jest.MockedFunction<typeof mockPrisma.characterAsset.findMany>)
        .mockResolvedValue([asset as any]);
      mockStorageService.uploadImageFromBase64.mockResolvedValue({ url: 'https://cdn.example.com/img.png', path: 'path/img.png' });
      (mockPrisma.characterAsset.update as jest.MockedFunction<typeof mockPrisma.characterAsset.update>)
        .mockResolvedValue(asset as any);

      const result = await service.listCharacterAssets('proj-1', 'user-1');

      expect(result.success).toBe(true);
      expect(mockStorageService.uploadImageFromBase64).toHaveBeenCalledWith('proj-1', base64Url);
      expect(mockPrisma.characterAsset.update).toHaveBeenCalled();
    });
  });

  describe('createCharacterAsset', () => {
    it('should create asset with non-base64 images unchanged', async () => {
      const asset = makeCharacterAsset();
      (mockPrisma.characterAsset.create as jest.MockedFunction<typeof mockPrisma.characterAsset.create>)
        .mockResolvedValue(asset as any);

      const result = await service.createCharacterAsset('proj-1', {
        name: 'Test Character',
        description: 'A hero',
        images: [{ id: 'img-1', url: 'https://example.com/img.png', source: 'upload', createdAt: '2024-01-01' }],
      });

      expect(mockPrisma.characterAsset.create).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should upload base64 images before creating asset', async () => {
      const asset = makeCharacterAsset();
      mockStorageService.uploadImageFromBase64.mockResolvedValue({ url: 'https://cdn.example.com/img.png', path: 'path/img.png' });
      (mockPrisma.characterAsset.create as jest.MockedFunction<typeof mockPrisma.characterAsset.create>)
        .mockResolvedValue(asset as any);

      await service.createCharacterAsset('proj-1', {
        name: 'Test',
        images: [{ id: 'img-1', url: 'data:image/png;base64,abc', source: 'upload', createdAt: '2024-01-01' }],
      });

      expect(mockStorageService.uploadImageFromBase64).toHaveBeenCalled();
    });

    it('should throw on DB error', async () => {
      (mockPrisma.characterAsset.create as jest.MockedFunction<typeof mockPrisma.characterAsset.create>)
        .mockRejectedValue(new Error('DB error'));

      await expect(service.createCharacterAsset('proj-1', {
        name: 'Test',
        images: [],
      })).rejects.toThrow('DB error');
    });
  });

  describe('updateCharacterAsset', () => {
    it('should update existing asset', async () => {
      const existing = makeCharacterAsset();
      const updated = makeCharacterAsset({ name: 'Updated Name' });
      (mockPrisma.characterAsset.findUnique as jest.MockedFunction<typeof mockPrisma.characterAsset.findUnique>)
        .mockResolvedValue(existing as any);
      (mockPrisma.characterAsset.update as jest.MockedFunction<typeof mockPrisma.characterAsset.update>)
        .mockResolvedValue(updated as any);

      const result = await service.updateCharacterAsset('proj-1', 'asset-1', { name: 'Updated Name' });

      expect(result).toEqual({ success: true, asset: updated });
    });

    it('should throw if asset not found', async () => {
      (mockPrisma.characterAsset.findUnique as jest.MockedFunction<typeof mockPrisma.characterAsset.findUnique>)
        .mockResolvedValue(null);

      await expect(service.updateCharacterAsset('proj-1', 'nonexistent', { name: 'x' }))
        .rejects.toThrow('Asset not found');
    });

    it('should throw if asset belongs to different project', async () => {
      const existing = makeCharacterAsset({ projectId: 'other-proj' });
      (mockPrisma.characterAsset.findUnique as jest.MockedFunction<typeof mockPrisma.characterAsset.findUnique>)
        .mockResolvedValue(existing as any);

      await expect(service.updateCharacterAsset('proj-1', 'asset-1', { name: 'x' }))
        .rejects.toThrow('Asset not found');
    });
  });

  describe('deleteCharacterAsset', () => {
    it('should delete existing asset and its relations', async () => {
      const existing = makeCharacterAsset();
      (mockPrisma.characterAsset.findUnique as jest.MockedFunction<typeof mockPrisma.characterAsset.findUnique>)
        .mockResolvedValue(existing as any);
      (mockPrisma.characterRelation.deleteMany as jest.MockedFunction<typeof mockPrisma.characterRelation.deleteMany>)
        .mockResolvedValue({ count: 2 });
      (mockPrisma.characterAsset.delete as jest.MockedFunction<typeof mockPrisma.characterAsset.delete>)
        .mockResolvedValue(existing as any);

      const result = await service.deleteCharacterAsset('proj-1', 'asset-1');

      expect(result).toEqual({ success: true });
      expect(mockPrisma.characterRelation.deleteMany).toHaveBeenCalledWith({
        where: { OR: [{ nodeAId: 'asset-1' }, { nodeBId: 'asset-1' }] },
      });
      expect(mockPrisma.characterAsset.delete).toHaveBeenCalledWith({ where: { id: 'asset-1' } });
    });

    it('should return success for non-existent asset', async () => {
      (mockPrisma.characterAsset.findUnique as jest.MockedFunction<typeof mockPrisma.characterAsset.findUnique>)
        .mockResolvedValue(null);

      const result = await service.deleteCharacterAsset('proj-1', 'nonexistent');

      expect(result).toEqual({ success: true });
      expect(mockPrisma.characterAsset.delete).not.toHaveBeenCalled();
    });

    it('should return success when asset is in different project (forbidden but soft)', async () => {
      const existing = makeCharacterAsset({ projectId: 'other-proj' });
      (mockPrisma.characterAsset.findUnique as jest.MockedFunction<typeof mockPrisma.characterAsset.findUnique>)
        .mockResolvedValue(existing as any);

      const result = await service.deleteCharacterAsset('proj-1', 'asset-1');

      expect(result).toEqual({ success: true });
      expect(mockPrisma.characterAsset.delete).not.toHaveBeenCalled();
    });
  });

  describe('getCharacterLibItems', () => {
    it('should return slim character list', async () => {
      (mockPrisma.characterAsset.findMany as jest.MockedFunction<typeof mockPrisma.characterAsset.findMany>)
        .mockResolvedValue([
          { name: 'Hero', description: 'Brave', alias: 'H' } as any,
          { name: 'Villain', description: null, alias: null } as any,
        ]);

      const result = await service.getCharacterLibItems('proj-1');

      expect(result).toEqual([
        { name: 'Hero', description: 'Brave', alias: 'H' },
        { name: 'Villain', description: undefined, alias: undefined },
      ]);
    });

    it('should return empty array on error', async () => {
      (mockPrisma.characterAsset.findMany as jest.MockedFunction<typeof mockPrisma.characterAsset.findMany>)
        .mockRejectedValue(new Error('DB error'));

      const result = await service.getCharacterLibItems('proj-1');

      expect(result).toEqual([]);
    });
  });

  describe('persistExtracted', () => {
    it('should replace existing characters inside a transaction', async () => {
      await service.persistExtracted('proj-1', {
        new_characters: [{ name: 'Alice', description: 'A hero', alias: 'A' }],
      });

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should refuse to wipe the library when extraction is empty', async () => {
      await expect(service.persistExtracted('proj-1', {})).rejects.toThrow('No characters extracted');
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('generateCharacter3View', () => {
    it('should generate image and return result', async () => {
      mockRunImageGeneration.mockResolvedValue({ images: [{ url: 'https://img.example.com/char.png' }] } as any);
      mockStorageService.uploadImageFromUrl.mockResolvedValue('https://cdn.example.com/char.png');

      const result = await service.generateCharacter3View('proj-1', 'user-1', {
        characterId: 'char-1',
        name: 'Alice',
        description: 'A brave hero',
        style: 'realistic',
      });

      expect(result.success).toBe(true);
      expect(result.characterId).toBe('char-1');
      expect(result.images).toHaveLength(1);
    });

    it('should throw on generation failure', async () => {
      mockRunImageGeneration.mockRejectedValue(new Error('AgentOS failure'));

      await expect(service.generateCharacter3View('proj-1', 'user-1', {
        characterId: 'char-1',
        name: 'Alice',
        description: 'desc',
      })).rejects.toThrow('AgentOS failure');
    });
  });

  describe('AssetAdapter interface', () => {
    it('listAssets delegates to listCharacterAssets', async () => {
      (mockPrisma.characterAsset.findMany as jest.MockedFunction<typeof mockPrisma.characterAsset.findMany>)
        .mockResolvedValue([]);

      const result = await service.listAssets('proj-1', 'user-1');
      expect((result as { success: boolean }).success).toBe(true);
    });

    it('getAsset returns asset when found', async () => {
      const asset = makeCharacterAsset();
      (mockPrisma.characterAsset.findUnique as jest.MockedFunction<typeof mockPrisma.characterAsset.findUnique>)
        .mockResolvedValue(asset as any);

      const result = await service.getAsset('proj-1', 'asset-1');
      expect(result).toEqual(asset);
    });

    it('getAsset throws when not found', async () => {
      (mockPrisma.characterAsset.findUnique as jest.MockedFunction<typeof mockPrisma.characterAsset.findUnique>)
        .mockResolvedValue(null);

      await expect(service.getAsset('proj-1', 'nonexistent')).rejects.toThrow('Character asset not found');
    });
  });
});
