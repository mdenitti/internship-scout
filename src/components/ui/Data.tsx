import type { ReactNode } from 'react';

import type { InternshipStats } from '@/lib/domain/types';

/**
 * Presentation helpers for scores and statistics. Everything here is deterministic and
 * server-renderable, so the dashboard renders without client JavaScript.
 */

export function ScoreMeter({
  score,
  label,
  max = 100,
  compact = false,
}: {
  score: number | null;
  label?: string;
  max?: number;
  compact?: boolean;
}) {
  if (score === null) {
    return <span className="text-xs text-ink-500">not scored</span>;
  }
  const percentage = Math.max(0, Math.min(100, (score / max) * 100));
  const tone = score >= 75 ? 'bg-sage-500' : score >= 55 ? 'bg-sky-500' : score >= 35 ? 'bg-sand-500' : 'bg-ink-500';

  return (
    <div className={compact ? 'w-24' : 'w-full'}>
      <div className="flex items-baseline justify-between gap-2">
        {label ? <span className="text-[11px] uppercase tracking-wide text-ink-600">{label}</span> : null}
        <span className="font-serif text-sm font-medium">{score}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-cream-300">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

export function ScorePill({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="inline-flex min-w-11 justify-center rounded-md bg-cream-200 px-1.5 py-0.5 text-xs text-ink-600">—</span>;
  }
  const tone =
    score >= 75
      ? 'bg-sage-100 text-sage-700'
      : score >= 55
        ? 'bg-sky-100 text-sky-700'
        : score >= 35
          ? 'bg-sand-100 text-sand-700'
          : 'bg-cream-200 text-ink-600';
  return (
    <span className={`inline-flex min-w-11 justify-center rounded-md px-1.5 py-0.5 font-serif text-sm font-medium ${tone}`}>
      {score}
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'default' | 'accent' | 'muted';
}) {
  const toneClass =
    tone === 'accent' ? 'text-clay-600' : tone === 'muted' ? 'text-ink-500' : 'text-ink-900';
  return (
    <div className="card px-4 py-3.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-600">{label}</p>
      <p className={`mt-1 font-serif text-2xl leading-tight ${toneClass}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-ink-500">{hint}</p> : null}
    </div>
  );
}

export function StatGrid({ stats, showDemoHint = true }: { stats: InternshipStats; showDemoHint?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <StatCard label="Total" value={stats.total} hint={showDemoHint && stats.demoCount > 0 ? `${stats.demoCount} demo records` : undefined} />
      <StatCard label="New (7 days)" value={stats.discoveredLast7Days} tone="accent" />
      <StatCard label="Evaluated" value={stats.evaluated} hint={stats.failed > 0 ? `${stats.failed} failed` : undefined} />
      <StatCard label="Shortlisted" value={stats.shortlisted} />
      <StatCard label="Rejected" value={stats.rejected} tone="muted" />
      <StatCard
        label="Avg score"
        value={stats.averageScore === null ? '—' : stats.averageScore}
        hint={stats.medianScore === null ? undefined : `median ${stats.medianScore}`}
      />
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-12 text-center">
      <h3 className="font-serif text-lg">{title}</h3>
      {description ? <p className="max-w-md text-sm text-ink-600">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function SimpleBarList({
  items,
  emptyLabel = 'No data yet',
}: {
  items: Array<{ label: string; count: number }>;
  emptyLabel?: string;
}) {
  const max = Math.max(1, ...items.map((item) => item.count));
  if (items.every((item) => item.count === 0)) {
    return <p className="text-sm text-ink-500">{emptyLabel}</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.label} className="text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-ink-700">{item.label}</span>
            <span className="font-medium text-ink-600">{item.count}</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-cream-200">
            <div className="h-full rounded-full bg-clay-400" style={{ width: `${(item.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
