import { prisma } from '../lib/db';
import { postAgentOS } from '../lib/agentos-client';
import { AppException, ErrorCode } from '../lib/errors';

export class InspirationService {
  async getInspirations(projectId: string, userId: string, category?: string) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new AppException(ErrorCode.NOT_FOUND, 'Project not found');
    }

    const where: any = {
      OR: [{ projectId }, { projectId: null }],
    };

    if (category) {
      where.category = category;
    }

    const inspirations = await prisma.inspiration.findMany({
      where,
      orderBy: [{ relevance: 'desc' }, { createdAt: 'desc' }],
      take: 20,
    });

    return { data: inspirations, projectId };
  }

  async recommendInspirations(
    projectId: string,
    userId: string,
    params?: {
      script?: any;
      position?: any;
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

    // Generate AI recommendations via AgentOS
    const aiInspirations = await postAgentOS<
      Array<{ text: string; category?: string }>
    >('/agentos/generate_inspirations', {
      projectId,
      script: params?.script,
      category: params?.category,
    }, { llmHeaders });

    // Store in database
    const stored = await Promise.all(
      aiInspirations.map((insp) =>
        prisma.inspiration.create({
          data: {
            text: insp.text,
            category: insp.category || 'topics',
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
      data: {
        isFavorite: !inspiration.isFavorite,
      },
    });

    return {
      inspirationId,
      isFavorite: updated.isFavorite,
    };
  }

  async getFavorites(userId: string) {
    const inspirations = await prisma.inspiration.findMany({
      where: { userId, isFavorite: true },
      orderBy: { createdAt: 'desc' },
    });

    return { data: inspirations };
  }
}
