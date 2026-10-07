import { expect, test } from '../../src/fixtures';
import { PGliteDatabase } from '../../src/support/db';

/**
 * Database layer — runnable against in-process Postgres (PGlite): no
 * server, no Docker, green on clone. Against a real database, swap in
 * PostgresDatabase.fromEnv() — same interface, same specs.
 *
 * The pattern this proves: seed -> act -> verify. In a full stack,
 * the "act" step is your UI or API call, and the DB assertion proves
 * the user-visible action actually persisted.
 */
test.describe('database layer', () => {
	test('registered users persist and are queryable by the login flow', async () => {
		const db = new PGliteDatabase();
		try {
			await db.query(`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT now()
        )
      `);

			// Act: what the app's registration handler executes.
			await db.query(
				'INSERT INTO users (username, password_hash) VALUES ($1, $2)',
				['tomsmith', 'hash-of-SuperSecretPassword!'],
			);

			// Verify: the login flow's credential lookup finds the user.
			const rows = await db.query<{ id: number; username: string }>(
				'SELECT id, username FROM users WHERE username = $1',
				['tomsmith'],
			);
			expect(rows).toHaveLength(1);
			expect(rows[0].username).toBe('tomsmith');

			// Negative: unknown users stay unknown.
			const missing = await db.query(
				'SELECT id FROM users WHERE username = $1',
				['nobody'],
			);
			expect(missing).toHaveLength(0);
		} finally {
			await db.close();
		}
	});

	test('duplicate usernames are rejected by the unique constraint', async () => {
		const db = new PGliteDatabase();
		try {
			await db.query(
				'CREATE TABLE users (id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL)',
			);
			await db.query("INSERT INTO users (username) VALUES ('tomsmith')");
			await expect(
				db.query("INSERT INTO users (username) VALUES ('tomsmith')"),
			).rejects.toThrow(/duplicate|unique/i);
		} finally {
			await db.close();
		}
	});
});
