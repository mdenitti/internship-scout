import { createDefaultClassifications, createDefaultSettings } from '@/lib/domain/defaults';
import { appSettingsSchema, classificationValueSchema, internshipSchema } from '@/lib/domain/schema';
import type { AppSettings, ClassificationValue, Internship } from '@/lib/domain/types';
import type {
  ClassificationRepository,
  InternshipQuery,
  InternshipRepository,
  SettingsRepository,
} from './types';
import { StorageError } from './types';

/**
 * Postgres driver (Neon, Vercel Postgres, Supabase, local Postgres...).
 *
 * The internship document is stored as JSONB so the model stays extensible without
 * migrations, while the fields we filter and sort on often are promoted to real columns
 * with indexes. The pool is cached on `globalThis` so serverless invocations reuse
 * connections; `pg` is loaded lazily by the factory, so this file is never touched when
 * DATABASE_URL is absent.
 */

interface PoolLike {
  query: (text: string, values?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>>; rowCount: number | null }>;
}

const globalForPg = globalThis as unknown as {
  __internshipScoutPool?: Promise<PoolLike>;
  __internshipScoutSchemaReady?: Promise<void>;
};

async function createPool(connectionString: string): Promise<PoolLike> {
  const { Pool } = await import('pg');
  const requiresSsl = !/localhost|127\.0\.0\.1/.test(connectionString);
  const pool = new Pool({
    connectionString,
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    ...(requiresSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  });
  // Surface pool level failures instead of crashing the process.
  pool.on('error', (error: Error) => {
    console.error('[storage] unexpected postgres pool error:', error.message);
  });
  return pool as unknown as PoolLike;
}

async function getPool(connectionString: string): Promise<PoolLike> {
  if (!globalForPg.__internshipScoutPool) {
    globalForPg.__internshipScoutPool = createPool(connectionString).catch((error) => {
      globalForPg.__internshipScoutPool = undefined;
      throw new StorageError('Could not connect to the Postgres database.', error);
    });
  }
  return globalForPg.__internshipScoutPool;
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS internships (
  id text PRIMARY KEY,
  source text NOT NULL,
  source_id text,
  url text NOT NULL,
  canonical_url text,
  url_key text,
  fingerprint text NOT NULL,
  status text NOT NULL,
  ai_score integer,
  evaluation_status text NOT NULL,
  is_demo boolean NOT NULL DEFAULT false,
  discovered_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS internships_canonical_url_idx ON internships (canonical_url);
CREATE INDEX IF NOT EXISTS internships_url_key_idx ON internships (url_key);
CREATE INDEX IF NOT EXISTS internships_fingerprint_idx ON internships (fingerprint);
CREATE INDEX IF NOT EXISTS internships_status_idx ON internships (status);
CREATE INDEX IF NOT EXISTS internships_ai_score_idx ON internships (ai_score DESC);
CREATE TABLE IF NOT EXISTS classifications (
  id text PRIMARY KEY,
  kind text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  data jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS app_settings (
  id text PRIMARY KEY,
  data jsonb NOT NULL
);
`;

async function ensureSchema(pool: PoolLike): Promise<void> {
  if (!globalForPg.__internshipScoutSchemaReady) {
    globalForPg.__internshipScoutSchemaReady = (async () => {
      try {
        await pool.query(SCHEMA_SQL);
      } catch (error) {
        globalForPg.__internshipScoutSchemaReady = undefined;
        throw new StorageError('Could not create the database schema.', error);
      }
    })();
  }
  await globalForPg.__internshipScoutSchemaReady;
}

function rowToInternship(row: Record<string, unknown>): Internship | null {
  const result = internshipSchema.safeParse(row.data);
  if (!result.success) {
    console.warn('[storage] skipping invalid internship row', row.id, result.error.issues[0]?.message);
    return null;
  }
  return result.data as Internship;
}

export class PostgresInternshipRepository implements InternshipRepository {
  constructor(private readonly connectionString: string) {}

  private async pool(): Promise<PoolLike> {
    const pool = await getPool(this.connectionString);
    await ensureSchema(pool);
    return pool;
  }

  async list(query: InternshipQuery = {}): Promise<Internship[]> {
    const pool = await this.pool();
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (query.ids && query.ids.length > 0) {
      values.push(query.ids);
      conditions.push(`id = ANY($${values.length})`);
    }
    if (query.source) {
      values.push(query.source);
      conditions.push(`source = $${values.length}`);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT id, data FROM internships ${where} ORDER BY discovered_at DESC`,
      values,
    );
    return result.rows
      .map((row) => rowToInternship(row))
      .filter((internship): internship is Internship => internship !== null);
  }

  async get(id: string): Promise<Internship | null> {
    const pool = await this.pool();
    const result = await pool.query('SELECT id, data FROM internships WHERE id = $1', [id]);
    const row = result.rows[0];
    return row ? rowToInternship(row) : null;
  }

  async upsertMany(internships: readonly Internship[]): Promise<void> {
    if (internships.length === 0) return;
    const pool = await this.pool();
    for (const internship of internships) {
      await pool.query(
        `INSERT INTO internships
           (id, source, source_id, url, canonical_url, url_key, fingerprint, status, ai_score,
            evaluation_status, is_demo, discovered_at, updated_at, data)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         ON CONFLICT (id) DO UPDATE SET
           source = EXCLUDED.source,
           source_id = EXCLUDED.source_id,
           url = EXCLUDED.url,
           canonical_url = EXCLUDED.canonical_url,
           url_key = EXCLUDED.url_key,
           fingerprint = EXCLUDED.fingerprint,
           status = EXCLUDED.status,
           ai_score = EXCLUDED.ai_score,
           evaluation_status = EXCLUDED.evaluation_status,
           is_demo = EXCLUDED.is_demo,
           discovered_at = EXCLUDED.discovered_at,
           updated_at = EXCLUDED.updated_at,
           data = EXCLUDED.data`,
        [
          internship.id,
          internship.source,
          internship.sourceId ?? null,
          internship.url,
          internship.dedupe.canonicalUrl,
          internship.dedupe.urlKey,
          internship.dedupe.fingerprint,
          internship.status,
          effectiveScoreColumn(internship),
          internship.evaluationStatus,
          internship.isDemo ?? false,
          internship.discoveredAt,
          internship.updatedAt,
          JSON.stringify(internship),
        ],
      );
    }
  }

  async delete(id: string): Promise<boolean> {
    const pool = await this.pool();
    const result = await pool.query('DELETE FROM internships WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async deleteMany(ids: readonly string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const pool = await this.pool();
    const result = await pool.query('DELETE FROM internships WHERE id = ANY($1)', [ids]);
    return result.rowCount ?? 0;
  }

  async deleteDemo(): Promise<number> {
    const pool = await this.pool();
    const result = await pool.query('DELETE FROM internships WHERE is_demo = true');
    return result.rowCount ?? 0;
  }

  async count(): Promise<number> {
    const pool = await this.pool();
    const result = await pool.query('SELECT COUNT(*)::int AS count FROM internships');
    const value = result.rows[0]?.count;
    return typeof value === 'number' ? value : Number(value ?? 0);
  }
}


export class PostgresSettingsRepository implements SettingsRepository {
  constructor(private readonly connectionString: string) {}

  private async pool(): Promise<PoolLike> {
    const pool = await getPool(this.connectionString);
    await ensureSchema(pool);
    return pool;
  }

  async get(): Promise<AppSettings> {
    const pool = await this.pool();
    const result = await pool.query("SELECT data FROM app_settings WHERE id = 'default'");
    const row = result.rows[0];
    if (row) {
      const parsed = appSettingsSchema.safeParse(row.data);
      if (parsed.success) return parsed.data as AppSettings;
      console.warn('[storage] stored settings were invalid, reseeding defaults');
    }
    return this.save(createDefaultSettings());
  }

  async save(settings: AppSettings): Promise<AppSettings> {
    const pool = await this.pool();
    await pool.query(
      `INSERT INTO app_settings (id, data) VALUES ('default', $1)
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
      [JSON.stringify(settings)],
    );
    return settings;
  }
}

export class PostgresClassificationRepository implements ClassificationRepository {
  constructor(private readonly connectionString: string) {}

  private async pool(): Promise<PoolLike> {
    const pool = await getPool(this.connectionString);
    await ensureSchema(pool);
    return pool;
  }

  async list(): Promise<ClassificationValue[]> {
    const pool = await this.pool();
    const result = await pool.query('SELECT data FROM classifications ORDER BY kind, position, id');
    const values: ClassificationValue[] = [];
    for (const row of result.rows) {
      const parsed = classificationValueSchema.safeParse(row.data);
      if (parsed.success) values.push(parsed.data as ClassificationValue);
    }
    if (values.length > 0) return values;
    return this.saveAll(createDefaultClassifications());
  }

  async saveAll(values: readonly ClassificationValue[]): Promise<ClassificationValue[]> {
    const pool = await this.pool();
    await pool.query('DELETE FROM classifications');
    let position = 0;
    for (const value of values) {
      await pool.query('INSERT INTO classifications (id, kind, position, data) VALUES ($1,$2,$3,$4)', [
        value.id,
        value.kind,
        value.order ?? position,
        JSON.stringify(value),
      ]);
      position += 1;
    }
    return [...values];
  }
}

function effectiveScoreColumn(internship: Internship): number | null {
  if (typeof internship.manualOverride?.score === 'number') return internship.manualOverride.score;
  return internship.evaluation?.score ?? null;
}

