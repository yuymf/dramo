import { Prisma, type MemberRole, type ProjectType, type ScreenplayFormat } from '@prisma/client';
import { prisma } from '../lib/db';
import { AppException, ErrorCode } from '../lib/errors';
import { EMPTY_COVER } from '../types/screenplay';
import { DEFAULT_CINEMA_SETTINGS, normalizeCinemaSettings, type CinemaSettings } from '../types/cinema';

const PROJECT_TYPES: ProjectType[] = ['script', 'cinema', 'spoken'];
const SCREENPLAY_FORMATS: ScreenplayFormat[] = ['hollywood', 'asian'];

const WRITE_ROLES: MemberRole[] = ['OWNER', 'ADMIN', 'EDITOR'];

export class ProjectService {
  private async requireMember(projectId: string, userId: string, roles?: MemberRole[]) {
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });

    if (!member) {
      throw new AppException(ErrorCode.NOT_FOUND, 'Project not found');
    }

    if (roles && !roles.includes(member.role)) {
      throw new AppException(ErrorCode.FORBIDDEN, '没有权限');
    }

    return member;
  }

  async listProjects(userId: string, page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;

    const where = {
      members: { some: { userId } },
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { description: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          description: true,
          type: true,
          format: true,
          createdAt: true,
          updatedAt: true,
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
    await this.requireMember(id, userId);

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        episodes: { orderBy: { sortOrder: 'asc' } },
        members: {
          include: {
            user: { select: { id: true, email: true, name: true } },
          },
        },
      },
    });

    if (!project) {
      throw new AppException(ErrorCode.NOT_FOUND, 'Project not found');
    }

    return project;
  }

  async createProject(
    userId: string,
    data: {
      name: string;
      type?: ProjectType;
      format?: ScreenplayFormat;
      description?: string;
      cinemaSettings?: CinemaSettings;
    }
  ) {
    const type = data.type ?? 'script';
    const format = data.format ?? 'hollywood';

    if (!PROJECT_TYPES.includes(type)) {
      throw new AppException(ErrorCode.INVALID_INPUT, '无效的项目类型');
    }
    if (!SCREENPLAY_FORMATS.includes(format)) {
      throw new AppException(ErrorCode.INVALID_INPUT, '无效的剧本格式');
    }

    const cinemaSettings =
      type === 'cinema'
        ? normalizeCinemaSettings(data.cinemaSettings ?? DEFAULT_CINEMA_SETTINGS)
        : DEFAULT_CINEMA_SETTINGS;

    return prisma.$transaction(async (tx) => {
      return tx.project.create({
        data: {
          name: data.name,
          description: data.description,
          type,
          format,
          cinemaSettings: cinemaSettings as unknown as Prisma.InputJsonValue,
          members: {
            create: { userId, role: 'OWNER' },
          },
          episodes: {
            create:
              type === 'cinema'
                ? {
                    name: '第 1 集',
                    sortOrder: 0,
                    reels: {
                      create: { name: 'Reel 1', sortOrder: 0 },
                    },
                  }
                : {
                    name: '第 1 集',
                    sortOrder: 0,
                    screenplay: {
                      create: {
                        title: data.name,
                        cover: EMPTY_COVER as unknown as Prisma.InputJsonValue,
                        nodes: [] as Prisma.InputJsonArray,
                      },
                    },
                  },
          },
        },
        include: {
          episodes: { include: { screenplay: true, reels: true } },
          members: true,
        },
      });
    });
  }

  async updateProject(
    id: string,
    userId: string,
    data: { name?: string; format?: ScreenplayFormat; cinemaSettings?: CinemaSettings }
  ) {
    await this.requireMember(id, userId, WRITE_ROLES);

    if (data.format && !SCREENPLAY_FORMATS.includes(data.format)) {
      throw new AppException(ErrorCode.INVALID_INPUT, '无效的剧本格式');
    }

    return prisma.project.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.format !== undefined ? { format: data.format } : {}),
        ...(data.cinemaSettings !== undefined
          ? { cinemaSettings: normalizeCinemaSettings(data.cinemaSettings) as unknown as Prisma.InputJsonValue }
          : {}),
      },
    });
  }

  async deleteProject(id: string, userId: string) {
    await this.requireMember(id, userId, ['OWNER']);
    await prisma.project.delete({ where: { id } });
  }
}
