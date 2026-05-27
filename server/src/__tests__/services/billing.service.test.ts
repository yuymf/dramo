import { BillingService } from '../../services/billing.service';
import { prisma } from '../../lib/db';

jest.mock('../../lib/db', () => ({
  prisma: {
    subscription: { findUnique: jest.fn() },
    project: { count: jest.fn(), findMany: jest.fn() },
    characterAsset: { count: jest.fn() },
    usageRecord: { findUnique: jest.fn() },
  },
}));

describe('BillingService.getUsage', () => {
  const svc = new BillingService();
  const userId = 'user-123';

  beforeEach(() => jest.clearAllMocks());

  it('returns 0 AI generations when UsageRecord is missing', async () => {
    (prisma.subscription.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.project.count as jest.Mock).mockResolvedValue(0);
    (prisma.project.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.characterAsset.count as jest.Mock).mockResolvedValue(0);
    (prisma.usageRecord.findUnique as jest.Mock).mockResolvedValue(null);

    const usage = await svc.getUsage(userId);

    expect(usage.aiGenerations.used).toBe(0);
    expect(prisma.usageRecord.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_month_type: expect.objectContaining({ userId }) },
      })
    );
  });

  it('returns actual AI generation count from UsageRecord', async () => {
    (prisma.subscription.findUnique as jest.Mock).mockResolvedValue({ planId: 'free' });
    (prisma.project.count as jest.Mock).mockResolvedValue(1);
    (prisma.project.findMany as jest.Mock).mockResolvedValue([{ id: 'proj-1' }]);
    (prisma.characterAsset.count as jest.Mock).mockResolvedValue(2);
    (prisma.usageRecord.findUnique as jest.Mock).mockResolvedValue({ count: 7 });

    const usage = await svc.getUsage(userId);

    expect(usage.aiGenerations.used).toBe(7);
  });
});
