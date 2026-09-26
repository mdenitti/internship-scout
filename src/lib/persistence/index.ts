import path from 'node:path';

import { envConfig } from '@/lib/config/env';
import { JsonFileStore } from './json-repository';
import {
  JsonClassificationRepository,
  JsonInternshipRepository,
  JsonSettingsRepository,
} from './json-repositories';
import type { RepositoryBundle, StoreInfo } from './types';

/**
 * Storage factory.
 *
 *   DATABASE_URL / POSTGRES_URL set   -> Postgres (persistent, recommended for Vercel)
 *   else, local development          -> ./.data/db.json (persistent across restarts)
 *   else, on Vercel                  -> /tmp/internship-scout/db.json (ephemeral!)
 *
 * The UI reads `info.persistent` and shows a banner when data will not survive a restart,
 * so the behaviour is never surprising.
 */

const globalForStore = globalThis as unknown as {
  __internshipScoutBundle?: Promise<RepositoryBundle>;
};

function resolveJsonLocation(): { filePath: string; info: StoreInfo } {
  const config = envConfig();
  if (config.dataFilePath) {
    return {
      filePath: path.isAbsolute(config.dataFilePath)
        ? config.dataFilePath
        : // turbopackIgnore: DATA_FILE_PATH is user supplied, never derived from app files —
          // tracing it would (incorrectly) pull the whole project into the server bundle.
          path.join(/* turbopackIgnore: true */ process.cwd(), config.dataFilePath),
      info: {
        driver: 'json',
        location: config.dataFilePath,
        persistent: true,
      },
    };
  }

  if (config.isVercel) {
    return {
      filePath: path.join('/tmp', 'internship-scout', 'db.json'),
      info: {
        driver: 'json',
        location: '/tmp/internship-scout/db.json',
        persistent: false,
        note:
          'Running without a database on Vercel: data is written to the ephemeral /tmp filesystem ' +
          'and is lost when the function instance is recycled. Set DATABASE_URL to persist internships.',
      },
    };
  }

  return {
    filePath: path.join(process.cwd(), '.data', 'db.json'),
    info: {
      driver: 'json',
      location: './.data/db.json',
      persistent: true,
    },
  };
}

async function createBundle(): Promise<RepositoryBundle> {
  const config = envConfig();

  if (config.databaseUrl) {
    const { PostgresClassificationRepository, PostgresInternshipRepository, PostgresSettingsRepository } =
      await import('./postgres-repository');
    return {
      internships: new PostgresInternshipRepository(config.databaseUrl),
      settings: new PostgresSettingsRepository(config.databaseUrl),
      classifications: new PostgresClassificationRepository(config.databaseUrl),
      info: { driver: 'postgres', location: 'postgres', persistent: true },
    };
  }

  const { filePath, info } = resolveJsonLocation();
  const store = new JsonFileStore(filePath, info.persistent);
  return {
    internships: new JsonInternshipRepository(store),
    settings: new JsonSettingsRepository(store),
    classifications: new JsonClassificationRepository(store),
    info,
  };
}

/** Cached per server instance; safe to call from every route handler and page. */
export function getRepositories(): Promise<RepositoryBundle> {
  if (!globalForStore.__internshipScoutBundle) {
    globalForStore.__internshipScoutBundle = createBundle().catch((error) => {
      globalForStore.__internshipScoutBundle = undefined;
      throw error;
    });
  }
  return globalForStore.__internshipScoutBundle;
}

/** Test helper: drop the cached bundle (used by integration tests / dev scripts). */
export function resetRepositoryCache(): void {
  delete globalForStore.__internshipScoutBundle;
}

export type {
  ClassificationRepository,
  InternshipRepository,
  RepositoryBundle,
  SettingsRepository,
  StoreInfo,
} from './types';
export { StorageError } from './types';
