import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ShieldCheck, UserPlus, UserMinus, UserCog, Package, PackageMinus, PackagePlus,
  CreditCard, Wallet, Receipt, Trash2, ChevronDown, ChevronUp, Shield, Monitor, Smartphone,
  RotateCcw, CheckCircle, PhoneCall, XCircle,
} from 'lucide-react';
import { auditApi, type AuditLog } from '../api/audit.api.ts';
import { CardSkeleton } from '../components/ui/Skeleton.tsx';

// ── Action config ─────────────────────────────────────────────────────────────
type ActionMeta = { label: string; color: string; bg: string; icon: typeof Shield };

const ACTION_MAP: Record<string, ActionMeta> = {
  // Customers
  CUSTOMER_CREATED:            { label: 'Customer Added',          color: 'text-green-700',  bg: 'bg-green-100',  icon: UserPlus },
  CUSTOMER_UPDATED:            { label: 'Customer Updated',        color: 'text-amber-700',  bg: 'bg-amber-100',  icon: UserCog },
  CUSTOMER_DELETED:            { label: 'Customer Deleted',        color: 'text-red-700',    bg: 'bg-red-100',    icon: UserMinus },
  // Installments
  INSTALLMENT_CREATED:         { label: 'Installment Created',     color: 'text-blue-700',   bg: 'bg-blue-100',   icon: CreditCard },
  INSTALLMENT_APPROVED:        { label: 'Installment Approved',    color: 'text-green-700',  bg: 'bg-green-100',  icon: CheckCircle },
  INSTALLMENT_CANCELLED:       { label: 'Installment Cancelled',   color: 'text-orange-700', bg: 'bg-orange-100', icon: XCircle },
  INSTALLMENT_DEFAULTED:       { label: 'Marked Defaulted',        color: 'text-red-700',    bg: 'bg-red-100',    icon: CreditCard },
  INSTALLMENT_RESCHEDULED:     { label: 'Rescheduled',             color: 'text-purple-700', bg: 'bg-purple-100', icon: CreditCard },
  INSTALLMENT_CLOSED:          { label: 'Installment Closed',      color: 'text-slate-700',  bg: 'bg-slate-100',  icon: CreditCard },
  INSTALLMENT_DELETED:         { label: 'Installment Deleted',     color: 'text-red-700',    bg: 'bg-red-100',    icon: Trash2 },
  // Payments
  PAYMENT_RECORDED:            { label: 'Payment Recorded',        color: 'text-green-700',  bg: 'bg-green-100',  icon: Wallet },
  PAYMENT_DELETED:             { label: 'Payment Deleted',         color: 'text-red-700',    bg: 'bg-red-100',    icon: Trash2 },
  // Products
  PRODUCT_CREATED:             { label: 'Product Added',           color: 'text-green-700',  bg: 'bg-green-100',  icon: PackagePlus },
  PRODUCT_UPDATED:             { label: 'Product Updated',         color: 'text-amber-700',  bg: 'bg-amber-100',  icon: Package },
  PRODUCT_DELETED:             { label: 'Product Deleted',         color: 'text-red-700',    bg: 'bg-red-100',    icon: PackageMinus },
  // Expenses
  EXPENSE_CREATED:             { label: 'Expense Recorded',        color: 'text-red-700',    bg: 'bg-red-100',    icon: Receipt },
  EXPENSE_DELETED:             { label: 'Expense Deleted',         color: 'text-red-700',    bg: 'bg-red-100',    icon: Trash2 },
  // Returns
  RETURN_CREATED:              { label: 'Return Requested',        color: 'text-orange-700', bg: 'bg-orange-100', icon: RotateCcw },
  RETURN_RESOLVED:             { label: 'Return Resolved',         color: 'text-green-700',  bg: 'bg-green-100',  icon: CheckCircle },
  // Staff
  STAFF_CREATED:               { label: 'Staff Added',             color: 'text-blue-700',   bg: 'bg-blue-100',   icon: UserPlus },
  STAFF_REMOVED:               { label: 'Staff Removed',           color: 'text-red-700',    bg: 'bg-red-100',    icon: UserMinus },
  STAFF_PERMISSIONS_CHANGED:   { label: 'Permissions Changed',     color: 'text-violet-700', bg: 'bg-violet-100', icon: Shield },
  // Recovery
  RECOVERY_ACTION_CREATED:     { label: 'Recovery Action',         color: 'text-violet-700', bg: 'bg-violet-100', icon: PhoneCall },
  RECOVERY_ACTION_DELETED:     { label: 'Recovery Action Deleted', color: 'text-red-700',    bg: 'bg-red-100',    icon: Trash2 },
};

const ENTITY_COLORS: Record<string, string> = {
  CUSTOMER:    'bg-violet-100 text-violet-700',
  INSTALLMENT: 'bg-blue-100   text-blue-700',
  PAYMENT:     'bg-green-100  text-green-700',
  PRODUCT:     'bg-amber-100  text-amber-700',
  EXPENSE:     'bg-red-100    text-red-700',
  RETURN:      'bg-orange-100 text-orange-700',
  STAFF:       'bg-indigo-100 text-indigo-700',
  RECOVERY:    'bg-violet-100 text-violet-700',
};

const ALL_ACTIONS = Object.keys(ACTION_MAP);
const ALL_ENTITIES = ['CUSTOMER', 'INSTALLMENT', 'PAYMENT', 'PRODUCT', 'EXPENSE', 'RETURN', 'STAFF', 'RECOVERY'];

function today() { return new Date().toISOString().slice(0, 10); }
function sevenDaysAgo() {
  const d = new Date(); d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-PK', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function initials(name: string | null): string {
  if (!name) return '?';
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

function parseDevice(ua: string | null): { label: string; mobile: boolean } {
  if (!ua) return { label: 'Unknown device', mobile: false };
  const mobile = /mobile|android|iphone|ipad/i.test(ua);
  const browser =
    ua.includes('Chrome')  ? 'Chrome'  :
    ua.includes('Firefox') ? 'Firefox' :
    ua.includes('Safari')  ? 'Safari'  :
    ua.includes('Edge')    ? 'Edge'    : 'Browser';
  const os =
    ua.includes('Windows') ? 'Windows' :
    ua.includes('Mac OS')  ? 'macOS'   :
    ua.includes('Android') ? 'Android' :
    ua.includes('iPhone')  ? 'iPhone'  :
    ua.includes('Linux')   ? 'Linux'   : 'Unknown OS';
  return { label: `${browser} on ${os}`, mobile };
}

function DiffTable({ before, after }: { before: Record<string, unknown>; after: Record<string, unknown> }) {
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  return (
    <div className="overflow-x-auto">
    <table className="w-full text-xs mt-2 border-collapse">
      <thead>
        <tr className="text-gray-400 text-left">
          <th className="pb-1 font-medium w-1/4">Field</th>
          <th className="pb-1 font-medium text-red-500 w-3/8">Before</th>
          <th className="pb-1 font-medium text-green-600 w-3/8">After</th>
        </tr>
      </thead>
      <tbody>
        {keys.map((k) => (
          <tr key={k} className="border-t border-gray-100">
            <td className="py-1 text-gray-500 font-medium pr-2">{k}</td>
            <td className="py-1 text-red-500 pr-2">{String(before[k] ?? '—')}</td>
            <td className="py-1 text-green-600">{String(after[k] ?? '—')}</td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}

// ── Single log row ────────────────────────────────────────────────────────────
function LogRow({ log }: { log: AuditLog }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = ACTION_MAP[log.action] ?? { label: log.action, color: 'text-gray-700', bg: 'bg-gray-100', icon: ShieldCheck };
  const Icon = cfg.icon;
  const hasDiff = log.before && log.after;
  const hasMeta = log.meta && Object.keys(log.meta).length > 0;
  const hasDetails = hasDiff || hasMeta || log.reason;
  const device = parseDevice(log.userAgent);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 hover:border-gray-200 transition-colors">
      <div className="flex items-start gap-4">
        {/* Actor avatar */}
        <div className="w-9 h-9 rounded-full bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
          {initials(log.actorName)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-semibold text-gray-900">
              {log.actorName ?? 'Unknown user'}
            </span>
            {log.actorRole && (
              <span className="text-xs text-gray-400 font-normal">
                ({log.actorRole === 'SELLER_OWNER' ? 'Owner' : 'Staff'})
              </span>
            )}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
              <Icon size={11} />
              {cfg.label}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ENTITY_COLORS[log.entityType] ?? 'bg-gray-100 text-gray-600'}`}>
              {log.entityType}
            </span>
          </div>

          <p className="text-sm text-gray-700 leading-snug">{log.description}</p>

          {/* Reason */}
          {log.reason && (
            <p className="mt-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 inline-block">
              Reason: {log.reason}
            </p>
          )}

          {/* Footer */}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="text-xs text-gray-400" title={formatDate(log.createdAt)}>
              {timeAgo(log.createdAt)} · {formatDate(log.createdAt)}
            </span>
            {log.ip && <span className="text-xs text-gray-300">IP: {log.ip}</span>}
            {log.userAgent && (
              <span className="flex items-center gap-1 text-xs text-gray-300">
                {device.mobile ? <Smartphone size={10} /> : <Monitor size={10} />}
                {device.label}
              </span>
            )}
            {hasDetails && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-0.5 transition-colors ml-auto"
              >
                Details {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </button>
            )}
          </div>

          {/* Expanded details */}
          {expanded && (
            <div className="mt-2 space-y-2">
              {hasDiff && (
                <div className="bg-gray-50 rounded-xl px-3 py-2">
                  <DiffTable before={log.before!} after={log.after!} />
                </div>
              )}
              {!hasDiff && hasMeta && (
                <pre className="bg-gray-50 rounded-xl px-3 py-2 text-xs text-gray-600 overflow-x-auto font-mono">
                  {JSON.stringify(log.meta, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AuditLogPage() {
  const [from,       setFrom]       = useState(sevenDaysAgo());
  const [to,         setTo]         = useState(today());
  const [action,     setAction]     = useState('');
  const [entityType, setEntityType] = useState('');
  const [page,       setPage]       = useState(1);
  const limit = 50;

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['audit', from, to, action, entityType, page],
    queryFn: () => auditApi.list({ from, to, action: action || undefined, entityType: entityType || undefined, page, limit }),
    staleTime: 30_000,
  });

  const logs  = data?.data  ?? [];
  const total = data?.total ?? 0;
  const pages = Math.ceil(total / limit);

  function resetPage() { setPage(1); }

  return (
    <div className="px-4 py-5 sm:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck size={20} className="text-indigo-600" />
            Audit Log
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Full record of every sensitive action in your shop</p>
        </div>
        {total > 0 && (
          <span className="text-sm text-gray-400 mt-1 shrink-0">{total.toLocaleString()} events</span>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-5 flex flex-wrap gap-3 items-center">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          From
          <input type="date" value={from}
            onChange={(e) => { setFrom(e.target.value); resetPage(); }}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          To
          <input type="date" value={to}
            onChange={(e) => { setTo(e.target.value); resetPage(); }}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </label>
        <select
          value={action}
          onChange={(e) => { setAction(e.target.value); resetPage(); }}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-600"
        >
          <option value="">All actions</option>
          {ALL_ACTIONS.map((a) => (
            <option key={a} value={a}>{ACTION_MAP[a]!.label}</option>
          ))}
        </select>
        <select
          value={entityType}
          onChange={(e) => { setEntityType(e.target.value); resetPage(); }}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-600"
        >
          <option value="">All entities</option>
          {ALL_ENTITIES.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        {(action || entityType) && (
          <button
            onClick={() => { setAction(''); setEntityType(''); resetPage(); }}
            className="text-xs text-gray-400 hover:text-gray-600 underline transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Log list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => <CardSkeleton key={i} />)}
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <ShieldCheck size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium text-gray-500">No activity in this period</p>
          <p className="text-xs mt-1">Try adjusting the date range or filters</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {isFetching && !isLoading && (
            <div className="text-center text-xs text-gray-400 py-1">Refreshing…</div>
          )}
          {logs.map((log) => <LogRow key={log.id} log={log} />)}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500 px-2">
            Page {page} of {pages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page === pages}
            className="px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
