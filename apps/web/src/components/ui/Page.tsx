import type { ReactNode, ComponentType } from 'react';

/* ─────────────────────────────────────────────────────────────────────────────
   Page-level design system. Every screen uses these so headers, cards, buttons
   and badges look identical across the app.
──────────────────────────────────────────────────────────────────────────── */

type IconType = ComponentType<{ size?: number; className?: string }>;

/** Outer wrapper: consistent gutters and max width. `wide` for tables/dashboards. */
export function PageShell({ children, wide = false, narrow = false, className = '' }: {
  children: ReactNode; wide?: boolean; narrow?: boolean; className?: string;
}) {
  const width = narrow ? 'max-w-3xl' : wide ? 'max-w-7xl' : 'max-w-6xl';
  return <div className={`${width} w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-5 ${className}`}>{children}</div>;
}

/** Title row. Sits at the top of every page under the app top bar. */
export function PageHeader({ title, subtitle, icon: Icon, actions, meta }: {
  title: string; subtitle?: ReactNode; icon?: IconType; actions?: ReactNode; meta?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {Icon && <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><Icon size={18} /></div>}
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900 leading-tight truncate">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
          {meta && <div className="mt-1">{meta}</div>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = '', padded = false }: { children: ReactNode; className?: string; padded?: boolean }) {
  return <section className={`bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm ${padded ? 'p-5 sm:p-6' : ''} ${className}`}>{children}</section>;
}

const TONES: Record<string, string> = {
  gray: 'bg-gray-100 text-gray-600', blue: 'bg-blue-50 text-blue-600', emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600', red: 'bg-red-50 text-red-600', violet: 'bg-violet-50 text-violet-600',
  orange: 'bg-orange-50 text-orange-600', pink: 'bg-pink-50 text-pink-600',
};
export type Tone = keyof typeof TONES;

export function CardHead({ title, subtitle, icon: Icon, tone = 'gray', action }: {
  title: string; subtitle?: ReactNode; icon?: IconType; tone?: Tone; action?: ReactNode;
}) {
  return (
    <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
      <div className="flex items-center gap-3 min-w-0">
        {Icon && <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${TONES[tone]}`}><Icon size={15} /></div>}
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-gray-900 leading-tight truncate">{title}</h2>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5 truncate">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

/** Summary tile used in KPI rows. */
export function StatCard({ label, value, sub, icon: Icon, tone = 'blue', onClick }: {
  label: string; value: ReactNode; sub?: ReactNode; icon?: IconType; tone?: Tone; onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className={`text-left bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm p-4 ${onClick ? 'hover:ring-blue-300 hover:shadow-md transition' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-500">{label}</p>
        {Icon && <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${TONES[tone]}`}><Icon size={15} /></div>}
      </div>
      <p className="text-2xl font-bold text-gray-900 tabular-nums leading-none">{value}</p>
      {sub && <p className="text-[11px] text-gray-500 mt-2">{sub}</p>}
    </Tag>
  );
}

const BADGE: Record<string, string> = {
  gray: 'bg-gray-100 text-gray-600', blue: 'bg-blue-50 text-blue-700', emerald: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700', red: 'bg-red-50 text-red-700', violet: 'bg-violet-50 text-violet-700',
  orange: 'bg-orange-50 text-orange-700', pink: 'bg-pink-50 text-pink-700',
};
export function Badge({ tone = 'gray', children, className = '' }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${BADGE[tone]} ${className}`}>{children}</span>;
}

/* Button class strings — use directly on <button> / <a> so existing handlers stay untouched. */
export const btn = {
  primary: 'inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-600/20 disabled:opacity-40 disabled:cursor-not-allowed transition',
  secondary: 'inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 bg-white ring-1 ring-gray-200 hover:bg-gray-50 disabled:opacity-40 transition',
  ghost: 'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-40 transition',
  danger: 'inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-red-700 bg-red-50 ring-1 ring-red-200 hover:bg-red-100 disabled:opacity-40 transition',
  success: 'inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-600/20 disabled:opacity-40 transition',
};

/** Wrapper class strings for pages that keep their own outer <div>. */
export const shell = {
  wide:    'max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6',
  default: 'max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6',
  narrow:  'max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6',
};

export const inputCls ='w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-white text-gray-900 placeholder:text-gray-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition';

/** Horizontal pill tabs used for page sections and status filters. */
export function PillTabs<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void; options: Array<{ value: T; label: ReactNode; count?: number }>;
}) {
  return (
    <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button key={o.value} onClick={() => onChange(o.value)}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-sm font-medium transition ${active ? 'bg-gray-900 text-white' : 'bg-white ring-1 ring-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {o.label}
            {o.count !== undefined && <span className={`text-[11px] px-1.5 py-0.5 rounded-full tabular-nums ${active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
