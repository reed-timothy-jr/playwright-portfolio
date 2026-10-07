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
		expect(process.env.DB_HOST).toBeUndefined();
		expect(createDatabaseClient()).toBeInstanceOf(PGliteDatabase);
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
