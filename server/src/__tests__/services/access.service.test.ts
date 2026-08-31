import { describe, expect, it, jest, beforeEach } from '@jest/globals';

jest.mock('../../lib/db', () => ({
  prisma: {
    project: { findUnique: jest.fn() },
    projectMember: { findUnique: jest.fn() },
  },
}));

import { prisma } from '../../lib/db';
import { resolveAccess } from '../../services/access.service';
import { ErrorCode } from '../../lib/errors';

const mocked = (fn: unknown) => fn as any; // eslint-disable-line @typescript-eslint/no-explicit-any

describe('resolveAccess', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lets anyone_view read but not write', async () => {
    mocked(prisma.project.findUnique).mockResolvedValue({
      id: 'p1',
      type: 'script',
      format: 'hollywood',
      shareMode: 'anyone_view',
      shareToken: 't',
      published: false,
      allowCopy: true,
    });
    mocked(prisma.projectMember.findUnique).mockResolvedValue(null);
    const access = await resolveAccess('p1', 'u2');
    expect(access.role).toBe('VIEWER');
    expect(access.via).toBe('share');
    await expect(resolveAccess('p1', 'u2', { write: true })).rejects.toMatchObject({
      code: ErrorCode.FORBIDDEN,
    });
  });

  it('lets anyone_edit write without membership', async () => {
    mocked(prisma.project.findUnique).mockResolvedValue({
      id: 'p1',
      type: 'script',
      format: 'hollywood',
      shareMode: 'anyone_edit',
      shareToken: 't',
      published: false,
      allowCopy: true,
    });
    mocked(prisma.projectMember.findUnique).mockResolvedValue(null);
    const access = await resolveAccess('p1', 'u2', { write: true });
    expect(access.role).toBe('EDITOR');
  });
});
