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
});
