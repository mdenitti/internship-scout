import type { AppSettings, ClassificationValue, Internship } from '@/lib/domain/types';

/**
 * Persistence is expressed as three narrow repositories. Everything above this layer works
 * with domain objects only, so the storage driver (JSON file, Postgres, in-memory, ...) can
 * be replaced without touching services or UI.
 */

export interface InternshipQuery {
  ids?: string[];
  source?: string;
}

export interface InternshipRepository {
  list(query?: InternshipQuery): Promise<Internship[]>;
  get(id: string): Promise<Internship | null>;
  /** Insert or replace by id. Returns the stored records. */
  upsertMany(internships: readonly Internship[]): Promise<void>;
  delete(id: string): Promise<boolean>;
  deleteMany(ids: readonly string[]): Promise<number>;
  /** Removes every record flagged as demo data. */
  deleteDemo(): Promise<number>;
  count(): Promise<number>;
}

export interface SettingsRepository {
  /** Returns the stored settings, creating seed settings when the store is empty. */
  get(): Promise<AppSettings>;
  save(settings: AppSettings): Promise<AppSettings>;
}

export interface ClassificationRepository {
  list(): Promise<ClassificationValue[]>;
  saveAll(values: readonly ClassificationValue[]): Promise<ClassificationValue[]>;
}

export interface RepositoryBundle {
  internships: InternshipRepository;
  settings: SettingsRepository;
  classifications: ClassificationRepository;
  info: StoreInfo;
}

export interface StoreInfo {
  /** `json` or `postgres`. */
  driver: 'json' | 'postgres';
  /** Human readable location of the data (file path or "postgres database"). */
  location: string;
  /** False when the data will not survive a restart (e.g. /tmp on Vercel). */
  persistent: boolean;
  /** User facing explanation, surfaced in the UI when persistence is limited. */
  note?: string;
}

export class StorageError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'StorageError';
  }
}
