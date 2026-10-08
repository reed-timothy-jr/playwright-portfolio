import { z } from 'zod';
import { expect, test } from '../../src/fixtures';

const UserSchema = z.object({
	id: z.number(),
	username: z.string(),
});

const ErrorSchema = z.object({ error: z.string() });

/**
 * API pillar — contract-level checks against the bundled fixture app's
 * JSON API (no browser, no network). Zod schemas validate response
 * contracts, not just status codes.
 *
 * Point API_BASE_URL at your own API to run these against a real
 * backend; the assertion patterns transfer unchanged.
 *
 * Parallel-safe: every created user carries a unique name and is
 * deleted in cleanup.
 */
function uniqueUser(prefix: string): string {
	return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

test.describe('users api', () => {
	test('POST /users creates a contract-valid user', async ({ api }) => {
		const username = uniqueUser('api');
		const res = await api.post<unknown>('/users', {
			username,
			password: 'longenough1',
		});
		expect(res.status).toBe(201);
		expect(res.headers['content-type']).toContain('application/json');

		const parsed = UserSchema.safeParse(res.data);
		expect(parsed.success).toBe(true);
		if (!parsed.success) return;
		expect(parsed.data.username).toBe(username);

		// Cleanup: delete only the record this test owns.
		const deleted = await api.delete(`/users/${parsed.data.id}`);
		expect(deleted.status).toBe(204);
	});

	test('POST /users rejects a duplicate username with 409', async ({ api }) => {
		const username = uniqueUser('api');
		const first = await api.post<unknown>('/users', {
			username,
			password: 'longenough1',
		});
		expect(first.status).toBe(201);
		try {
			const dup = await api.post<unknown>('/users', {
				username,
				password: 'longenough1',
			});
			expect(dup.status).toBe(409);
			const parsed = ErrorSchema.safeParse(dup.data);
			expect(parsed.success).toBe(true);
		} finally {
			const id = (first.data as { id: number }).id;
			await api.delete(`/users/${id}`);
		}
	});

	test('POST /users validates its inputs with 400s', async ({ api }) => {
		const shortName = await api.post<unknown>('/users', {
			username: 'ab',
			password: 'longenough1',
		});
		expect(shortName.status).toBe(400);

		const shortPass = await api.post<unknown>('/users', {
			username: uniqueUser('api'),
			password: 'short',
		});
		expect(shortPass.status).toBe(400);

		const garbage = await api.post<unknown>('/users', { nope: true });
		expect(garbage.status).toBe(400);
	});

	test('GET /users/:id round-trips a created user', async ({ api }) => {
		const username = uniqueUser('api');
		const created = await api.post<{ id: number }>('/users', {
			username,
			password: 'longenough1',
		});
		expect(created.status).toBe(201);
		try {
			const fetched = await api.get<unknown>(`/users/${created.data.id}`);
			expect(fetched.status).toBe(200);
			const parsed = UserSchema.safeParse(fetched.data);
			expect(parsed.success).toBe(true);
			if (parsed.success) {
				expect(parsed.data.username).toBe(username);
			}
		} finally {
			await api.delete(`/users/${created.data.id}`);
		}
	});

	test('GET /users/:id returns 404 for a missing user', async ({ api }) => {
		const res = await api.get<unknown>('/users/999999');
		expect(res.status).toBe(404);
		const parsed = ErrorSchema.safeParse(res.data);
		expect(parsed.success).toBe(true);
	});

	test('DELETE /users/:id removes the user, then 404s', async ({ api }) => {
		const created = await api.post<{ id: number }>('/users', {
			username: uniqueUser('api'),
			password: 'longenough1',
		});
		expect(created.status).toBe(201);

		const deleted = await api.delete(`/users/${created.data.id}`);
		expect(deleted.status).toBe(204);

		const gone = await api.get(`/users/${created.data.id}`);
		expect(gone.status).toBe(404);

		const missing = await api.delete('/users/999999');
		expect(missing.status).toBe(404);
	});
});
