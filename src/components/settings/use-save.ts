'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useToast } from '@/components/ui/ToastProvider';
import { apiFetch, errorMessageOf } from '@/lib/client/api';

/**
 * Shared save flow for the settings forms: PUT the patch, toast the outcome (the server's
 * message verbatim on failure) and refresh the server rendered page.
 */
export function useSave() {
  const router = useRouter();
  const { push } = useToast();
  const [saving, setSaving] = useState(false);

  async function save(url: string, json: unknown, message: string, method: string = 'PUT'): Promise<boolean> {
    setSaving(true);
    try {
      await apiFetch(url, { method, json });
      push({ tone: 'success', title: message });
      router.refresh();
      return true;
    } catch (error) {
      push({ tone: 'error', title: 'Save failed', description: errorMessageOf(error) });
      return false;
    } finally {
      setSaving(false);
    }
  }

  return { saving, save };
}
