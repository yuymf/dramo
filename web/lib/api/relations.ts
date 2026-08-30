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


