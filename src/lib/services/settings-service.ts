import { envConfig } from '@/lib/config/env';
import {
  createDefaultAiSettings,
  createDefaultClassifications,
  createDefaultProfile,
  createDefaultSearchSettings,
  createDefaultSettings,
} from '@/lib/domain/defaults';
import { appSettingsSchema, classificationValueSchema, classificationsSchema } from '@/lib/domain/schema';
import type { AiSettings, AppSettings, ClassificationValue, SearchSettings } from '@/lib/domain/types';
import { AppError } from '@/lib/util/errors';
import { getRepositories } from '@/lib/persistence';

/**
 * Settings service.
 *
 * Precedence rules (documented in the README):
 *  - stored settings are authoritative at runtime, so what the Settings UI shows is what the
 *    server uses;
 *  - environment variables only influence the values used when settings are created for the
 *    first time, and they provide secrets (API keys) that are never stored in the database.
 */

export async function getSettings(): Promise<AppSettings> {
  const { settings } = await getRepositories();
  return settings.get();
}

/** Settings used for the very first run, taking environment defaults into account. */
export function seedSettingsFromEnv(): AppSettings {
  const env = envConfig();
  const ai: Partial<AiSettings> = {};
  if (env.pollinations.baseUrl) ai.baseUrl = env.pollinations.baseUrl;
  if (env.pollinations.model) ai.model = env.pollinations.model;
  if (env.pollinations.provider) ai.provider = env.pollinations.provider;

  const search: Partial<SearchSettings> = {};
  if (env.contact) search.contact = env.contact;

  return createDefaultSettings({
    profile: createDefaultProfile(),
    ai: { ...createDefaultAiSettings(), ...ai },
    search: { ...createDefaultSearchSettings(), ...search },
    general: { autoSeedDemo: env.seedDemoData },
  });
}

export interface SettingsPatch {
  profile?: Partial<AppSettings['profile']>;
  ai?: Partial<AiSettings>;
  search?: Partial<SearchSettings>;
  general?: Partial<AppSettings['general']>;
}

/**
 * Partial update: only the keys provided are replaced, then the merged result is validated as
 * a whole, so an inconsistent combination can never be persisted.
 */
export async function updateSettings(patch: SettingsPatch): Promise<AppSettings> {
  const { settings } = await getRepositories();
  const current = await settings.get();

  const merged: AppSettings = {
    profile: { ...current.profile, ...(patch.profile ?? {}), updatedAt: new Date().toISOString() },
    ai: { ...current.ai, ...(patch.ai ?? {}) },
    search: { ...current.search, ...(patch.search ?? {}) },
    general: { ...current.general, ...(patch.general ?? {}) },
    updatedAt: new Date().toISOString(),
  };

  const parsed = appSettingsSchema.safeParse(merged);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new AppError(
      'VALIDATION_FAILED',
      `Settings were rejected: ${issue ? `${issue.path.join('.')} ${issue.message}` : 'invalid shape'}`,
      { details: parsed.error.issues },
    );
  }
  return settings.save(parsed.data as AppSettings);
}

export async function resetSettings(): Promise<AppSettings> {
  const { settings } = await getRepositories();
  return settings.save(seedSettingsFromEnv());
}

// ── Classifications ─────────────────────────────────────────────────────────────────────

export async function listClassifications(): Promise<ClassificationValue[]> {
  const { classifications } = await getRepositories();
  return classifications.list();
}

function assertUniqueIds(values: readonly ClassificationValue[]): void {
  const seen = new Map<string, string>();
  for (const value of values) {
    const key = `${value.kind}:${value.id}`;
    const previous = seen.get(key);
    if (previous) {
      throw new AppError(
        'VALIDATION_FAILED',
        `Duplicate classification "${value.id}" in "${value.kind}" ("${previous}" already uses it).`,
      );
    }
    seen.set(key, value.label);
  }
}

/** Replace the whole registry: the settings editor saves the list as a unit. */
export async function replaceClassifications(input: unknown): Promise<ClassificationValue[]> {
  const parsed = classificationsSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new AppError(
      'VALIDATION_FAILED',
      `Classification list is invalid: ${issue ? `${issue.path.join('.')} ${issue.message}` : 'invalid shape'}`,
      { details: parsed.error.issues },
    );
  }
  const values = parsed.data.values as ClassificationValue[];
  assertUniqueIds(values);
  const { classifications } = await getRepositories();
  return classifications.saveAll(values);
}

export async function resetClassifications(): Promise<ClassificationValue[]> {
  const { classifications } = await getRepositories();
  return classifications.saveAll(createDefaultClassifications());
}

export async function createClassification(input: unknown): Promise<ClassificationValue[]> {
  const parsed = classificationValueSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new AppError(
      'VALIDATION_FAILED',
      `Classification is invalid: ${issue ? `${issue.path.join('.')} ${issue.message}` : 'unknown'}`,
    );
  }
  const value = parsed.data as ClassificationValue;
  const current = await listClassifications();
  if (current.some((entry) => entry.kind === value.kind && entry.id === value.id)) {
    throw new AppError('CONFLICT', `"${value.id}" already exists for ${value.kind}.`);
  }
  return replaceClassifications({ values: [...current, value] });
}

export async function deleteClassification(kind: string, id: string): Promise<ClassificationValue[]> {
  const current = await listClassifications();
  const next = current.filter((value) => !(value.kind === kind && value.id === id));
  if (next.length === current.length) {
    throw new AppError('NOT_FOUND', `No "${id}" value found for ${kind}.`);
  }
  return replaceClassifications({ values: next });
}
