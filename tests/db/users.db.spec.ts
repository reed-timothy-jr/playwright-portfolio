import { expect, test } from '../../src/fixtures';
import { createDatabaseClient, scopedName } from '../../src/support/db';

/**
 * DB pillar — the persistence contract.
 *
 * Two lanes (see createDatabaseClient): PGlite in-process by default
 * (hermetic, green on clone), real Postgres when DB_HOST (+ DB_USER,
 * DB_PASSWORD, DB_NAME) is set. Same specs, same interface.
 *
 * Every test scopes its tables with scopedName() and drops them in
 * cleanup — parallel workers never share mutable state.
 */
test.describe('database layer', () => {
	test('registered users persist and are queryable by the login flow', async () => {
		const db = createDatabaseClient();
		const table = scopedName('users');
		try {
			await db.query(`
        CREATE TABLE ${table} (
          id SERIAL PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT now()
        )
      `);

			// Act: what the app's registration handler executes.
			await db.query(
				`INSERT INTO ${table} (username, password_hash) VALUES ($1, $2)`,
				['tomsmith', 'hash-of-SuperSecretPassword!'],
			);

			// Verify: the login flow's credential lookup finds the user.
			const rows = await db.query<{ id: number; username: string }>(
				`SELECT id, username FROM ${table} WHERE username = $1`,
				['tomsmith'],
			);
			expect(rows).toHaveLength(1);
			expect(rows[0].username).toBe('tomsmith');

			// Negative: unknown users stay unknown.
			const missing = await db.query(
				`SELECT id FROM ${table} WHERE username = $1`,
				['nobody'],
			);
			expect(missing).toHaveLength(0);
		} finally {
			await db.query(`DROP TABLE IF EXISTS ${table}`);
			await db.close();
		}
	});

	test('duplicate usernames are rejected by the unique constraint', async () => {
		const db = createDatabaseClient();
		const table = scopedName('users');
		try {
			await db.query(
				`CREATE TABLE ${table} (id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL)`,
			);
			await db.query(`INSERT INTO ${table} (username) VALUES ('tomsmith')`);
			await expect(
				db.query(`INSERT INTO ${table} (username) VALUES ('tomsmith')`),
			).rejects.toThrow(/duplicate|unique/i);
		} finally {
			await db.query(`DROP TABLE IF EXISTS ${table}`);
			await db.close();
		}
	});
});
