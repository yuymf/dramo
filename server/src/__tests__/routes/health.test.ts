import app from '../../app';

describe('Health route', () => {
  it('GET /api/v1/health returns 200', async () => {
    const req = new Request('http://localhost/api/v1/health');
    const res = await app.fetch(req);
    expect(res.status).toBe(200);
  });

  it('GET /api/health is not rewritten — returns 404', async () => {
    const req = new Request('http://localhost/api/health');
    const res = await app.fetch(req);
    expect(res.status).toBe(404);
  });

  it('CORS reflects Origin and allows credentials', async () => {
    const req = new Request('http://localhost/api/v1/health', {
      headers: { Origin: 'http://localhost:12323' },
    });
    const res = await app.fetch(req);
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:12323');
    expect(res.headers.get('access-control-allow-origin')).not.toBe('*');
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
  });

  it('GET /api/v1/projects without a session returns 401', async () => {
    const res = await app.fetch(new Request('http://localhost/api/v1/projects'));
    expect(res.status).toBe(401);
  });
});
