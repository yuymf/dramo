import { StorageService } from '../../services/storage.service';

// Use subclass trick to expose protected upload methods
class TestableStorageService extends StorageService {
  public uploadToLocalSpy = jest.fn().mockResolvedValue({ url: 'http://local/img.png', path: 'local/img.png' });
  public uploadToSupabaseSpy = jest.fn().mockResolvedValue({ url: 'https://cdn/img.png', path: 'bucket/img.png' });

  protected async uploadToLocal(projectId: string, filename: string, buffer: Buffer) {
    return this.uploadToLocalSpy(projectId, filename, buffer);
  }
  protected async uploadToSupabase(projectId: string, filename: string, buffer: Buffer) {
    return this.uploadToSupabaseSpy(projectId, filename, buffer);
  }
}

// Stub fetch globally
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  arrayBuffer: async () => Buffer.from('fake-image-bytes'),
}) as unknown as typeof fetch;

describe('StorageService.uploadImageFromUrl', () => {
  it('returns URL string when detailed is false (default)', async () => {
    const svc = new TestableStorageService();
    const result = await svc.uploadImageFromUrl('proj-1', 'http://example.com/img.png');
    expect(typeof result).toBe('string');
    expect(result).toContain('http');
  });

  it('returns {url, path} object when detailed is true', async () => {
    const svc = new TestableStorageService();
    const result = await svc.uploadImageFromUrl('proj-1', 'http://example.com/img.png', { detailed: true });
    expect(result).toHaveProperty('url');
    expect(result).toHaveProperty('path');
  });
});

describe('StorageService.uploadImageFromBase64', () => {
  const validBase64 = 'data:image/png;base64,iVBORw0KGgo=';

  it('returns URL string when detailed is false (default)', async () => {
    const svc = new TestableStorageService();
    const result = await svc.uploadImageFromBase64('proj-1', validBase64);
    expect(typeof result).toBe('string');
  });

  it('returns {url, path} object when detailed is true', async () => {
    const svc = new TestableStorageService();
    const result = await svc.uploadImageFromBase64('proj-1', validBase64, { detailed: true });
    expect(result).toHaveProperty('url');
    expect(result).toHaveProperty('path');
  });
});
