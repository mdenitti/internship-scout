import { createDefaultClassifications, createDefaultSettings } from '@/lib/domain/defaults';
import type { AppSettings, ClassificationValue, Internship } from '@/lib/domain/types';
import type {
  ClassificationRepository,
  InternshipQuery,
  InternshipRepository,
  SettingsRepository,
} from './types';
import { JsonFileStore, type StoreData } from './json-repository';

/**
 * Repository implementations backed by the JSON file store. The `update()` call runs the
 * whole read-modify-write cycle under the store mutex, which makes these safe to use from
 * concurrent requests.
 */

export class JsonInternshipRepository implements InternshipRepository {
  constructor(private readonly store: JsonFileStore) {}

  async list(query: InternshipQuery = {}): Promise<Internship[]> {
    const data = await this.store.snapshot();
    let items = data.internships;
    if (query.ids) {
      const wanted = new Set(query.ids);
      items = items.filter((internship) => wanted.has(internship.id));
    }
    if (query.source) {
      items = items.filter((internship) => internship.source === query.source);
    }
    return items.map(clone);
  }

  async get(id: string): Promise<Internship | null> {
    const data = await this.store.snapshot();
    const found = data.internships.find((internship) => internship.id === id);
    return found ? clone(found) : null;
  }

  async upsertMany(internships: readonly Internship[]): Promise<void> {
    if (internships.length === 0) return;
    await this.store.update((data) => {
      for (const internship of internships) {
        upsertInto(data, internship);
      }
    });
  }

  async delete(id: string): Promise<boolean> {
    const removed = await this.store.update((data) => {
      const before = data.internships.length;
      data.internships = data.internships.filter((internship) => internship.id !== id);
      return before !== data.internships.length;
    });
    return removed;
  }

  async deleteMany(ids: readonly string[]): Promise<number> {
    if (ids.length === 0) return 0;
    return this.store.update((data) => {
      const wanted = new Set(ids);
      const before = data.internships.length;
      data.internships = data.internships.filter((internship) => !wanted.has(internship.id));
      return before - data.internships.length;
    });
  }

  async deleteDemo(): Promise<number> {
    return this.store.update((data) => {
      const before = data.internships.length;
      data.internships = data.internships.filter((internship) => !internship.isDemo);
      return before - data.internships.length;
    });
  }

  async count(): Promise<number> {
    const data = await this.store.snapshot();
    return data.internships.length;
  }
}

export class JsonSettingsRepository implements SettingsRepository {
  constructor(private readonly store: JsonFileStore) {}

  async get(): Promise<AppSettings> {
    const data = await this.store.snapshot();
    if (data.settings) return data.settings;
    return this.save(createDefaultSettings());
  }

  async save(settings: AppSettings): Promise<AppSettings> {
    return this.store.update((data) => {
      data.settings = settings;
      return settings;
    });
  }
}

export class JsonClassificationRepository implements ClassificationRepository {
  constructor(private readonly store: JsonFileStore) {}

  async list(): Promise<ClassificationValue[]> {
    const data = await this.store.snapshot();
    if (data.classifications.length > 0) return data.classifications;
    return this.saveAll(createDefaultClassifications());
  }

  async saveAll(values: readonly ClassificationValue[]): Promise<ClassificationValue[]> {
    const list = [...values];
    await this.store.update((data) => {
      data.classifications = list;
    });
    return list;
  }
}

function upsertInto(data: StoreData, internship: Internship): void {
  const index = data.internships.findIndex((existing) => existing.id === internship.id);
  if (index >= 0) {
    data.internships[index] = internship;
    return;
  }
  data.internships.push(internship);
}

function clone(internship: Internship): Internship {
  return structuredClone(internship);
}
