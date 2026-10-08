import { expect, test } from '../../src/fixtures';
import { ApiClient } from '../../src/support/apiClient';
import { attachJson } from '../../src/support/evidence';
import { startFixtureApp } from '../../src/support/fixtureApp';

/**
 * PROOF suite — kill matrix.
 *
 * Each case plants one realistic defect in the fixture app (via mutant
 * flags) and asserts the corresponding pillar suite WOULD go red: the
 * detection assertion is expected to throw, and the proof passes when it
 * does. A mutant nobody catches is a hole in the suite, not a green build.
 *
 * Mutants run in their own fixture instances — they never leak into the
 * other suites.
 */
function uniqueUser(prefix: string): string {
	return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

test.describe('kill matrix', () => {
	test('api pillar catches a write that is never persisted', async (// biome-ignore lint/correctness/noEmptyPattern: needs testInfo, no fixtures
	{}, testInfo) => {
		const app = await startFixtureApp({ mutants: ['skip-persist'] });
		try {
			const api = new ApiClient({ baseURL: `${app.url}/api` });
			const username = uniqueUser('km');
			const created = await api.post<{ id: number }>('/users', {
				username,
				password: 'longenough1',
			});
			expect(created.status).toBe(201);

			// The api pillar's contract: a created user must be fetchable.
			// Against the mutant this assertion fails — the suite goes red.
			await expect(async () => {
				const fetched = await api.get(`/users/${created.data.id}`);
				expect(fetched.status).toBe(200);
			}).rejects.toThrow();
			await attachJson(testInfo, 'kill-skip-persist', {
				mutant: 'skip-persist',
				caughtBy: 'api pillar: GET after POST must return 200',
			});
		} finally {
			await app.close();
		}
	});

	test('api pillar catches weakened password validation', async (// biome-ignore lint/correctness/noEmptyPattern: needs testInfo, no fixtures
	{}, testInfo) => {
		const app = await startFixtureApp({ mutants: ['weak-password'] });
		try {
			const api = new ApiClient({ baseURL: `${app.url}/api` });

			// The api pillar's contract: short passwords are rejected.
			await expect(async () => {
				const res = await api.post('/users', {
					username: uniqueUser('km'),
					password: 'x',
				});
				expect(res.status).toBe(400);
			}).rejects.toThrow();
			await attachJson(testInfo, 'kill-weak-password', {
				mutant: 'weak-password',
				caughtBy: 'api pillar: short password must return 400',
			});
		} finally {
			await app.close();
		}
	});

	test('e2e pillar catches a missing auth redirect', async ({
		page,
	}, testInfo) => {
		const app = await startFixtureApp({ mutants: ['no-auth-redirect'] });
		try {
			// Unauthenticated: /secure must bounce to /login.
			await expect(async () => {
				await page.goto(`${app.url}/secure`);
				await expect(page).toHaveURL(/\/login/);
			}).rejects.toThrow();
			await attachJson(testInfo, 'kill-no-auth-redirect', {
				mutant: 'no-auth-redirect',
				caughtBy: 'e2e pillar: unauthenticated /secure must redirect',
			});
		} finally {
			await app.close();
		}
	});

	test('sec pillar catches an unauthenticated delete', async (// biome-ignore lint/correctness/noEmptyPattern: needs testInfo, no fixtures
	{}, testInfo) => {
		// No mutant: the fixture app genuinely exposes DELETE without
		// auth. The sec expectation is 401/403 — the suite must flag it.
		const app = await startFixtureApp();
		try {
			const api = new ApiClient({ baseURL: `${app.url}/api` });
			const created = await api.post<{ id: number }>('/users', {
				username: uniqueUser('km'),
				password: 'longenough1',
			});
			expect(created.status).toBe(201);

			await expect(async () => {
				const deleted = await api.delete(`/users/${created.data.id}`);
				expect(deleted.status).toBe(401);
			}).rejects.toThrow();
			await attachJson(testInfo, 'kill-open-delete', {
				mutant: '(none — real fixture behavior)',
				caughtBy: 'sec pillar: unauthenticated DELETE must not return 204',
			});
		} finally {
			await app.close();
		}
	});
});
