import { SettingsTabs } from '@/components/settings/SettingsTabs';
import { getStats } from '@/lib/services/internship-service';
import { listSearchProviders } from '@/lib/services/search-service';
import { getSettings, listClassifications } from '@/lib/services/settings-service';

export const dynamic = 'force-dynamic';

/**
 * Settings. The page only loads the current values; every edit happens in the client forms
 * against the settings/classifications APIs, which validate before persisting.
 */
export default async function SettingsPage() {
  const [settings, values, stats, providers] = await Promise.all([
    getSettings(),
    listClassifications(),
    getStats(),
    listSearchProviders(),
  ]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl">Settings</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-600">
          Your evaluation profile, the classification registry, the LLM provider and the discovery
          sources. Stored settings win over environment variables at runtime; secrets never leave
          the server.
        </p>
      </header>

      <SettingsTabs settings={settings} values={values} demoCount={stats.demoCount} providers={providers} />
    </div>
  );
}
