import { describe, expect, it, jest, beforeEach } from '@jest/globals';

jest.mock('../../lib/db', () => ({
  prisma: {
    project: { findUnique: jest.fn() },
    reel: { findFirst: jest.fn(), update: jest.fn() },
    episode: { findFirst: jest.fn() },
    generationTask: { create: jest.fn(), update: jest.fn() },
    character: { upsert: jest.fn() },
    prop: { upsert: jest.fn() },
  },
}));

jest.mock('../../services/screenplay.service', () => ({
  ScreenplayService: jest.fn().mockImplementation(() => ({
    requireAccess: (jest.fn() as any).mockResolvedValue({}), // eslint-disable-line @typescript-eslint/no-explicit-any
  })),
}));

jest.mock('../../services/job-runner.service', () => ({
  resolveTxt2ImgSize: () => ({ width: 512, height: 512 }),
}));

jest.mock('../../services/sd-pool.service', () => ({
  getSdPool: () => ({
    pickWorker: (jest.fn() as any).mockResolvedValue(null), // eslint-disable-line @typescript-eslint/no-explicit-any
    release: jest.fn(),
  }),
  NO_SD_WORKER_MESSAGE: '没有可用的 Stable Diffusion worker',
  SD_DEFAULT_STEPS: 20,
}));

import { prisma } from '../../lib/db';
import { CinemaService } from '../../services/cinema.service';
import { NO_IMAGES_MESSAGE, NO_PERFORMANCE_MESSAGE, NO_SHOTS_MESSAGE, NOT_CINEMA_MESSAGE } from '../../types/cinema';

const mocked = (fn: unknown) => fn as any; // eslint-disable-line @typescript-eslint/no-explicit-any

describe('CinemaService gates', () => {
  const service = new CinemaService();

  beforeEach(() => {
    jest.clearAllMocks();
    mocked(prisma.project.findUnique).mockResolvedValue({
      id: 'p1',
      type: 'cinema',
      cinemaSettings: {},
    });
  });

  it('rejects cinema APIs on a script project', async () => {
    mocked(prisma.project.findUnique).mockResolvedValue({ id: 'p1', type: 'script', cinemaSettings: {} });
    await expect(service.listReels('p1', 'e1', 'u1')).rejects.toMatchObject({ message: NOT_CINEMA_MESSAGE });
  });

  it('refuses storyboard without performance', async () => {
    mocked(prisma.reel.findFirst).mockResolvedValue({
      id: 'r1',
      episodeId: 'e1',
      performance: '',
      shots: [],
      images: [],
      films: [],
    });
    await expect(service.generateStoryboard('p1', 'r1', 'u1')).rejects.toMatchObject({
      message: NO_PERFORMANCE_MESSAGE,
    });
  });

  it('refuses images without shots', async () => {
    mocked(prisma.reel.findFirst).mockResolvedValue({
      id: 'r1',
      episodeId: 'e1',
      performance: '@林晚 「走」',
      shots: [],
      images: [],
      films: [],
    });
    await expect(service.generateImages('p1', 'r1', 'u1')).rejects.toMatchObject({
      message: NO_SHOTS_MESSAGE,
    });
  });

  it('refuses film without images', async () => {
    mocked(prisma.reel.findFirst).mockResolvedValue({
      id: 'r1',
      episodeId: 'e1',
      performance: '@林晚 「走」',
      shots: [{ id: 's1', description: '走', camera: '近景' }],
      images: [],
      films: [],
    });
    await expect(service.generateFilm('p1', 'r1', 'u1')).rejects.toMatchObject({
      message: NO_IMAGES_MESSAGE,
    });
  });
});
