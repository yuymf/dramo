import { prisma } from '../lib/db';
import { AppException, ErrorCode } from '../lib/errors';
import { encrypt, decrypt, maskApiKey, sanitizeHeaderValue } from '../lib/crypto';
import type { LLMConfigType } from '@prisma/client';

const MAX_CONFIGS_PER_USER = 20;

interface CreateConfigInput {
  name: string;
  type: LLMConfigType;
  baseUrl: string;
  apiKey: string;
  modelId: string;
  isDefault: boolean;
}

interface UpdateConfigInput {
  name?: string;
  baseUrl?: string;
  apiKey?: string;
  modelId?: string;
  isDefault?: boolean;
}

export class LLMConfigService {
  async listConfigs(userId: string) {
    const configs = await prisma.userLLMConfig.findMany({
      where: { userId },
      orderBy: [{ type: 'asc' }, { isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return {
      data: configs.map((cfg) => ({
        ...cfg,
        apiKey: maskApiKey(decrypt(cfg.apiKey)),
      })),
    };
  }

  async getConfig(id: string, userId: string) {
    const config = await prisma.userLLMConfig.findFirst({
      where: { id, userId },
    });
    if (!config) {
      throw new AppException(ErrorCode.LLM_CONFIG_NOT_FOUND, 'LLM config not found');
    }
    return { ...config, apiKey: maskApiKey(decrypt(config.apiKey)) };
  }

  async createConfig(userId: string, input: CreateConfigInput) {
    const count = await prisma.userLLMConfig.count({ where: { userId } });
    if (count >= MAX_CONFIGS_PER_USER) {
      throw new AppException(
        ErrorCode.LLM_CONFIG_LIMIT_EXCEEDED,
        `Maximum ${MAX_CONFIGS_PER_USER} LLM configurations allowed`
      );
    }

    const encryptedKey = encrypt(input.apiKey);

    if (input.isDefault) {
      return await prisma.$transaction(async (tx) => {
        await tx.userLLMConfig.updateMany({
          where: { userId, type: input.type, isDefault: true },
          data: { isDefault: false },
        });
        const created = await tx.userLLMConfig.create({
          data: {
            userId,
            name: input.name,
            type: input.type,
            baseUrl: input.baseUrl,
            apiKey: encryptedKey,
            modelId: input.modelId,
            isDefault: true,
          },
        });
        return { ...created, apiKey: maskApiKey(input.apiKey) };
      });
    }

    const created = await prisma.userLLMConfig.create({
      data: {
        userId,
        name: input.name,
        type: input.type,
        baseUrl: input.baseUrl,
        apiKey: encryptedKey,
        modelId: input.modelId,
        isDefault: input.isDefault,
      },
    });
    return { ...created, apiKey: maskApiKey(input.apiKey) };
  }

  async updateConfig(id: string, userId: string, input: UpdateConfigInput) {
    const existing = await prisma.userLLMConfig.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new AppException(ErrorCode.LLM_CONFIG_NOT_FOUND, 'LLM config not found');
    }

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.baseUrl !== undefined) data.baseUrl = input.baseUrl;
    if (input.modelId !== undefined) data.modelId = input.modelId;
    if (input.apiKey !== undefined) data.apiKey = encrypt(input.apiKey);
    if (input.isDefault !== undefined) data.isDefault = input.isDefault;

    if (input.isDefault === true) {
      return await prisma.$transaction(async (tx) => {
        await tx.userLLMConfig.updateMany({
          where: { userId, type: existing.type, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
        const updated = await tx.userLLMConfig.update({
          where: { id },
          data: { ...data, isDefault: true },
        });
        return { ...updated, apiKey: maskApiKey(decrypt(updated.apiKey)) };
      });
    }

    const updated = await prisma.userLLMConfig.update({
      where: { id },
      data,
    });
    return { ...updated, apiKey: maskApiKey(decrypt(updated.apiKey)) };
  }

  async deleteConfig(id: string, userId: string) {
    const existing = await prisma.userLLMConfig.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new AppException(ErrorCode.LLM_CONFIG_NOT_FOUND, 'LLM config not found');
    }
    await prisma.userLLMConfig.delete({ where: { id } });
  }

  async setDefault(id: string, userId: string) {
    const existing = await prisma.userLLMConfig.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new AppException(ErrorCode.LLM_CONFIG_NOT_FOUND, 'LLM config not found');
    }
    await prisma.$transaction(async (tx) => {
      await tx.userLLMConfig.updateMany({
        where: { userId, type: existing.type, isDefault: true },
        data: { isDefault: false },
      });
      await tx.userLLMConfig.update({
        where: { id },
        data: { isDefault: true },
      });
    });
  }

  async getLLMHeaders(
    userId: string,
    type: LLMConfigType
  ): Promise<Record<string, string>> {
    const config = await prisma.userLLMConfig.findFirst({
      where: { userId, type, isDefault: true },
    });

    if (!config) {
      throw new AppException(
        ErrorCode.LLM_NOT_CONFIGURED,
        `No default ${type} configuration found. Please configure your LLM API key first.`,
        { statusCode: 403 }
      );
    }

    const decryptedKey = decrypt(config.apiKey);

    return {
      'X-LLM-Api-Key': sanitizeHeaderValue(decryptedKey),
      'X-LLM-Base-Url': sanitizeHeaderValue(config.baseUrl),
      'X-LLM-Model-Id': sanitizeHeaderValue(config.modelId),
    };
  }
}
