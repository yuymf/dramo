import { mkdtemp, writeFile, unlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, expect, it } from '@jest/globals';
import { encodeFifteenSecondFilm, filmPixelSize } from '../../services/cinema-video.service';
import { FILM_DURATION_SEC } from '../../types/cinema';

const execFileAsync = promisify(execFile);

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

describe('filmPixelSize', () => {
  it('keeps even dimensions for yuv420p', () => {
    const size = filmPixelSize('2.39:1');
    expect(size.width % 2).toBe(0);
    expect(size.height % 2).toBe(0);
  });
});

describe('encodeFifteenSecondFilm', () => {
  it('writes a 15 second mp4 and a last frame', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'cinema-film-'));
    const img1 = path.join(dir, 'a.png');
    const img2 = path.join(dir, 'b.png');
    const out = path.join(dir, 'out.mp4');
    const last = path.join(dir, 'last.png');
    await writeFile(img1, TINY_PNG);
    await writeFile(img2, TINY_PNG);

    await encodeFifteenSecondFilm({
      imagePaths: [img1, img2],
      outputPath: out,
      lastFramePath: last,
      aspectRatio: '16:9',
    });

    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      out,
    ]);
    const duration = Number.parseFloat(stdout.trim());
    expect(duration).toBeGreaterThan(14);
    expect(duration).toBeLessThan(16.5);
    expect(FILM_DURATION_SEC).toBe(15);

    const { stdout: pngHead } = await execFileAsync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'stream=codec_name',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      last,
    ]);
    expect(pngHead).toMatch(/png|mjpeg/);

    await unlink(out).catch(() => undefined);
  }, 30_000);
});
