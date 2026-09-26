# Internship Scout

Discover, normalize, evaluate and shortlist internship opportunities — a self-hosted platform
built with **Next.js (App Router) + TypeScript + Tailwind CSS**, deployable to Vercel with zero
configuration.

**The workflow**

1. **Discover** — search job boards and the open web from one console (`/search`), preview how
   every result is normalized, and see duplicates before importing anything.
2. **Review** — filter, sort and paginate the catalogue (`/internships`), edit records by hand,
   and act on selections in bulk.
3. **Evaluate** — score each posting against your personal profile with the free
   [Pollinations.ai](https://pollinations.ai) LLM (no API key required), or the deterministic
   offline fallback. The model only provides per-criterion scores and prose; the final score is
   always computed server-side with your weights.
4. **Shortlist** — status workflows, manual score overrides and a dashboard with the best
   matches so far.

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
```

That is genuinely all: the app boots with an empty JSON store (`.data/db.json`), public job-board
APIs and the anonymous Pollinations tier. Open **Dashboard → Load demo data** (or Settings → Data)
to explore the workflow with realistic sample records.

```bash
npm run verify     # typecheck + lint + tests + production build
```

| Script | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (flat config, `eslint.config.mjs`) |
| `npm test` / `npm run test:watch` | Vitest unit tests |
| `npm run verify` | Everything above, in order |

---

## Architecture

Strict layering; dependencies only point downwards:

```
UI (server components + small client islands)
  → services (internship, evaluation, search, settings)
    → domain (types, schemas, normalize, dedupe, filter, score, classifications, stats)
      → providers (search providers, AI providers) + persistence (JSON / Postgres)
        → route handlers (/api/**) — thin: parse, call service, serialize
```

Key properties:

- **URL is state.** Filtering, sorting and pagination live entirely in the query string, so any
  view is shareable and the list page stays a server component.
- **Normalization is centralized.** Every record — scraped, imported or manual — flows through
  `normalizeCandidate`, which cleans text, derives classification values from the configurable
  registry, canonicalises URLs and computes dedupe keys.
- **Deduplication on four signals**, strongest first: canonical URL → source id → URL key →
  `company|title|location` fingerprint (also collapsed *within* an import batch).
- **Scores are ours, prose is the model's.** `evaluationResponseSchema` (Zod) validates the model
  output — one repair attempt, then a failure is recorded on the record and the batch continues.
  `computeEvaluationScore` then applies your criterion weights and clamps every value to 0–100.
- **Configurable classifications.** Company types, regions, work modes, statuses, technologies…
  are data, not enums. Settings → Classifications edits the registry; removing a value prunes it
  from stored records (statuses are always kept readable).
- **Bounded AI usage.** Batches are capped at 25 ids per request with a hard concurrency cap of 4
  and a configurable minimum delay, so the free Pollinations tier is never flooded.

### Layout

```
src/
├── app/                  # App Router pages + API route handlers
│   ├── page.tsx          # dashboard
│   ├── internships/      # list (filters, table, bulk actions) + [id] detail
│   ├── search/           # discovery console
│   ├── settings/         # profile, classifications, AI, search, data
│   └── api/              # thin HTTP layer over the services
├── components/           # UI primitives + feature components
├── lib/
│   ├── domain/           # pure business logic (no I/O)
│   ├── services/         # orchestration: domain + persistence + providers
│   ├── search/           # search provider abstraction + registry
│   ├── ai/               # evaluation providers (pollinations, heuristic)
│   ├── persistence/      # JSON file store / Postgres store
│   └── util/             # text, url, rate limit, search params helpers
└── test-support/         # factories shared by the unit tests
```

---

## Configuration

Everything is optional — see [`.env.example`](./.env.example) for the annotated list.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` (or `POSTGRES_URL`) | Postgres connection string (Neon, Supabase, Vercel Postgres…). Without it, a local JSON file is used. |
| `DATA_FILE_PATH` | Override the JSON store location (default `./.data/db.json`). |
| `POLLINATIONS_API_KEY` | Optional key for the paid Pollinations tier. Server-side only. |
| `POLLINATIONS_BASE_URL` / `POLLINATIONS_MODEL` | Point the evaluator at another OpenAI-compatible endpoint or model. |
| `AI_PROVIDER` | `pollinations` (default) or `heuristic` (fully offline). |
| `TAVILY_API_KEY` | Enables the open-web search provider in the search console. |
| `SEED_DEMO_DATA` | Seed demo records automatically when the store is empty. |
| `APP_CONTACT` | Contact string sent to providers that ask for one (not a secret). |

**Precedence rules**

- Stored settings (editable in the UI) are authoritative at runtime — what Settings shows is
  what the server uses.
- Environment variables influence values only when settings are created for the first time, and
  provide **secrets** (API keys), which are never stored in the database.

### Storage on Vercel

- No database: the JSON driver writes to `/tmp` and the app shows a banner — data survives
  between requests but not between function instances. Fine for a trial run.
- For persistence, set `DATABASE_URL` to any Postgres; the store switches automatically.

---

## Search providers

Providers only ever return *raw candidates*; normalization, classification and duplicate
detection happen afterwards in the domain layer. Ground rules for new providers:

1. only call documented, public HTTP APIs — no HTML scraping
2. send a descriptive contact/referrer when the API asks for one
3. respect the provider's rate limits
4. never throw raw errors: raise an `AppError` with a user-readable message

Enabled providers are configured in Settings → Search; unavailable ones (missing API key) are
disabled with the reason shown.

---

## API overview

| Endpoint | Purpose |
| --- | --- |
| `GET/POST /api/internships` | Filtered list / create by hand |
| `GET/PATCH/DELETE /api/internships/[id]` | Read, edit, delete one record |
| `POST /api/internships/import` | Import normalized candidates (validated again server-side) |
| `POST /api/internships/bulk` | Batch status / shortlist / reject / clear / delete |
| `POST /api/evaluate` | Evaluate up to 25 records per request |
| `GET/POST /api/search` | Provider list / run a discovery search |
| `GET/PUT/DELETE /api/settings` | Read / patch / reset settings |
| `GET/PUT/DELETE /api/classifications` | Registry + usage counts / replace / reset |
| `POST /api/seed`, `/api/maintenance/reclassify` | Demo data, re-classification |
| `GET /api/stats`, `/api/health` | Statistics, health probe |

Errors always answer `{ "error": { "code", "message", "retryable" } }` and are rendered verbatim
in the UI.

---

## Deploying to Vercel

1. Push this repository to GitHub/GitLab and import it in Vercel (framework preset: **Next.js**),
   or run `vercel` from the project root with the [Vercel CLI](https://vercel.com/docs/cli).
2. Optionally set `DATABASE_URL` (and any secrets) under Project Settings → Environment Variables.
3. Deploy — no build configuration is needed (`next build` runs as-is).

---

## Notes

- External content is untrusted: listings are stored as plain text, links are validated
  (`isSafeExternalUrl`) and AI output is schema-checked before it is saved.
- Fonts load from the Google Fonts CDN with system fallbacks declared in `globals.css`, so the
  build never depends on a network fetch.
- External libraries, where used, are loaded via CDN links; the runtime dependency set is small
  on purpose (`next`, `react`, `zod`, `pg`).

