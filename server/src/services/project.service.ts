import { prisma } from '../lib/db';
import { AppException, ErrorCode } from '../lib/errors';
import { buildEmptyDraftScript } from './script.service';

export class ProjectService {
  async listProjects(userId: string, page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          scripts: {
            select: { id: true, title: true, status: true },
            take: 1,
          },
        },
      }),
      prisma.project.count({ where }),
    ]);

    return {
      data: projects,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getProject(id: string, userId: string) {
    const project = await prisma.project.findFirst({
      where: { id, userId },
      include: {
        scripts: {
          select: { id: true, title: true, status: true, createdAt: true },
        },
      },
    });

    if (!project) {
      throw new AppException(ErrorCode.NOT_FOUND, 'Project not found');
    }

    return project;
  }

  async createProject(userId: string, data: { name: string; description?: string }) {
    return prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          ...data,
          userId,
        },
      });

      await tx.script.create({
        data: {
          projectId: project.id,
          ...buildEmptyDraftScript(data.name),
        },
      });

      return project;
    });
  }

  async updateProject(
    id: string,
    userId: string,
    data: { name?: string; description?: string }
  ) {
    const project = await prisma.project.findFirst({
      where: { id, userId },
    });

    if (!project) {
      throw new AppException(ErrorCode.NOT_FOUND, 'Project not found');
    }

    const updated = await prisma.project.update({
      where: { id },
      data,
    });

    return updated;
  }

  async deleteProject(id: string, userId: string) {
    const project = await prisma.project.findFirst({
      where: { id, userId },
    });

    if (!project) {
      throw new AppException(ErrorCode.NOT_FOUND, 'Project not found');
    }

    await prisma.$transaction([
      prisma.characterRelation.deleteMany({ where: { projectId: id } }),
      prisma.characterAsset.deleteMany({ where: { projectId: id } }),
      prisma.locationAsset.deleteMany({ where: { projectId: id } }),
      prisma.storyboardFrameImage.deleteMany({ where: { projectId: id } }),
      prisma.chatMessage.deleteMany({ where: { projectId: id } }),
      prisma.chatSession.deleteMany({ where: { projectId: id } }),
      prisma.generationJob.deleteMany({ where: { projectId: id } }),
      prisma.pipelineRun.deleteMany({ where: { projectId: id } }),
      prisma.inspiration.deleteMany({ where: { projectId: id } }),
      prisma.project.delete({ where: { id } }),
    ]);
  }
}
