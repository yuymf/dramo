import { prisma } from '../lib/db';
import { AppException, ErrorCode } from '../lib/errors';
import { BillingService } from './billing.service';
import { getPlanLimits } from '../config/plan-limits';

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
    // Check plan limit
    const billingService = new BillingService();
    const sub = await billingService.getSubscription(userId);
    const limits = getPlanLimits(sub.planId);

    if (limits.projects !== null) {
      const currentCount = await prisma.project.count({ where: { userId } });
      if (currentCount >= limits.projects) {
        throw new AppException(
          ErrorCode.PLAN_LIMIT_EXCEEDED,
          `已达到${sub.planId === 'free' ? '免费版' : '当前计划'}项目数量上限（${limits.projects}个）`,
        );
      }
    }

    const project = await prisma.project.create({
      data: {
        ...data,
        userId,
      },
    });

    return project;
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

    await prisma.project.delete({
      where: { id },
    });
  }
}
