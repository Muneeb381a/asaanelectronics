function Sk({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-100 rounded-lg ${className}`} />;
}

/** Mimics table rows — use inside an existing table container */
export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-gray-100">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-4 py-3.5 flex items-center gap-4">
          <Sk className="h-4 w-28 shrink-0" />
          {Array.from({ length: cols - 2 }).map((_, j) => (
            <Sk key={j} className="h-4 flex-1" />
          ))}
          <Sk className="h-4 w-20 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/** Mimics a bordered card with a title line + body lines */
export function CardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white border border-gray-100 rounded-2xl p-4 space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <Sk className="h-4 w-32" />
        <Sk className="h-5 w-16 rounded-full" />
      </div>
      <Sk className="h-3 w-full" />
      <Sk className="h-3 w-3/4" />
    </div>
  );
}

/** Mimics a vertical list of rows (payment history, notes, etc.) */
export function RowSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
          <Sk className="h-4 w-20 shrink-0" />
          <Sk className="h-4 flex-1" />
          <Sk className="h-4 w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/** Simple block — use for one-off shapes */
export function BlockSkeleton({ className = '' }: { className?: string }) {
  return <Sk className={className} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="text-gray-300 mb-3">{icon}</div>
      <p className="text-sm font-medium text-gray-500">{title}</p>
      {description && <p className="text-xs text-gray-400 mt-1">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
