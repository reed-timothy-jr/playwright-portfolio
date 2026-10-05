import { test, expect } from '../../src/fixtures';

interface User {
  id: number;
  name: string;
  email: string;
}

interface Post {
  id: number;
  userId: number;
  title: string;
  body: string;
}

/**
 * API suite — contract-level checks against a stable public API.
 * Point API_BASE_URL at your own API; the assertion patterns transfer.
 */
test.describe('users api', () => {
  test('GET /users returns a typed user list', async ({ api }) => {
    const res = await api.get<User[]>('/users');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data.length).toBeGreaterThan(0);
    expect(res.data[0]).toMatchObject({ id: expect.any(Number), email: expect.any(String) });
  });

  test('POST /posts creates a resource', async ({ api }) => {
    const res = await api.post<Post>('/posts', { title: 'powerbase', body: 'heals and stress-tests', userId: 1 });
    expect(res.status).toBe(201);
    expect(res.data.title).toBe('powerbase');
    expect(res.data.id).toEqual(expect.any(Number));
  });

  test('GET /users/999 returns 404, not a 200 with garbage', async ({ api }) => {
    const res = await api.get('/users/999');
    expect(res.status).toBe(404);
  });
});
