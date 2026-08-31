import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { FILM_DURATION_SEC } from '../types/cinema';

export const NO_VIDEO_ENCODER_MESSAGE = '没有可用的视频编码器';

const ASPECT_PIXELS: Record<string, { width: number; height: number }> = {
  '16:9': { width: 1280, height: 720 },
  '9:16': { width: 720, height: 1280 },
  '2.39:1': { width: 1280, height: 536 },
  '4:3': { width: 960, height: 720 },
};

export function filmPixelSize(aspectRatio?: string): { width: number; height: number } {
  return ASPECT_PIXELS[aspectRatio ?? ''] ?? ASPECT_PIXELS['16:9'];
}

export async function resolveFfmpegBin(): Promise<string> {
  const candidates = [process.env.FFMPEG_PATH, 'ffmpeg'].filter(Boolean) as string[];
  for (const bin of candidates) {
    try {
      await runCommand(bin, ['-version']);
      return bin;
    } catch {
      // try next
    }
  }
  throw new Error(NO_VIDEO_ENCODER_MESSAGE);
}

export async function encodeFifteenSecondFilm(input: {
  imagePaths: string[];
  outputPath: string;
  lastFramePath: string;
  aspectRatio?: string;
}): Promise<void> {
  if (input.imagePaths.length === 0) {
    throw new Error('没有分镜图不能出成片');
  }
  for (const imagePath of input.imagePaths) {
    await access(imagePath, fsConstants.R_OK);
  }

  const ffmpeg = await resolveFfmpegBin();
  const size = filmPixelSize(input.aspectRatio);
  const perImage = FILM_DURATION_SEC / input.imagePaths.length;
  const listPath = `${input.outputPath}.concat.txt`;
  const lines: string[] = [];
  for (const imagePath of input.imagePaths) {
    lines.push(`file '${escapeConcatPath(imagePath)}'`);
    lines.push(`duration ${perImage.toFixed(4)}`);
  }
  lines.push(`file '${escapeConcatPath(input.imagePaths[input.imagePaths.length - 1])}'`);
  await writeFile(listPath, `${lines.join('\n')}\n`, 'utf8');

  await runCommand(ffmpeg, [
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    listPath,
    '-vf',
    `scale=${size.width}:${size.height}:force_original_aspect_ratio=decrease,pad=${size.width}:${size.height}:(ow-iw)/2:(oh-ih)/2,fps=24,format=yuv420p`,
    '-t',
    String(FILM_DURATION_SEC),
    '-movflags',
    '+faststart',
    input.outputPath,
  ]);

  await runCommand(ffmpeg, [
    '-y',
    '-sseof',
    '-0.1',
    '-i',
    input.outputPath,
    '-frames:v',
    '1',
    input.lastFramePath,
  ]);
}

function escapeConcatPath(filePath: string): string {
  return path.resolve(filePath).replace(/'/g, "'\\''");
}

function runCommand(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(new Error(NO_VIDEO_ENCODER_MESSAGE));
        return;
      }
      reject(err);
    });
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `${bin} exited ${code}`));
    });
  });
}
