import type { ReactNode } from 'react';

import type { ClassificationColor } from '@/lib/domain/types';

export function Card({
  children,
  className = '',
  as: Tag = 'section',
}: {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'article' | 'div' | 'aside';
}) {
  return <Tag className={`card p-5 ${className}`}>{children}</Tag>;
}

export function CardHeader({
  title,
  description,
  action,
  className = '',
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-4 flex items-start justify-between gap-4 ${className}`}>
      <div>
        <h2 className="text-base font-medium">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-ink-600">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

const COLOR_STYLES: Record<ClassificationColor, string> = {
  terracotta: 'bg-clay-100 text-clay-700 border-clay-400/40',
  sage: 'bg-sage-100 text-sage-700 border-sage-500/40',
  sky: 'bg-sky-100 text-sky-700 border-sky-500/40',
  sand: 'bg-sand-100 text-sand-700 border-sand-500/40',
  plum: 'bg-plum-100 text-plum-700 border-plum-500/40',
  slate: 'bg-cream-200 text-ink-700 border-cream-400',
};

export function Badge({
  children,
  color = 'slate',
  title,
  className = '',
}: {
  children: ReactNode;
  color?: ClassificationColor | string;
  title?: string;
  className?: string;
}) {
  const style = COLOR_STYLES[(color as ClassificationColor) ?? 'slate'] ?? COLOR_STYLES.slate;
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-5 ${style} ${className}`}
    >
      {children}
    </span>
  );
}

const MATCH_LEVEL_COLORS: Record<string, ClassificationColor> = {
  high: 'sage',
  medium: 'sky',
  low: 'sand',
  poor: 'slate',
};

export function MatchLevelBadge({ level, label }: { level: string | null; label?: string }) {
  if (!level) return <Badge color="slate">not scored</Badge>;
  return <Badge color={MATCH_LEVEL_COLORS[level] ?? 'slate'}>{label ?? level}</Badge>;
}

export function StatusBadge({ status, label, color }: { status: string; label?: string; color?: string }) {
  if (!status) return null;
  return <Badge color={color ?? 'slate'}>{label ?? status}</Badge>;
}

export function DemoBadge() {
  return (
    <Badge color="sand" title="Sample data seeded for demonstration. Remove it from Settings → Data.">
      demo
    </Badge>
  );
}
