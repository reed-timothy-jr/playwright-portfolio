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
			ssl: opts.ssl ? { rejectUnauthorized: false } : undefined,
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
 * In-process Postgres for hermetic specs. Imported lazily so the pg
 * dependency stays optional for teams that only want the real client.
 */
export class PGliteDatabase implements DatabaseClient {
	private db: {
		query: (
			sql: string,
			params?: unknown[],
		) => Promise<{ rows: Record<string, unknown>[] }>;
		close: () => Promise<void>;
	} | null = null;

	private async instance() {
		if (!this.db) {
			const { PGlite } = await import('@electric-sql/pglite');
			const pg = new PGlite();
			this.db = {
				query: async (sql: string, params: unknown[] = []) =>
					pg.query(sql, params),
				close: async () => pg.close(),
			};
		}
		return this.db;
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
			await this.db.close();
			this.db = null;
		}
	}
}
