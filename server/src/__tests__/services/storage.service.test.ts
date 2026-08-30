import { StorageService } from '../../services/storage.service';
import fs from 'fs/promises';
import path from 'path';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  arrayBuffer: async () => Buffer.from('fake-image-bytes'),
}) as unknown as typeof fetch;

describe('StorageService.uploadImageFromUrl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a public URL string', async () => {
    const svc = new StorageService();
    const result = await svc.uploadImageFromUrl('proj-1', 'http://example.com/img.png');
    expect(typeof result).toBe('string');
    expect(result).toContain('http');
    expect(fs.mkdir).toHaveBeenCalled();
    expect(fs.writeFile).toHaveBeenCalled();
  });

  it('stores file under the correct project directory', async () => {
    const svc = new StorageService();
    await svc.uploadImageFromUrl('my-project', 'http://example.com/photo.jpg');
    const mkdirCall = (fs.mkdir as jest.Mock).mock.calls[0][0] as string;
    expect(mkdirCall).toContain(path.join('projects', 'my-project'));
  });
});

describe('StorageService.uploadImageFromBase64', () => {
  const validBase64 = 'data:image/png;base64,iVBORw0KGgo=';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns {url, path}', async () => {
    const svc = new StorageService();
    const result = await svc.uploadImageFromBase64('proj-1', validBase64);
    expect(result).toHaveProperty('url');
    expect(result).toHaveProperty('path');
  });
});
