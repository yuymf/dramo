import app from '../../app';

describe('Health route', () => {
  it('GET /api/v1/health returns 200', async () => {
    const req = new Request('http://localhost/api/v1/health');
    const res = await app.fetch(req);
    expect(res.status).toBe(200);
  });

  it('GET /api/health redirects to /api/v1/health with 301', async () => {
    const req = new Request('http://localhost/api/health');
    const res = await app.fetch(req);
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toContain('/api/v1/health');
  });
});
