import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Set test encryption key before importing modules that use crypto
process.env.ENCRYPTION_KEY = 'a'.repeat(64);

// Mock prisma before importing the service
jest.mock('../../lib/db', () => ({
  prisma: {
    userLLMConfig: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

import { prisma } from '../../lib/db';
import { LLMConfigService } from '../../services/llm-config.service';
import { AppException, ErrorCode } from '../../lib/errors';
import { encrypt } from '../../lib/crypto';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// Helper to create a mock LLMConfig record with an encrypted apiKey
function makeMockConfig(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cfg-1',
    userId: 'user-1',
    name: 'Test Config',
    type: 'TEXT_LLM' as const,
    baseUrl: 'https://api.openai.com/v1',
    apiKey: encrypt('sk-test-key-12345'),
    modelId: 'gpt-4o',
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('LLMConfigService', () => {
  let service: LLMConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LLMConfigService();
  });

  describe('listConfigs', () => {
    it('should return configs with masked API keys', async () => {
      const plainKey = 'sk-test-key-12345';
      const mockConfig = makeMockConfig({ apiKey: encrypt(plainKey) });

      (mockPrisma.userLLMConfig.findMany as jest.MockedFunction<typeof mockPrisma.userLLMConfig.findMany>)
        .mockResolvedValue([mockConfig]);

      const result = await service.listConfigs('user-1');

      expect(result.data).toHaveLength(1);
      expect(result.data[0].apiKey).not.toBe(plainKey);
      expect(result.data[0].apiKey).not.toContain(':'); // not the encrypted format
      expect(result.data[0].apiKey).toContain('***'); // masked format
      expect(result.data[0].apiKey).toBe('sk-***...345'); // first 3 + last 3 masked
    });

    it('should query configs ordered by type, isDefault, createdAt', async () => {
      (mockPrisma.userLLMConfig.findMany as jest.MockedFunction<typeof mockPrisma.userLLMConfig.findMany>)
        .mockResolvedValue([]);

      await service.listConfigs('user-1');

      expect(mockPrisma.userLLMConfig.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: [{ type: 'asc' }, { isDefault: 'desc' }, { createdAt: 'desc' }],
      });
    });
  });

  describe('getConfig', () => {
    it('should return config with masked API key', async () => {
      const plainKey = 'sk-test-key-abcxyz';
      const mockConfig = makeMockConfig({ apiKey: encrypt(plainKey) });

      (mockPrisma.userLLMConfig.findFirst as jest.MockedFunction<typeof mockPrisma.userLLMConfig.findFirst>)
        .mockResolvedValue(mockConfig);

      const result = await service.getConfig('cfg-1', 'user-1');

      expect(result.apiKey).toContain('***');
      expect(result.apiKey).not.toBe(plainKey);
    });

    it('should throw LLM_CONFIG_NOT_FOUND when config does not exist', async () => {
      (mockPrisma.userLLMConfig.findFirst as jest.MockedFunction<typeof mockPrisma.userLLMConfig.findFirst>)
        .mockResolvedValue(null);

      await expect(service.getConfig('nonexistent', 'user-1')).rejects.toThrow(AppException);
      await expect(service.getConfig('nonexistent', 'user-1')).rejects.toMatchObject({
        code: ErrorCode.LLM_CONFIG_NOT_FOUND,
      });
    });
  });

  describe('createConfig', () => {
    it('should throw LLM_CONFIG_LIMIT_EXCEEDED when user has 20 configs', async () => {
      (mockPrisma.userLLMConfig.count as jest.MockedFunction<typeof mockPrisma.userLLMConfig.count>)
        .mockResolvedValue(20);

      const input = {
        name: 'New Config',
        type: 'TEXT_LLM' as const,
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-new-key-123456',
        modelId: 'gpt-4o',
        isDefault: false,
      };

      await expect(service.createConfig('user-1', input)).rejects.toThrow(AppException);
      await expect(service.createConfig('user-1', input)).rejects.toMatchObject({
        code: ErrorCode.LLM_CONFIG_LIMIT_EXCEEDED,
      });
    });

    it('should create config with encrypted API key and return masked key', async () => {
      (mockPrisma.userLLMConfig.count as jest.MockedFunction<typeof mockPrisma.userLLMConfig.count>)
        .mockResolvedValue(0);

      const plainKey = 'sk-new-key-abcdef';
      const createdConfig = makeMockConfig({
        apiKey: encrypt(plainKey),
        isDefault: false,
      });

      (mockPrisma.userLLMConfig.create as jest.MockedFunction<typeof mockPrisma.userLLMConfig.create>)
        .mockResolvedValue(createdConfig);

      const input = {
        name: 'New Config',
        type: 'TEXT_LLM' as const,
        baseUrl: 'https://api.openai.com/v1',
        apiKey: plainKey,
        modelId: 'gpt-4o',
        isDefault: false,
      };

      const result = await service.createConfig('user-1', input);

      // Verify the stored apiKey is encrypted (not plaintext)
      const createCall = (mockPrisma.userLLMConfig.create as jest.MockedFunction<typeof mockPrisma.userLLMConfig.create>).mock.calls[0][0];
      expect(createCall.data.apiKey).not.toBe(plainKey);
      expect(createCall.data.apiKey).toContain(':'); // encrypted format

      // Verify returned apiKey is masked
      expect(result.apiKey).toContain('***');
      expect(result.apiKey).not.toBe(plainKey);
    });

    it('should use transaction when isDefault is true to clear other defaults', async () => {
      (mockPrisma.userLLMConfig.count as jest.MockedFunction<typeof mockPrisma.userLLMConfig.count>)
        .mockResolvedValue(2);

      const plainKey = 'sk-default-key-123';
      const createdConfig = makeMockConfig({ apiKey: encrypt(plainKey) });

      // Mock $transaction to execute the callback
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockPrisma.$transaction as jest.MockedFunction<any>)
        .mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
          const tx = {
            userLLMConfig: {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              updateMany: (jest.fn() as jest.Mock<any>).mockResolvedValue({ count: 1 }),
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              create: (jest.fn() as jest.Mock<any>).mockResolvedValue(createdConfig),
            },
          };
          return fn(tx);
        });

      const input = {
        name: 'Default Config',
        type: 'TEXT_LLM' as const,
        baseUrl: 'https://api.openai.com/v1',
        apiKey: plainKey,
        modelId: 'gpt-4o',
        isDefault: true,
      };

      const result = await service.createConfig('user-1', input);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(result.apiKey).toContain('***');
    });
  });

  describe('updateConfig', () => {
    it('should throw LLM_CONFIG_NOT_FOUND when config does not exist', async () => {
      (mockPrisma.userLLMConfig.findFirst as jest.MockedFunction<typeof mockPrisma.userLLMConfig.findFirst>)
        .mockResolvedValue(null);

      await expect(service.updateConfig('nonexistent', 'user-1', { name: 'New Name' })).rejects.toThrow(AppException);
      await expect(service.updateConfig('nonexistent', 'user-1', { name: 'New Name' })).rejects.toMatchObject({
        code: ErrorCode.LLM_CONFIG_NOT_FOUND,
      });
    });

    it('should update config fields and return masked API key', async () => {
      const plainKey = 'sk-updated-key-xyz';
      const existingConfig = makeMockConfig();
      const updatedConfig = makeMockConfig({ apiKey: encrypt(plainKey) });

      (mockPrisma.userLLMConfig.findFirst as jest.MockedFunction<typeof mockPrisma.userLLMConfig.findFirst>)
        .mockResolvedValue(existingConfig);
      (mockPrisma.userLLMConfig.update as jest.MockedFunction<typeof mockPrisma.userLLMConfig.update>)
        .mockResolvedValue(updatedConfig);

      const result = await service.updateConfig('cfg-1', 'user-1', { apiKey: plainKey });

      expect(result.apiKey).toContain('***');
    });
  });

  describe('deleteConfig', () => {
    it('should throw LLM_CONFIG_NOT_FOUND for non-existent config', async () => {
      (mockPrisma.userLLMConfig.findFirst as jest.MockedFunction<typeof mockPrisma.userLLMConfig.findFirst>)
        .mockResolvedValue(null);

      await expect(service.deleteConfig('nonexistent', 'user-1')).rejects.toThrow(AppException);
      await expect(service.deleteConfig('nonexistent', 'user-1')).rejects.toMatchObject({
        code: ErrorCode.LLM_CONFIG_NOT_FOUND,
      });
    });

    it('should delete existing config', async () => {
      const mockConfig = makeMockConfig();

      (mockPrisma.userLLMConfig.findFirst as jest.MockedFunction<typeof mockPrisma.userLLMConfig.findFirst>)
        .mockResolvedValue(mockConfig);
      (mockPrisma.userLLMConfig.delete as jest.MockedFunction<typeof mockPrisma.userLLMConfig.delete>)
        .mockResolvedValue(mockConfig);

      await expect(service.deleteConfig('cfg-1', 'user-1')).resolves.toBeUndefined();
      expect(mockPrisma.userLLMConfig.delete).toHaveBeenCalledWith({ where: { id: 'cfg-1' } });
    });
  });

  describe('setDefault', () => {
    it('should throw LLM_CONFIG_NOT_FOUND when config does not exist', async () => {
      (mockPrisma.userLLMConfig.findFirst as jest.MockedFunction<typeof mockPrisma.userLLMConfig.findFirst>)
        .mockResolvedValue(null);

      await expect(service.setDefault('nonexistent', 'user-1')).rejects.toMatchObject({
        code: ErrorCode.LLM_CONFIG_NOT_FOUND,
      });
    });

    it('should use transaction to set default and clear others', async () => {
      const mockConfig = makeMockConfig();

      (mockPrisma.userLLMConfig.findFirst as jest.MockedFunction<typeof mockPrisma.userLLMConfig.findFirst>)
        .mockResolvedValue(mockConfig);

      const mockTx = {
        userLLMConfig: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          updateMany: (jest.fn() as jest.Mock<any>).mockResolvedValue({ count: 1 }),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          update: (jest.fn() as jest.Mock<any>).mockResolvedValue(mockConfig),
        },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockPrisma.$transaction as jest.MockedFunction<any>)
        .mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockTx));

      await service.setDefault('cfg-1', 'user-1');

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockTx.userLLMConfig.updateMany).toHaveBeenCalled();
      expect(mockTx.userLLMConfig.update).toHaveBeenCalledWith({
        where: { id: 'cfg-1' },
        data: { isDefault: true },
      });
    });
  });

  describe('getLLMHeaders', () => {
    it('should throw LLM_NOT_CONFIGURED when no default config exists', async () => {
      (mockPrisma.userLLMConfig.findFirst as jest.MockedFunction<typeof mockPrisma.userLLMConfig.findFirst>)
        .mockResolvedValue(null);

      await expect(service.getLLMHeaders('user-1', 'TEXT_LLM')).rejects.toThrow(AppException);
      await expect(service.getLLMHeaders('user-1', 'TEXT_LLM')).rejects.toMatchObject({
        code: ErrorCode.LLM_NOT_CONFIGURED,
        statusCode: 403,
      });
    });

    it('should return decrypted headers when default config exists', async () => {
      const plainKey = 'sk-real-key-abc123';
      const mockConfig = makeMockConfig({ apiKey: encrypt(plainKey) });

      (mockPrisma.userLLMConfig.findFirst as jest.MockedFunction<typeof mockPrisma.userLLMConfig.findFirst>)
        .mockResolvedValue(mockConfig);

      const headers = await service.getLLMHeaders('user-1', 'TEXT_LLM');

      expect(headers['X-LLM-Api-Key']).toBe(plainKey);
      expect(headers['X-LLM-Base-Url']).toBe('https://api.openai.com/v1');
      expect(headers['X-LLM-Model-Id']).toBe('gpt-4o');
    });

    it('should sanitize header values to prevent injection', async () => {
      const maliciousKey = 'sk-key\r\nX-Injected: evil';
      const mockConfig = makeMockConfig({ apiKey: encrypt(maliciousKey) });

      (mockPrisma.userLLMConfig.findFirst as jest.MockedFunction<typeof mockPrisma.userLLMConfig.findFirst>)
        .mockResolvedValue(mockConfig);

      const headers = await service.getLLMHeaders('user-1', 'TEXT_LLM');

      expect(headers['X-LLM-Api-Key']).not.toContain('\r');
      expect(headers['X-LLM-Api-Key']).not.toContain('\n');
    });
  });
});
