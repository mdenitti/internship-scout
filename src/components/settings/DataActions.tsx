'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/ToastProvider';
import { apiFetch, errorMessageOf } from '@/lib/client/api';

/**
 * Demo data + maintenance actions. Small on purpose: the dashboard and the Settings → Data tab
 * both use it, and every action reports exactly what happened through the toast system.
 */
export function DataActions({ demoCount }: { demoCount: number }) {
  const router = useRouter();
  const { push } = useToast();
  const [pending, setPending] = useState<string | null>(null);

  async function run(key: string, action: () => Promise<string>) {
    setPending(key);
    try {
      const message = await action();
      push({ tone: 'success', title: message });
      router.refresh();
    } catch (error) {
      push({ tone: 'error', title: 'Action failed', description: errorMessageOf(error) });
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="primary"
        loading={pending === 'seed'}
        onClick={() =>
          run('seed', async () => {
            const result = await apiFetch<{ importedCount: number; duplicates: number; evaluated: number }>(
              '/api/seed',
              { method: 'POST' },
            );
            return `Added ${result.importedCount} demo internships (${result.evaluated} pre-scored).`;
          })
        }
      >
        Load demo data
      </Button>

      <Button
        variant="secondary"
        disabled={demoCount === 0}
        loading={pending === 'remove'}
        onClick={() =>
          run('remove', async () => {
            const result = await apiFetch<{ removed: number }>('/api/seed', { method: 'DELETE' });
            return `Removed ${result.removed} demo internships.`;
          })
        }
      >
        Remove demo data{demoCount > 0 ? ` (${demoCount})` : ''}
      </Button>

      <Button
        variant="ghost"
        loading={pending === 'reclassify'}
        title="Re-derive region, work mode and internship type from the stored text using the current classifications."
        onClick={() =>
          run('reclassify', async () => {
            const result = await apiFetch<{ reclassified: number; prunedRecords: number }>(
              '/api/maintenance/reclassify',
              { method: 'POST' },
            );
            return `Re-classified ${result.reclassified} internships (${result.prunedRecords} had obsolete values).`;
          })
        }
      >
        Re-classify all
      </Button>
    </div>
  );
}
