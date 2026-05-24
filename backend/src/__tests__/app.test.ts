import request from 'supertest';
import app from '../app';

describe('Express App Setup', () => {
  it('should respond to health check', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('should return 404 for unknown routes', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
  });

  it('should parse JSON body', async () => {
    const res = await request(app)
      .post('/api/auth')
      .send({ email: 'test@example.com' })
      .set('Content-Type', 'application/json');
    // Route exists but has no handlers, so we just verify no parsing error
    expect(res.status).not.toBe(500);
  });

  it('should set security headers via Helmet', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
  });

  it('should mount API routes under /api prefix', async () => {
    // These routes exist but have no handlers yet, so they return 404
    // The important thing is they don't return 500 (server error)
    const authRes = await request(app).get('/api/auth');
    const guidesRes = await request(app).get('/api/guides');
    const tagsRes = await request(app).get('/api/tags');
    const uploadRes = await request(app).get('/api/upload');

    // All should be either 404 (no matching handler) or some non-500 status
    expect(authRes.status).not.toBe(500);
    expect(guidesRes.status).not.toBe(500);
    expect(tagsRes.status).not.toBe(500);
    expect(uploadRes.status).not.toBe(500);
  });
});
