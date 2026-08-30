import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../lib/db', () => ({
  prisma: {
    project: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    projectMember: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

import { prisma } from '../../lib/db';
import { ProjectService } from '../../services/project.service';
import { EMPTY_COVER } from '../../types/screenplay';
import { AppException, ErrorCode } from '../../lib/errors';

// jest.Mock defaults to never for mockResolvedValue; keep tests untyped here.
const mocked = (fn: unknown) => fn as any; // eslint-disable-line @typescript-eslint/no-explicit-any

describe('ProjectService', () => {
  const service = new ProjectService();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists projects the user belongs to via ProjectMember', async () => {
    mocked(prisma.project.findMany).mockResolvedValue([]);
    mocked(prisma.project.count).mockResolvedValue(0);

    await service.listProjects('user-1');

    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { members: { some: { userId: 'user-1' } } },
      })
    );
    const arg = mocked(prisma.project.findMany).mock.calls[0][0] as { where: Record<string, unknown> };
    expect(arg.where).not.toHaveProperty('userId');
  });

  it('createProject defaults script/hollywood and seeds episode + empty screenplay', async () => {
    const created = { id: 'p1', name: '第一本', type: 'script', format: 'hollywood' };
    const tx = {
      project: {
        create: (jest.fn() as any).mockResolvedValue(created), // eslint-disable-line @typescript-eslint/no-explicit-any
      },
    };
    mocked(prisma.$transaction).mockImplementation(async (fn: unknown) => (fn as (t: typeof tx) => unknown)(tx));

    const result = await service.createProject('user-1', { name: '第一本' });
    expect(result).toEqual(created);
    expect(tx.project.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: '第一本',
          type: 'script',
          format: 'hollywood',
          members: { create: { userId: 'user-1', role: 'OWNER' } },
          episodes: {
            create: expect.objectContaining({
              name: '第 1 集',
              sortOrder: 0,
              screenplay: {
                create: {
                  title: '第一本',
                  cover: EMPTY_COVER,
                  nodes: [],
                },
              },
            }),
          },
        }),
      })
    );
  });

  it('getProject 404s when the user is not a member', async () => {
    mocked(prisma.projectMember.findUnique).mockResolvedValue(null);
    await expect(service.getProject('p1', 'user-1')).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND,
    });
    expect(prisma.project.findUnique).not.toHaveBeenCalled();
  });

  it('updateProject forbids viewers', async () => {
    mocked(prisma.projectMember.findUnique).mockResolvedValue({
      role: 'VIEWER',
    });
    await expect(service.updateProject('p1', 'user-1', { name: 'x' })).rejects.toBeInstanceOf(AppException);
    await expect(service.updateProject('p1', 'user-1', { name: 'x' })).rejects.toMatchObject({
      code: ErrorCode.FORBIDDEN,
    });
  });
});
