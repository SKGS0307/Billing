import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';

describe('API foundation', () => {
  const app = createApp();

  it('uses the standard validation error envelope', async () => {
    const response = await request(app).post('/api/auth/login').send({ email: 'not-an-email', password: 'short' });
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects malformed JSON without treating it as a server failure', async () => {
    const response = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_JSON');
  });

  it('protects user administration', async () => {
    const response = await request(app).get('/api/users');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
  });

  it('returns a stable not-found response', async () => {
    const response = await request(app).get('/api/unknown');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('rejects cross-origin mutations before processing credentials', async () => {
    const response = await request(app).post('/api/auth/login').set('Origin', 'https://attacker.example').send({ email: 'user@example.com', password: 'long-enough-password' });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('INVALID_ORIGIN');
  });

  it('marks API responses as non-cacheable and sends security headers', async () => {
    const response = await request(app).get('/api/unknown');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
  });
});
