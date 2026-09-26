import type { Metadata } from 'next';

import { AppShell } from '@/components/layout/AppShell';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { getRepositories } from '@/lib/persistence';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Internship Scout',
    template: '%s · Internship Scout',
  },
  description:
    'Discover internship opportunities, normalize them into a consistent structure and rank them with an LLM evaluation profile.',
};

/**
 * Fonts come from the Google Fonts CDN (with system fallbacks declared in globals.css) so the
 * build never depends on a network fetch and the app degrades gracefully offline.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Storage info is cheap to read (cached per server instance) and powers the warning banner.
  const info = await getRepositories()
    .then((repositories) => repositories.info)
    .catch(() => null);

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- App Router has no _document; fonts are CDN linked once in the root layout */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Source+Serif+4:opsz,wght@8..60,400;8..60,500;8..60,600&display=swap"
        />
      </head>
      <body>
        <ToastProvider>
          <AppShell storageInfo={info}>{children}</AppShell>
        </ToastProvider>
      </body>
    </html>
  );
}
