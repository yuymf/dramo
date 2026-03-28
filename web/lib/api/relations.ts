import { api } from './client';

export interface CharacterRelation {
  id: string;
  projectId: string;
  nodeAId: string;
  nodeBId: string;
  type?: string;
  weight?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  nodeA: {
    id: string;
    name: string;
    images: Array<{ id: string; url: string; [key: string]: unknown }>;
  };
  nodeB: {
    id: string;
    name: string;
    images: Array<{ id: string; url: string; [key: string]: unknown }>;
  };
}

export interface CreateRelationData {
  sourceId: string;
  targetId: string;
  type?: string;
  weight?: number;
  notes?: string;
}

export interface UpdateRelationData {
  type?: string;
  weight?: number;
  notes?: string;
}

/**
 * 获取项目的所有角色关系
 */
export async function listRelations(projectId: string) {
  return api<{ success: boolean; data: CharacterRelation[] }>(
    `/api/projects/${projectId}/characters/relations`,
    { noCache: true }
  );
}

/**
 * 创建新的角色关系
 */
export async function createRelation(projectId: string, data: CreateRelationData) {
  return api<{ success: boolean; data: CharacterRelation }>(
    `/api/projects/${projectId}/characters/relations`,
    {
      method: 'POST',
      body: data,
      noCache: true,
    }
  );
}

/**
 * 更新关系信息
 */
export async function updateRelation(
  projectId: string,
  relationId: string,
  data: UpdateRelationData
) {
  return api<{ success: boolean; data: CharacterRelation }>(
    `/api/projects/${projectId}/characters/relations/${relationId}`,
    {
      method: 'PATCH',
      body: data,
      noCache: true,
    }
  );
}

/**
 * 删除关系
 */
export async function deleteRelation(projectId: string, relationId: string) {
  return api<{ success: boolean }>(
    `/api/projects/${projectId}/characters/relations/${relationId}`,
    {
      method: 'DELETE',
      noCache: true,
    }
  );
}

/**
 * 清理孤儿关系（守护端点）
 */
export async function cleanupOrphanRelations(projectId: string) {
  return api<{ success: boolean; cleaned: number }>(
    `/api/projects/${projectId}/characters/relations/cleanup`,
    {
      method: 'POST',
      noCache: true,
    }
  );
}

