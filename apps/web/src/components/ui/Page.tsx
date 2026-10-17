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
        {Icon && <div className="w-10 h-10 rounded-xl bg-linear-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-600/20"><Icon size={18} /></div>}
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900 leading-tight truncate tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
          {meta && <div className="mt-1">{meta}</div>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = '', padded = false }: { children: ReactNode; className?: string; padded?: boolean }) {
  return <section className={`bg-white rounded-2xl ring-1 ring-gray-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_20px_-14px_rgba(15,23,42,0.12)] transition-shadow hover:shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_28px_-14px_rgba(15,23,42,0.16)] ${padded ? 'p-5 sm:p-6' : ''} ${className}`}>{children}</section>;
}

const TONES: Record<string, string> = {
  gray:    'bg-linear-to-br from-gray-100 to-gray-200 text-gray-600',
  blue:    'bg-linear-to-br from-blue-50 to-blue-100 text-blue-600',
  emerald: 'bg-linear-to-br from-emerald-50 to-emerald-100 text-emerald-600',
  amber:   'bg-linear-to-br from-amber-50 to-amber-100 text-amber-600',
  red:     'bg-linear-to-br from-red-50 to-red-100 text-red-600',
  violet:  'bg-linear-to-br from-violet-50 to-violet-100 text-violet-600',
  orange:  'bg-linear-to-br from-orange-50 to-orange-100 text-orange-600',
  pink:    'bg-linear-to-br from-pink-50 to-pink-100 text-pink-600',
};
export type Tone = keyof typeof TONES;

export function CardHead({ title, subtitle, icon: Icon, tone = 'gray', action }: {
  title: string; subtitle?: ReactNode; icon?: IconType; tone?: Tone; action?: ReactNode;
}) {
  return (
    <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
      <div className="flex items-center gap-3 min-w-0">
        {Icon && <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ring-1 ring-black/[0.03] ${TONES[tone]}`}><Icon size={16} /></div>}
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-gray-900 leading-tight truncate">{title}</h2>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5 truncate">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

const STAT_ICON_TONES: Record<string, string> = {
  gray:    'bg-linear-to-br from-gray-600 to-gray-800 text-white',
  blue:    'bg-linear-to-br from-blue-500 to-blue-700 text-white',
  emerald: 'bg-linear-to-br from-emerald-500 to-emerald-700 text-white',
  amber:   'bg-linear-to-br from-amber-400 to-amber-600 text-white',
  red:     'bg-linear-to-br from-red-500 to-red-700 text-white',
  violet:  'bg-linear-to-br from-violet-500 to-violet-700 text-white',
  orange:  'bg-linear-to-br from-orange-500 to-orange-700 text-white',
  pink:    'bg-linear-to-br from-pink-500 to-pink-700 text-white',
};
const STAT_WASH_TONES: Record<string, string> = {
  gray: 'from-gray-100/60', blue: 'from-blue-50/60', emerald: 'from-emerald-50/60', amber: 'from-amber-50/60',
  red: 'from-red-50/60', violet: 'from-violet-50/60', orange: 'from-orange-50/60', pink: 'from-pink-50/60',
};

/** Summary tile used in KPI rows. */
export function StatCard({ label, value, sub, icon: Icon, tone = 'blue', onClick }: {
  label: string; value: ReactNode; sub?: ReactNode; icon?: IconType; tone?: Tone; onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className={`text-left bg-linear-to-br ${STAT_WASH_TONES[tone]} to-white rounded-2xl ring-1 ring-gray-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_20px_-14px_rgba(15,23,42,0.12)] p-4 ${onClick ? 'hover:-translate-y-0.5 hover:shadow-[0_4px_16px_-6px_rgba(15,23,42,0.18)] hover:ring-gray-300 transition-all duration-200' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-500">{label}</p>
        {Icon && <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm ${STAT_ICON_TONES[tone]}`}><Icon size={16} /></div>}
      </div>
      <p className="text-[28px] font-bold text-gray-900 tabular-nums leading-none tracking-tight">{value}</p>
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
  return <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ring-1 ring-inset ring-black/[0.04] ${BADGE[tone]} ${className}`}>{children}</span>;
}

/* Button class strings — use directly on <button> / <a> so existing handlers stay untouched. */
export const btn = {
  primary: 'inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-linear-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-sm shadow-blue-600/25 disabled:opacity-40 disabled:cursor-not-allowed transition',
  secondary: 'inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 bg-white ring-1 ring-gray-200 hover:bg-gray-50 hover:ring-gray-300 shadow-sm disabled:opacity-40 transition',
  ghost: 'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-40 transition',
  danger: 'inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-red-700 bg-red-50 ring-1 ring-red-200 hover:bg-red-100 disabled:opacity-40 transition',
  success: 'inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-linear-to-br from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-sm shadow-emerald-600/25 disabled:opacity-40 transition',
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
