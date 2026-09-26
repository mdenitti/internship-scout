'use client';

import { useState } from 'react';

import { AiSettingsForm } from '@/components/settings/AiSettingsForm';
import { ClassificationsEditor } from '@/components/settings/ClassificationsEditor';
import { DataPanel } from '@/components/settings/DataPanel';
import { ProfileForm } from '@/components/settings/ProfileForm';
import { SearchSettingsForm } from '@/components/settings/SearchSettingsForm';
import type { AppSettings, ClassificationValue } from '@/lib/domain/types';
import type { ProviderStatus } from '@/lib/search/registry';

const TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'classifications', label: 'Classifications' },
  { id: 'ai', label: 'AI evaluation' },
  { id: 'search', label: 'Search' },
  { id: 'data', label: 'Data' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/** Tabbed settings layout: one panel at a time, each panel owns its own save button. */
export function SettingsTabs({
  settings,
  values,
  demoCount,
  providers,
}: {
  settings: AppSettings;
  values: ClassificationValue[];
  demoCount: number;
  providers: ProviderStatus[];
}) {
  const [tab, setTab] = useState<TabId>('profile');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1 border-b border-cream-300 pb-px">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setTab(entry.id)}
            className={`-mb-px border-b-2 px-3.5 py-2 text-sm transition-colors ${
              tab === entry.id
                ? 'border-clay-500 font-medium text-ink-900'
                : 'border-transparent text-ink-600 hover:text-ink-900'
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {tab === 'profile' ? <ProfileForm settings={settings} /> : null}
      {tab === 'classifications' ? <ClassificationsEditor values={values} /> : null}
      {tab === 'ai' ? <AiSettingsForm settings={settings} /> : null}
      {tab === 'search' ? <SearchSettingsForm settings={settings} providers={providers} /> : null}
      {tab === 'data' ? <DataPanel settings={settings} demoCount={demoCount} /> : null}
    </div>
  );
}
