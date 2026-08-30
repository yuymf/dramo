import { prisma } from '../lib/db';
import { startWorkflowRun } from '../lib/agentos-client';
import { unwrapWorkflowJson } from '../lib/workflow-json';
import { AppException, ErrorCode } from '../lib/errors';

export class InspirationService {
  async getInspirations(projectId: string, userId: string, category?: string) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new AppException(ErrorCode.NOT_FOUND, 'Project not found');
    }

    const inspirations = await prisma.inspiration.findMany({
      where: {
        OR: [{ projectId }, { projectId: null }],
        ...(category ? { category } : {}),
      },
      orderBy: [{ relevance: 'desc' }, { createdAt: 'desc' }],
      take: 20,
    });

    return { data: inspirations, projectId };
  }

  async recommendInspirations(
    projectId: string,
    userId: string,
    params?: {
      script?: unknown;
      position?: unknown;
      category?: string;
    },
    llmHeaders?: Record<string, string>
  ) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new AppException(ErrorCode.NOT_FOUND, 'Project not found');
    }

    const response = await startWorkflowRun('inspirationsworkflow', {
      projectId,
      script: params?.script,
      category: params?.category,
    }, { stream: false, llmHeaders });

    const parsed = unwrapWorkflowJson(await response.json());
    const items = Array.isArray(parsed.inspirations) ? parsed.inspirations : [];

    const stored = await Promise.all(
      items
        .filter((item): item is { text?: string; category?: string } => typeof item === 'object' && item !== null)
        .filter((item) => typeof item.text === 'string' && item.text.trim().length > 0)
        .map((insp) =>
          prisma.inspiration.create({
            data: {
              text: insp.text!.trim(),
              category: insp.category || params?.category || 'topics',
              projectId,
              userId,
              relevance: 0.8,
              source: 'ai',
            },
          })
        )
    );

    return {
      data: stored,
      projectId,
      context: {
        hasScript: !!params?.script,
        position: params?.position,
      },
    };
  }

  async toggleFavorite(inspirationId: string, _userId: string) {
    const inspiration = await prisma.inspiration.findUnique({
      where: { id: inspirationId },
    });

    if (!inspiration) {
      throw new AppException(ErrorCode.NOT_FOUND, 'Inspiration not found');
    }

    const updated = await prisma.inspiration.update({
      where: { id: inspirationId },
      data: { isFavorite: !inspiration.isFavorite },
    });

    return {
      inspirationId,
      isFavorite: updated.isFavorite,
    };
  }
}
