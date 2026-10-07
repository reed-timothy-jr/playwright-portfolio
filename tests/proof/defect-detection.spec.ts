import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { z } from 'zod';
import { expect, test } from '../../src/fixtures';
import { ApiClient } from '../../src/support/apiClient';
import type { PGliteDatabase } from '../../src/support/db';
import { attachJson } from '../../src/support/evidence';
import { heal } from '../../src/support/selfHealing';

/**
 * PROOF suite — defect detection.
 *
 * The portfolio question this answers: "your suite is all green — but can
 * it actually FIND bugs?" Each scenario below plants a realistic defect and
 * asserts the framework DETECTS it. The tests themselves pass green, because
 * detection working is the asserted behavior.
 *
 * These live in the `proof` project (run via `npm run test:proof`),
 * separate from test:all — they demonstrate failure scenarios, so they
 * are reviewed as evidence, not counted as regression coverage.
 * See docs/expected-outcomes.md for the scenario → expectation map.
 */
test.describe('defect detection proof', () => {
	test('(a) an ambiguous UI change is refused, not healed over', async ({
		page,
	}, testInfo) => {
		// Defect: a deploy duplicated the submit button — two identical
		// "Delete" buttons now exist. Healing to either one could delete
		// the wrong record and still pass. The framework must refuse.
		await page.setContent('<button>Delete</button><button>Delete</button>');
		const deleter = heal(
			page,
			'destructive delete button',
			(p) => p.locator('#delete-btn-v1'), // stale after the redesign
			[{ name: 'text-delete', locate: (p) => p.getByText('Delete') }],
		);

		let rejection: Error | null = null;
		try {
			await deleter.resolve(2000);
		} catch (err) {
			rejection = err as Error;
		}
		expect(rejection, 'ambiguous UI change must not heal').not.toBeNull();

		const log = deleter.getAttemptLog();
		await attachJson(testInfo, 'ambiguity-audit', {
			rejection: rejection?.message,
			attemptLog: log,
		});
		expect(log.some((a) => a.outcome === 'ambiguous-rejected')).toBe(true);
		expect(deleter.getHealingEvents()).toHaveLength(0);
	});

	// biome-ignore lint/correctness/noEmptyPattern: need testInfo without fixtures
	test('(b) an API contract break is caught by schema validation', async ({}, testInfo) => {
		// Defect: the API started returning users without `email`
		// (a backend deploy dropped the field). Status is still 200 —
		// only contract validation catches it.
		const server: Server = createServer((_req, res) => {
			res.writeHead(200, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify([{ id: 1, name: 'Ada' }])); // email missing!
		});
		await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
		const port = (server.address() as AddressInfo).port;
		try {
			const res = await fetch(`http://127.0.0.1:${port}/users`);
			expect(res.status).toBe(200); // the trap: status looks fine
			const data: unknown = await res.json();

			const UserSchema = z.object({
				id: z.number(),
				name: z.string(),
				email: z.string().email(),
			});
			const parsed = z.array(UserSchema).safeParse(data);

			await attachJson(testInfo, 'contract-violation', {
				status: res.status,
				payload: data,
				validationPassed: parsed.success,
			});
			// Detection asserted: the contract break is flagged.
			expect(parsed.success).toBe(false);
		} finally {
			await new Promise<void>((resolve, reject) =>
				server.close((e) => (e ? reject(e) : resolve())),
			);
		}
	});

	test('(c) a false-positive UI is exposed by DB verification', async ({
		appTarget,
	}, testInfo) => {
		test.skip(!appTarget.isFixture, 'needs the fixture app database');
		const database = appTarget.db;
		if (!database) {
			throw new Error('fixture database unavailable');
		}

		/**
		 * The pattern every full-stack spec should run: never trust the
		 * UI/API success signal alone — verify persistence independently.
		 */
		async function verifyPersisted(
			db: PGliteDatabase,
			username: string,
		): Promise<boolean> {
			const rows = await db.query(
				'SELECT id FROM fixture_users WHERE username = $1',
				[username],
			);
			return rows.length > 0;
		}

		const client = new ApiClient({ baseURL: `${appTarget.url}/api` });

		// Control case: a real creation verifies as persisted.
		const created = await client.post<{ id: number; username: string }>(
			'/users',
			{ username: `proof_${Date.now().toString(36)}`, password: 'password123' },
		);
		expect(created.status).toBe(201);
		expect(await verifyPersisted(database, created.data.username)).toBe(true);

		// Defect case: duplicate creation → 409. A sloppy client checking
		// only `status < 500` would record this as success — the DB check
		// proves nothing new persisted.
		const dupe = await client.post('/users', {
			username: created.data.username,
			password: 'password123',
		});
		const sloppySaysSuccess = dupe.status < 500; // the trap
		const count = await database.query<{ n: string }>(
			'SELECT COUNT(*)::text AS n FROM fixture_users WHERE username = $1',
			[created.data.username],
		);
		const actuallyCreatedAgain = Number(count[0].n) > 1;

		await attachJson(testInfo, 'false-positive-check', {
			duplicateStatus: dupe.status,
			sloppySaysSuccess,
			actuallyCreatedAgain,
		});
		expect(sloppySaysSuccess).toBe(true); // the trap is real
		expect(actuallyCreatedAgain).toBe(false); // ...and verification exposes it

		// Cleanup: only the record this test owns.
		await client.delete(`/users/${created.data.id}`);
		expect(await verifyPersisted(database, created.data.username)).toBe(false);
	});
});
