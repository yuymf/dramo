import { Hono } from 'hono';
import type { AuthEnv } from '../middleware/default-user';
import { LLMConfigService } from '../services/llm-config.service';
import { startWorkflowRun } from './agentos-client';
import { logger } from './logger';

/**
 * Generic adapter interface that both CharacterAssetService and
 * LocationAssetService implement, allowing the factory to handle
 * CRUD and extraction endpoints for any asset type.
 */
export interface AssetAdapter {
  listAssets(projectId: string, userId: string): Promise<unknown>;
  createAsset(projectId: string, data: Record<string, unknown>): Promise<unknown>;
  updateAsset(projectId: string, assetId: string, data: Record<string, unknown>): Promise<unknown>;
  deleteAsset(projectId: string, assetId: string): Promise<unknown>;
  persistExtracted(projectId: string, extractedData: Record<string, unknown>): Promise<void>;
}

export interface AssetRouterConfig {
  model: 'character' | 'location';
  service: AssetAdapter;
  /** AgentOS workflow name, e.g. 'charactersworkflow' | 'locationsworkflow' */
  agentWorkflow: string;
  /** Route path prefix, e.g. '/projects/:projectId/characters' */
  basePath: string;
}

const llmConfigService = new LLMConfigService();

/**
 * Factory that generates a Hono router containing asset routes for one model:
 *   GET    {basePath}/assets            — list
 *   POST   {basePath}/assets            — create
 *   PUT    {basePath}/assets/:assetId   — update
 *   DELETE {basePath}/assets/:assetId   — delete
 *   POST   {basePath}/extract           — extraction + DB persistence
 */
export function createAssetRouter(config: AssetRouterConfig): Hono<AuthEnv> {
  const router = new Hono<AuthEnv>();
  const { service, agentWorkflow, basePath, model } = config;
  const modelLabel = model === 'character' ? '角色' : '场景';

  router.get(`${basePath}/assets`, async (c) => {
    const projectId = c.req.param('projectId') as string;
    const userId = c.get('user').userId;
    const result = await service.listAssets(projectId, userId);
    return c.json(result);
  });

  router.post(`${basePath}/assets`, async (c) => {
    const projectId = c.req.param('projectId') as string;
    const data = await c.req.json() as Record<string, unknown>;
    const asset = await service.createAsset(projectId, data);
    return c.json(asset, 201);
  });

  router.put(`${basePath}/assets/:assetId`, async (c) => {
    const projectId = c.req.param('projectId') as string;
    const assetId = c.req.param('assetId') as string;
    const data = await c.req.json() as Record<string, unknown>;
    const asset = await service.updateAsset(projectId, assetId, data);
    return c.json(asset);
  });

  router.delete(`${basePath}/assets/:assetId`, async (c) => {
    const projectId = c.req.param('projectId') as string;
    const assetId = c.req.param('assetId') as string;
    await service.deleteAsset(projectId, assetId);
    return c.json({ success: true });
  });

  router.post(`${basePath}/extract`, async (c) => {
    const projectId = c.req.param('projectId') as string;
    const userId = c.get('user').userId;
    const requestId = c.get('requestId');
    const { text } = await c.req.json() as { text: string };

    if (!text?.trim()) {
      return c.json(
        { error: { code: 'INVALID_INPUT', message: '输入文本不能为空', retryable: false }, requestId },
        400
      );
    }

    try {
      const llmHeaders = await llmConfigService.getLLMHeaders(userId, 'TEXT_LLM');
      const response = await startWorkflowRun(
        agentWorkflow,
        { projectId, text },
        { stream: false, llmHeaders }
      );
      const result = await response.json() as Record<string, unknown>;

      let extractedData: Record<string, unknown> = result;
      if (typeof result?.content === 'string') {
        try {
          extractedData = JSON.parse(result.content) as Record<string, unknown>;
        } catch {
          logger.warn({ projectId }, `Failed to parse ${model}s content string`);
          return c.json(
            { error: { code: 'INTERNAL_ERROR', message: `提取${modelLabel}结果解析失败`, retryable: true }, requestId },
            502
          );
        }
      }

      await service.persistExtracted(projectId, extractedData);
      return c.json(extractedData);
    } catch (err) {
      logger.error({ err, projectId }, `${model}s extraction failed`);
      return c.json(
        { error: { code: 'INTERNAL_ERROR', message: `提取${modelLabel}信息失败`, retryable: true }, requestId },
        502
      );
    }
  });

  return router;
}
