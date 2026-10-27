import { Pool, type QueryResultRow } from 'pg';

/**
 * PowerBase database layer.
 *
 * Two implementations, one interface:
 * - PostgresDatabase — real Postgres via pg Pool (env-configured). Use this
 *   against your own database.
 * - PGliteDatabase — in-process Postgres (no server, no Docker). Use it for
 *   runnable, hermetic DB specs in CI and portfolios.
 *
 * The pattern this enables: API setup -> UI assertion -> DB verification,
 * so a spec can prove a user-visible action actually persisted.
 */

export interface DatabaseClient {
	query<T extends QueryResultRow = QueryResultRow>(
		sql: string,
		params?: unknown[],
	): Promise<T[]>;
	close(): Promise<void>;
}

export interface PostgresOptions {
	host: string;
	port?: number;
	user: string;
	password: string;
	database: string;
	ssl?: boolean;
}

/**
 * Two lanes, one interface:
 * - PGlite lane (default): in-process Postgres, no server or Docker.
 *   Fast, hermetic, green on clone — the right default for CI.
 * - Real-Postgres lane: set DB_HOST (+ DB_USER, DB_PASSWORD, DB_NAME,
 *   optional DB_PORT / DB_SSL=true) to run the same specs against a real
 *   database. Use it for integration runs against your own backend.
 */
export function createDatabaseClient(): DatabaseClient {
	if (process.env.DB_HOST) {
		return PostgresDatabase.fromEnv();
	}
	return new PGliteDatabase();
}

/**
 * Collision-safe name for per-test database objects (tables, schemas).
 * Parallel workers must never share mutable state — scope every object
 * a test creates to a unique name and drop it in cleanup.
 */
export function scopedName(prefix: string): string {
	const rand = Math.random().toString(36).slice(2, 8);
	return `${prefix}_${process.pid}_${Date.now().toString(36)}_${rand}`;
}

/** Real Postgres, connection-pooled, env-driven. */
export class PostgresDatabase implements DatabaseClient {
	private pool: Pool;

	constructor(opts: PostgresOptions) {
		this.pool = new Pool({
			host: opts.host,
			port: opts.port ?? 5432,
			user: opts.user,
			password: opts.password,
			database: opts.database,
			// TLS verification stays ON by default — a sec-pillar framework
			// must not silently disable it. Opt out per-environment only.
			ssl: opts.ssl
				? {
						rejectUnauthorized:
							process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
					}
				: undefined,
			max: 5,
		});
	}

	static fromEnv(): PostgresDatabase {
		const host = process.env.DB_HOST;
		const user = process.env.DB_USER;
		const password = process.env.DB_PASSWORD;
		const database = process.env.DB_NAME;
		if (!host || !user || !password || !database) {
			throw new Error(
				'PostgresDatabase: missing one of DB_HOST, DB_USER, DB_PASSWORD, DB_NAME',
			);
		}
		return new PostgresDatabase({
			host,
			port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
			user,
			password,
			database,
			ssl: process.env.DB_SSL === 'true',
		});
	}

	async query<T extends QueryResultRow = QueryResultRow>(
		sql: string,
		params: unknown[] = [],
	): Promise<T[]> {
		const client = await this.pool.connect();
		try {
			const result = await client.query(sql, params as unknown[]);
			return result.rows as T[];
		} finally {
			client.release();
		}
	}

	async close(): Promise<void> {
		await this.pool.end();
	}
}

/**
 * In-process Postgres for hermetic specs. The pg driver is imported
 * statically at the top of this module (used by PostgresDatabase), so it
 * is a regular dependency — PGlite itself is imported lazily because it
 * is only needed on the default lane.
 */
export class PGliteDatabase implements DatabaseClient {
	private db: {
		query: (
			sql: string,
			params?: unknown[],
		) => Promise<{ rows: Record<string, unknown>[] }>;
		close: () => Promise<void>;
	} | null = null;
	/** Cached init promise: concurrent first queries share one database. */
	private initPromise: Promise<{
		query: (
			sql: string,
			params?: unknown[],
		) => Promise<{ rows: Record<string, unknown>[] }>;
		close: () => Promise<void>;
	}> | null = null;

	private async instance() {
		if (!this.db) {
			this.initPromise ??= (async () => {
				const { PGlite } = await import('@electric-sql/pglite');
				const pg = new PGlite();
				this.db = {
					query: async (sql: string, params: unknown[] = []) =>
						pg.query(sql, params),
					close: async () => pg.close(),
				};
				return this.db;
			})();
			await this.initPromise;
		}
		return this.db as NonNullable<typeof this.db>;
	}

	async query<T extends QueryResultRow = QueryResultRow>(
		sql: string,
		params: unknown[] = [],
	): Promise<T[]> {
		const db = await this.instance();
		const result = await db.query(sql, params);
		return result.rows as T[];
	}

	async close(): Promise<void> {
		if (this.db) {
			const target = this.db;
			this.db = null;
			this.initPromise = null;
			await target.close().catch(() => undefined);
		}
	}
}
