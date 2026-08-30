import { logger } from '../lib/logger';
import { prisma } from '../lib/db';

interface CreateRelationData {
  sourceId: string;
  targetId: string;
  type?: string;
  weight?: number;
  notes?: string;
}

/**
 * 角色关系服务
 * 管理角色之间的无向关系（边）
 */
export class RelationService {
  /**
   * 规范化节点 ID：总是确保 nodeAId < nodeBId（字符串字典序）
   * 这样保证无向边的去重和一致性
   */
  private normalizeNodeIds(id1: string, id2: string): { nodeAId: string; nodeBId: string } {
    return id1 < id2 ? { nodeAId: id1, nodeBId: id2 } : { nodeAId: id2, nodeBId: id1 };
  }

  /**
   * 获取项目的所有角色关系
   */
  async listRelations(projectId: string) {
    try {
      const relations = await prisma.characterRelation.findMany({
        where: { projectId },
        include: {
          nodeA: {
            select: {
              id: true,
              name: true,
              images: true,
            },
          },
          nodeB: {
            select: {
              id: true,
              name: true,
              images: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return {
        success: true,
        data: relations,
      };
    } catch (error) {
      logger.error(`[RelationService] Failed to list relations: ${error}`);
      throw error;
    }
  }

  /**
   * 创建新的角色关系
   */
  async createRelation(projectId: string, data: CreateRelationData) {
    try {
      const { sourceId, targetId, type, weight, notes } = data;

      // 验证两个节点不相同
      if (sourceId === targetId) {
        throw new Error('Cannot create self-relation');
      }

      // 验证两个角色资产都存在且属于该项目
      const [nodeA, nodeB] = await Promise.all([
        prisma.characterAsset.findUnique({
          where: { id: sourceId },
        }),
        prisma.characterAsset.findUnique({
          where: { id: targetId },
        }),
      ]);

      if (!nodeA || nodeA.projectId !== projectId) {
        throw new Error(`Character asset ${sourceId} not found in project ${projectId}`);
      }

      if (!nodeB || nodeB.projectId !== projectId) {
        throw new Error(`Character asset ${targetId} not found in project ${projectId}`);
      }

      // 规范化节点 ID
      const { nodeAId, nodeBId } = this.normalizeNodeIds(sourceId, targetId);

      // 创建关系
      const relation = await prisma.characterRelation.create({
        data: {
          projectId,
          nodeAId,
          nodeBId,
          type: type || null,
          weight: weight !== undefined ? weight : null,
          notes: notes || null,
        },
        include: {
          nodeA: {
            select: {
              id: true,
              name: true,
              images: true,
            },
          },
          nodeB: {
            select: {
              id: true,
              name: true,
              images: true,
            },
          },
        },
      });

      logger.info(`[RelationService] Created relation: ${relation.id}`);
      return {
        success: true,
        data: relation,
      };
    } catch (error) {
      logger.error(`[RelationService] Failed to create relation: ${error}`);
      throw error;
    }
  }

  /**
   * 删除关系
   */
  async deleteRelation(relationId: string, projectId: string) {
    try {
      // 验证关系存在且属于该项目
      const existing = await prisma.characterRelation.findUnique({
        where: { id: relationId },
      });

      if (!existing) {
        throw new Error('Relation not found');
      }

      if (existing.projectId !== projectId) {
        throw new Error('Relation does not belong to this project');
      }

      // 删除关系
      await prisma.characterRelation.delete({
        where: { id: relationId },
      });

      logger.info(`[RelationService] Deleted relation: ${relationId}`);
      return {
        success: true,
      };
    } catch (error) {
      logger.error(`[RelationService] Failed to delete relation: ${error}`);
      throw error;
    }
  }
}

