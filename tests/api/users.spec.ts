import { z } from 'zod';
import { expect, test } from '../../src/fixtures';

const UserSchema = z.object({
	id: z.number(),
	name: z.string(),
	email: z.string().email(),
});

interface Post {
	id: number;
	userId: number;
	title: string;
	body: string;
}

/**
 * API suite — contract-level checks against a stable public API.
 * Point API_BASE_URL at your own API; the assertion patterns transfer.
 * Zod schemas validate response contracts, not just status codes.
 */
test.describe('users api', () => {
	test('GET /users returns a contract-valid user list', async ({ api }) => {
		const res = await api.get<unknown>('/users');
		expect(res.status).toBe(200);
		expect(res.headers['content-type']).toContain('application/json');

		const parsed = z.array(UserSchema).safeParse(res.data);
		expect(parsed.success).toBe(true);
		if (parsed.success) {
			expect(parsed.data.length).toBeGreaterThan(0);
		}
	});

	test('POST /posts creates a resource', async ({ api }) => {
		const res = await api.post<Post>('/posts', {
			title: 'powerbase',
			body: 'heals and stress-tests',
			userId: 1,
		});
		expect(res.status).toBe(201);
		expect(res.data.title).toBe('powerbase');
		expect(res.data.id).toEqual(expect.any(Number));
	});

	test('GET /users/999 returns 404, not a 200 with garbage', async ({
		api,
	}) => {
		const res = await api.get('/users/999');
		expect(res.status).toBe(404);
	});

	test('unknown userId returns an empty array, not an error', async ({
		api,
	}) => {
		const res = await api.get<unknown[]>('/posts?userId=999999');
		expect(res.status).toBe(200);
		expect(res.data).toEqual([]);
	});
});
