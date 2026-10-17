import { expect, test } from '../../src/fixtures';

/**
 * API pillar — BOUNDARY VALUE ANALYSIS (ISTQB CTFL Ch. 4), applied to
 * the fixture API's two length rules:
 *
 *   username: at least 3 characters   -> boundary values 2 | 3 | 4
 *   password: at least 8 characters   -> boundary values 7 | 8 | 9
 *
 * ISTQB convention: 2-value BVA tests the boundary and its invalid
 * neighbor ({2, 3} and {7, 8}); 3-value adds the valid neighbor
 * ({2, 3, 4} and {7, 8, 9}). These specs run the 3-value set.
 *
 * Why these rows matter beyond technique points: the proof suite's
 * 'weak-password' mutant disables the password-length rule. Under that
 * mutant the 7-character row below stops returning 400 and this spec
 * turns red — BVA is the technique that kills that mutant.
 *
 * Parallel-safe: valid rows create uniquely-named users and delete
 * them; invalid rows create nothing.
 */
function uniqueUser(prefix: string): string {
	return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const VALID_PASSWORD = 'longenough1';

test.describe('users api — username boundary (min 3)', () => {
	test('2 characters is rejected with 400', async ({ api }) => {
		const res = await api.post<unknown>('/users', {
			username: 'ab',
			password: VALID_PASSWORD,
		});
		expect(res.status).toBe(400);
	});

	test('3 characters (the boundary) is accepted with 201', async ({ api }) => {
		// A unique 3-character username: last 3 chars of a base-36 stamp.
		const username = Date.now().toString(36).slice(-3);
		const res = await api.post<{ id: number }>('/users', {
			username,
			password: VALID_PASSWORD,
		});
		expect(res.status).toBe(201);
		const deleted = await api.delete(`/users/${res.data.id}`);
		expect(deleted.status).toBe(204);
	});

	test('4 characters (valid neighbor) is accepted with 201', async ({
		api,
	}) => {
		const username = `u${Date.now().toString(36).slice(-3)}`;
		expect(username).toHaveLength(4);
		const res = await api.post<{ id: number }>('/users', {
			username,
			password: VALID_PASSWORD,
		});
		expect(res.status).toBe(201);
		const deleted = await api.delete(`/users/${res.data.id}`);
		expect(deleted.status).toBe(204);
	});
});

test.describe('users api — password boundary (min 8)', () => {
	for (const len of [7, 8, 9]) {
		test(`password of ${len} characters returns ${len < 8 ? 400 : 201}`, async ({
			api,
		}) => {
			const res = await api.post<{ id: number }>('/users', {
				username: uniqueUser('bva'),
				password: 'x'.repeat(len),
			});
			expect(res.status).toBe(len < 8 ? 400 : 201);
			if (res.status === 201) {
				const deleted = await api.delete(`/users/${res.data.id}`);
				expect(deleted.status).toBe(204);
			}
		});
	}
});
