import { useQuery } from '@tanstack/react-query';
import { Wallet, Users, CreditCard, Package, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { billingApi, type Plan } from '../api/billing.api.ts';

const PLAN_COLORS: Record<Plan, { bg: string; text: string; border: string }> = {
  TRIAL:      { bg: 'bg-gray-100',   text: 'text-gray-700',   border: 'border-gray-300'   },
  BASIC:      { bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-300'   },
  PRO:        { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-300' },
  ENTERPRISE: { bg: 'bg-amber-100',  text: 'text-amber-700',  border: 'border-amber-300'  },
};

function UsageBar({ label, icon: Icon, used, limit, unlimited, pct, warn: _warn }: {
  label: string; icon: React.ElementType;
  used: number; limit: number; unlimited: boolean; pct: number; warn?: boolean;
}) {
  const barColor = unlimited ? 'bg-green-500'
    : pct >= 90 ? 'bg-red-500'
    : pct >= 70 ? 'bg-amber-500'
    : 'bg-blue-500';

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center">
          <Icon size={15} className="text-blue-600" />
        </div>
        <p className="text-sm font-semibold text-gray-800">{label}</p>
        {pct >= 90 && !unlimited && (
          <span className="ml-auto flex items-center gap-1 text-xs text-red-600 font-medium">
            <AlertTriangle size={11} /> Near limit
          </span>
        )}
      </div>
      <div className="flex items-end justify-between mb-2">
        <span className="text-2xl font-extrabold text-gray-900">{used.toLocaleString()}</span>
        <span className="text-xs text-gray-400 mb-1">
          {unlimited ? 'Unlimited' : `of ${limit.toLocaleString()}`}
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: unlimited ? '100%' : `${Math.min(100, pct)}%` }}
        />
      </div>
      {!unlimited && (
        <p className="text-xs text-gray-400 mt-1.5">{pct}% used</p>
      )}
    </div>
  );
}

export default function BillingPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['billing-usage'],
    queryFn: billingApi.getUsage,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-white border border-gray-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const planStyle = PLAN_COLORS[data.plan];

  const statusIcon = data.trialExpired || data.planExpired
    ? <AlertTriangle size={14} className="text-red-500" />
    : data.trialDaysLeft !== null && data.trialDaysLeft <= 3
    ? <AlertTriangle size={14} className="text-amber-500" />
    : <CheckCircle2 size={14} className="text-green-500" />;

  const statusText = data.trialExpired ? 'Trial expired'
    : data.planExpired ? 'Plan expired'
    : data.trialDaysLeft !== null ? `${data.trialDaysLeft} day${data.trialDaysLeft !== 1 ? 's' : ''} left in trial`
    : data.planExpiresAt ? `Renews ${new Date(data.planExpiresAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : 'Active';

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Billing & Usage</h1>
        <p className="text-sm text-gray-400 mt-0.5">Your plan details and resource usage</p>
      </div>

      {/* Plan card */}
      <div className={`rounded-2xl border-2 ${planStyle.border} p-6 mb-6 bg-white shadow-sm`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Wallet size={18} className={planStyle.text} />
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Current Plan</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`inline-flex px-3 py-1 rounded-full text-sm font-bold ${planStyle.bg} ${planStyle.text}`}>
                {data.planLabel}
              </span>
              {data.priceMonthly > 0 && (
                <span className="text-sm text-gray-500">PKR {data.priceMonthly.toLocaleString()} / month</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
            {statusIcon}
            <span>{statusText}</span>
          </div>
        </div>

        {data.trialDaysLeft !== null && !data.trialExpired && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Trial period</span>
              <span>{data.trialDaysLeft} / 14 days remaining</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${data.trialDaysLeft <= 3 ? 'bg-red-400' : 'bg-blue-500'}`}
                style={{ width: `${Math.min(100, (data.trialDaysLeft / 14) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {(data.trialExpired || data.planExpired) && (
          <div className="mt-4 flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            <AlertTriangle size={14} className="text-red-500 shrink-0" />
            <p className="text-xs text-red-700 font-medium">
              Your {data.trialExpired ? 'trial' : 'plan'} has expired. Contact support to upgrade and restore full access.
            </p>
          </div>
        )}
      </div>

      {/* Usage cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <UsageBar
          label="Customers"
          icon={Users}
          {...data.limits.customers}
        />
        <UsageBar
          label="Staff Members"
          icon={Package}
          {...data.limits.staff}
        />
        <UsageBar
          label="Installments"
          icon={CreditCard}
          {...data.limits.installments}
        />
      </div>

      {/* Footer note */}
      <div className="mt-6 flex items-center gap-2 text-xs text-gray-400">
        <Clock size={12} />
        <span>Usage figures update in real time. Contact support to upgrade your plan.</span>
      </div>
    </div>
  );
}
