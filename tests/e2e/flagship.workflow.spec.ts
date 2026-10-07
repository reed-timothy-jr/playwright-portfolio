import { z } from 'zod';
import { expect, test } from '../../src/fixtures';
import { LoginPage } from '../../src/pages/login.page';
import { ApiClient } from '../../src/support/apiClient';
import type { PGliteDatabase } from '../../src/support/db';
import { attachJson, attachScreenshot } from '../../src/support/evidence';

/**
 * FLAGSHIP workflow — the one scenario that demonstrates the whole
 * framework: API → UI → DB → fault → evidence → cleanup.
 *
 * Adaptation note: the demo targets (the-internet, jsonplaceholder) have
 * no shared backend, so this runs against the bundled fixture app, which
 * models a real full-stack login flow (API + UI + Postgres behind one
 * roof). Against your own app, point BASE_URL at it and swap the page
 * object / API paths — the workflow shape transfers unchanged.
 *
 * Parallel-safe: every record this spec creates carries a unique name and
 * is deleted in cleanup. Nothing is shared between workers.
 */
const CreatedUserSchema = z.object({
	id: z.number(),
	username: z.string(),
});

interface DbUser {
	id: number;
	username: string;
}

async function verifyUserPersisted(
	db: PGliteDatabase,
	username: string,
): Promise<DbUser | null> {
	const rows = await db.query<DbUser>(
		'SELECT id, username FROM fixture_users WHERE username = $1',
		[username],
	);
	return rows[0] ?? null;
}

test.describe('flagship workflow', () => {
	test('full-stack user journey: api create → ui login → db verify → fault recovery → cleanup', async ({
		page,
		appTarget,
		chaos,
	}, testInfo) => {
		test.skip(!appTarget.isFixture, 'needs the fixture app database');
		const database = appTarget.db;
		if (!database) {
			throw new Error('fixture database unavailable');
		}

		const username = `wf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
		const password = 'Flagship123!';
		const api = new ApiClient({ baseURL: `${appTarget.url}/api` });
		const login = new LoginPage(page, appTarget.url);

		// 1. API — create uniquely-identified data, contract-validated.
		const created = await api.post<unknown>('/users', { username, password });
		expect(created.status).toBe(201);
		const parsed = CreatedUserSchema.safeParse(created.data);
		expect(parsed.success).toBe(true);
		if (!parsed.success) throw new Error('create-user contract violated');
		const userId = parsed.data.id;
		await attachJson(testInfo, 'api-create-response', {
			status: created.status,
			body: parsed.data,
		});

		// 2. UI — log in as the created user (meaningful operation on the data).
		await login.login(username, password);
		await expect(login.flash).toContainText('You logged into a secure area!');
		await expect(page.getByText(`Logged in as ${username}`)).toBeVisible();

		// 3. DB — verify persistence independently of the HTTP layers.
		const persisted = await verifyUserPersisted(database, username);
		expect(persisted, 'created user must be persisted').not.toBeNull();
		expect(persisted?.id).toBe(userId);
		await attachJson(testInfo, 'db-verification', persisted);

		// 4. FAULT — repeat the login under injected auth latency;
		//    expected recovery: it still succeeds, just slower.
		await page.context().clearCookies();
		await chaos.start({ latencyMs: 1500, urlPattern: '**/authenticate' });
		try {
			await login.login(username, password);
			await expect(login.flash).toContainText(
				'You logged into a secure area!',
				{ timeout: 20_000 },
			);
		} finally {
			await chaos.stop();
		}
		const interceptions = chaos.getInterceptions();
		expect(
			interceptions.some((r) => r.action === 'delayed'),
			'expected the auth call to be delayed by chaos',
		).toBe(true);
		await attachJson(testInfo, 'fault-recovery-evidence', {
			fault: '1500ms latency on /authenticate',
			expectedRecovery: 'login still succeeds',
			interceptions,
		});

		// 5. EVIDENCE — the secure area, as the user saw it.
		await attachScreenshot(testInfo, page, 'flagship-secure-area');

		// 6. CLEANUP — delete only the record this test owns.
		const deleted = await api.delete(`/users/${userId}`);
		expect(deleted.status).toBe(204);
		expect(await verifyUserPersisted(database, username)).toBeNull();
	});
});
