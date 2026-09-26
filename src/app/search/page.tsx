import { SearchConsole } from '@/components/search/SearchConsole';
import { listSearchProviders } from '@/lib/services/search-service';
import { getSettings, listClassifications } from '@/lib/services/settings-service';

export const dynamic = 'force-dynamic';

/**
 * Discovery console. The page only assembles the provider list and classification registry;
 * everything interactive (query form, preview, import) lives in the client console.
 */
export default async function SearchPage() {
  const [providers, values, settings] = await Promise.all([
    listSearchProviders(),
    listClassifications(),
    getSettings(),
  ]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl">Discover internships</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-600">
          Query the enabled providers, preview how each result is normalized (and whether it is a
          duplicate), then import the ones you want. Keywords and provider settings come from
          Settings → Search.
        </p>
      </header>

      <SearchConsole providers={providers} values={values} settings={settings} />
    </div>
  );
}
