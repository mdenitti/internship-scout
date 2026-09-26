'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { ThemeToggle } from '@/components/ui/ThemeToggle';
import type { StoreInfo } from '@/lib/persistence/types';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard' },
  { href: '/internships', label: 'Internships' },
  { href: '/search', label: 'Discover' },
  { href: '/settings', label: 'Settings' },
];

/**
 * Application chrome: an understated top bar with the wordmark, primary navigation and a
 * storage indicator, plus the (rare) storage warning banner.
 */
export function AppShell({ children, storageInfo }: { children: ReactNode; storageInfo: StoreInfo | null }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-cream-300 bg-cream-100/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-5 py-3">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="font-serif text-lg font-semibold tracking-tight">Internship Scout</span>
            <span className="hidden text-[11px] uppercase tracking-[0.14em] text-ink-500 sm:inline">
              discover · evaluate · shortlist
            </span>
          </Link>

          <nav className="ml-auto flex items-center gap-1 text-sm">
            {NAV_ITEMS.map((item) => {
              const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-3 py-1.5 transition-colors ${
                    active ? 'bg-surface text-ink-900 shadow-sm' : 'text-ink-600 hover:bg-cream-200'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <ThemeToggle className="ml-1" />
          </nav>

          {storageInfo ? (
            <span
              className={`hidden rounded-full border px-2.5 py-1 text-[11px] md:inline ${
                storageInfo.persistent
                  ? 'border-cream-400 text-ink-600'
                  : 'border-clay-400/50 bg-clay-50 text-clay-700'
              }`}
              title={storageInfo.note ?? `Storage: ${storageInfo.driver} (${storageInfo.location})`}
            >
              storage: {storageInfo.driver}
              {storageInfo.persistent ? '' : ' · ephemeral'}
            </span>
          ) : null}
        </div>
      </header>

      {storageInfo && !storageInfo.persistent ? (
        <div className="border-b border-clay-400/40 bg-clay-50 px-5 py-2 text-center text-xs text-clay-700">
          {storageInfo.note ??
            'Data is stored without persistence in this deployment. Configure DATABASE_URL to keep internships between restarts.'}
        </div>
      ) : null}

      <main className="mx-auto max-w-7xl px-5 py-7">{children}</main>

      <footer className="mx-auto max-w-7xl px-5 pb-10 pt-4 text-[11px] text-ink-500">
        External content is untrusted: listings are stored as plain text, links are validated and AI
        output is schema checked before it is saved.
      </footer>
    </div>
  );
}
