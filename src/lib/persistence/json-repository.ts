import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { classificationsSchema, appSettingsSchema, internshipSchema } from '@/lib/domain/schema';
import { createDefaultClassifications } from '@/lib/domain/defaults';
import type { AppSettings, ClassificationValue, Internship } from '@/lib/domain/types';
import { StorageError } from './types';

/**
 * JSON file store.
 *
 * Chosen as the zero-configuration default: `npm run dev` works with no database, and the
 * whole file can be inspected or deleted by hand. Writes are atomic (temp file + rename)
 * and serialized through an in-process mutex, so concurrent route handlers cannot corrupt
 * the file.
 *
 * On Vercel the project filesystem is read-only; the factory in `index.ts` then points the
 * store at `/tmp` and flags it as non persistent.
 */

export interface StoreData {
  version: number;
  internships: Internship[];
  classifications: ClassificationValue[];
  settings: AppSettings | null;
}

const STORE_VERSION = 1;

function emptyData(): StoreData {
  return { version: STORE_VERSION, internships: [], classifications: [], settings: null };
}

export class JsonFileStore {
  private queue: Promise<unknown> = Promise.resolve();
  private corruptCount = 0;

  constructor(
    readonly filePath: string,
    readonly persistent: boolean,
  ) {}

  private async readRaw(): Promise<StoreData> {
    let raw: string;
    try {
      raw = await readFile(this.filePath, 'utf8');
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') return emptyData();
      throw new StorageError(`Could not read the data file at ${this.filePath}.`, error);
    }

    try {
      const parsed = JSON.parse(raw) as Partial<StoreData>;
      return {
        version: typeof parsed.version === 'number' ? parsed.version : STORE_VERSION,
        internships: Array.isArray(parsed.internships) ? parsed.internships : [],
        classifications: Array.isArray(parsed.classifications) ? parsed.classifications : [],
        settings: parsed.settings ?? null,
      };
    } catch (error) {
      // Never destroy user data: move the unreadable file aside and start clean.
      this.corruptCount += 1;
      const backup = `${this.filePath}.corrupt-${Date.now()}`;
      try {
        await rename(this.filePath, backup);
      } catch {
        /* best effort */
      }
      console.warn(
        `[storage] ${this.filePath} was not valid JSON (${(error as Error).message}). ` +
          `Moved to ${backup} and started with an empty store.`,
      );
      return emptyData();
    }
  }

  /** Validate on read so that hand-edited or partially written data cannot break the app. */
  async read(): Promise<StoreData> {
    const data = await this.readRaw();
    const internships: Internship[] = [];
    for (const candidate of data.internships) {
      const result = internshipSchema.safeParse(candidate);
      if (result.success) {
        internships.push(result.data as Internship);
        continue;
      }
      if (this.corruptCount < 5) {
        console.warn('[storage] skipping an invalid internship record:', result.error.issues[0]?.message);
      }
    }

    const classifications = classificationsSchema.safeParse({ values: data.classifications });
    const settings = data.settings ? appSettingsSchema.safeParse(data.settings) : null;

    return {
      version: data.version,
      internships,
      classifications: classifications.success
        ? classifications.data.values
        : createDefaultClassifications(),
      settings: settings && settings.success ? (settings.data as AppSettings) : null,
    };
  }

  private async writeData(data: StoreData): Promise<void> {
    const directory = path.dirname(this.filePath);
    try {
      await mkdir(directory, { recursive: true });
      const temp = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
      await writeFile(temp, JSON.stringify(data, null, 2), 'utf8');
      await rename(temp, this.filePath);
    } catch (error) {
      throw new StorageError(
        `Could not write to ${this.filePath}. ` +
          'On Vercel set DATABASE_URL (or use DATA_FILE_PATH pointing at a writable volume).',
        error,
      );
    }
  }

  /**
   * Read-modify-write under a mutex. The mutator may return a new state or mutate in place.
   */
  async update<T>(mutator: (data: StoreData) => T): Promise<T> {
    const run = async (): Promise<T> => {
      const data = await this.read();
      const result = mutator(data);
      await this.writeData(data);
      return result;
    };

    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }

  /** Read-only helpers that do not need the write mutex. */
  async snapshot(): Promise<StoreData> {
    return this.read();
  }
}
