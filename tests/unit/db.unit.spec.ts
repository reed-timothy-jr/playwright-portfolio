import { expect, test } from '../../src/fixtures';
import {
	createDatabaseClient,
	PGliteDatabase,
	scopedName,
} from '../../src/support/db';

/**
 * UNIT suite — focused tests for the database utilities:
 * lane selection, collision-safe scoping, and cleanup isolation.
 */
test.describe('database utilities unit', () => {
	test('createDatabaseClient picks the PGlite lane without DB_HOST', () => {
		// The lane is env-driven: stub the env inside the test instead of
		// asserting on the ambient environment, so the suite also passes
		// for engineers who DO use the Postgres lane daily.
		const saved = process.env.DB_HOST;
		delete process.env.DB_HOST;
		try {
			expect(createDatabaseClient()).toBeInstanceOf(PGliteDatabase);
		} finally {
			if (saved !== undefined) process.env.DB_HOST = saved;
		}
	});

	test('concurrent first queries share one PGlite instance', async () => {
		const db = new PGliteDatabase();
		try {
			const table = scopedName('race');
			// Fire before any query has completed: without promise caching
			// this would initialize two databases and the table would be
			// invisible to half the queries.
			const [a, b] = await Promise.all([
				db.query(`CREATE TABLE ${table} (id SERIAL PRIMARY KEY)`),
				db.query(`SELECT 1 AS one`),
			]);
			expect(a).toEqual([]);
			expect(b).toEqual([{ one: 1 }]);
			const check = await db.query(
				`SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_name = $1`,
				[table],
			);
			expect(Number((check[0] as { n: string }).n)).toBe(1);
			await db.query(`DROP TABLE ${table}`);
		} finally {
			await db.close();
		}
	});

	test('scopedName generates unique, safe identifiers', () => {
		const a = scopedName('users');
		const b = scopedName('users');
		expect(a).not.toBe(b);
		expect(a).toMatch(/^[a-z0-9_]+$/);
		expect(a.startsWith('users_')).toBe(true);
	});

	test('scoped tables are isolated and cleaned up', async () => {
		const db = createDatabaseClient();
		const tableA = scopedName('t');
		const tableB = scopedName('t');
		try {
			for (const t of [tableA, tableB]) {
				await db.query(`CREATE TABLE ${t} (id SERIAL PRIMARY KEY, v TEXT)`);
			}
			await db.query(`INSERT INTO ${tableA} (v) VALUES ('only-in-a')`);

			// Isolation: table B sees nothing from table A.
			const rowsB = await db.query(`SELECT v FROM ${tableB}`);
			expect(rowsB).toHaveLength(0);
			const rowsA = await db.query(`SELECT v FROM ${tableA}`);
			expect(rowsA).toHaveLength(1);

			// Cleanup scoping: dropping A leaves B untouched.
			await db.query(`DROP TABLE ${tableA}`);
			const stillB = await db.query(`SELECT v FROM ${tableB}`);
			expect(stillB).toHaveLength(0);
			await expect(db.query(`SELECT v FROM ${tableA}`)).rejects.toThrow();
		} finally {
			await db.query(`DROP TABLE IF EXISTS ${tableA}`);
			await db.query(`DROP TABLE IF EXISTS ${tableB}`);
			await db.close();
		}
	});
});
