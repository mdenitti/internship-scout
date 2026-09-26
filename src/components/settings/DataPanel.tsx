'use client';

import { useState } from 'react';

import { DataActions } from '@/components/settings/DataActions';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Form';
import type { AppSettings } from '@/lib/domain/types';
import { useSave } from './use-save';

/**
 * Data maintenance: demo catalogue, re-classification and the settings reset. Destructive
 * actions confirm first and report exactly what changed.
 */
export function DataPanel({ settings, demoCount }: { settings: AppSettings; demoCount: number }) {
  const { saving, save } = useSave();
  const [autoSeed, setAutoSeed] = useState(settings.general.autoSeedDemo);
  const [resetting, setResetting] = useState(false);

  async function resetSettings() {
    if (!window.confirm('Reset the profile, AI and search settings to their defaults? Stored internships are kept.')) {
      return;
    }
    setResetting(true);
    await save('/api/settings', undefined, 'Settings reset to defaults.', 'DELETE');
    setResetting(false);
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Demo data & maintenance"
          description="Demo records are clearly marked and can be removed at any time."
        />
        <DataActions demoCount={demoCount} />
      </Card>

      <Card>
        <CardHeader title="Start-up behaviour" />
        <Checkbox
          checked={autoSeed}
          onChange={(event) => setAutoSeed(event.target.checked)}
          label="Seed the demo catalogue automatically when the database is empty"
        />
        <div className="mt-3 flex justify-end">
          <Button
            variant="secondary"
            loading={saving}
            onClick={() => save('/api/settings', { general: { autoSeedDemo: autoSeed } }, 'Preference saved.')}
          >
            Save preference
          </Button>
        </div>
      </Card>

      <Card className="border border-clay-400/40">
        <CardHeader title="Danger zone" description="Settings reset cannot be undone. Internships and evaluations are not touched." />
        <div className="flex justify-end">
          <Button variant="danger" loading={resetting} onClick={resetSettings}>
            Reset settings
          </Button>
        </div>
      </Card>
    </div>
  );
}