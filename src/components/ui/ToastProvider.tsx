'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

/**
 * Minimal toast system: enough for "imported 7 internships" style feedback without pulling
 * in a dependency. Toasts are announced politely for screen readers.
 */

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastContextValue {
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id'>) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_STYLES: Record<ToastTone, string> = {
  info: 'border-cream-400 bg-surface text-ink-900',
  success: 'border-sage-500/40 bg-sage-100 text-sage-700',
  warning: 'border-sand-500/40 bg-sand-100 text-sand-700',
  error: 'border-clay-500/40 bg-clay-50 text-clay-700',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((current) => [...current.slice(-3), { ...toast, id }]);
      const ttl = toast.tone === 'error' ? 9000 : 5000;
      setTimeout(() => dismiss(id), ttl);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toasts, push, dismiss }), [toasts, push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-[min(24rem,calc(100vw-2.5rem))] flex-col gap-2"
        role="status"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-xl border px-4 py-3 text-sm shadow-sm ${TONE_STYLES[toast.tone]}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{toast.title}</p>
                {toast.description ? <p className="mt-0.5 text-xs opacity-80">{toast.description}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="rounded px-1 text-xs opacity-60 hover:opacity-100"
                aria-label="Dismiss notification"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}
