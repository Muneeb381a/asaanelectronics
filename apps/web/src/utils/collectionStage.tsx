import { PhoneCall, MapPin, HandCoins, XCircle, AlertOctagon } from 'lucide-react';
import type { RecoveryActionType } from '../api/recovery.api.ts';

// Shared between RecoveryPage (all overdue accounts) and the agent-portfolio
// views (Staff Portfolio tab, "mere assigned customers" dashboard card) so a
// customer's collection status reads the same everywhere in the app.

export type ActionMeta = { label: string; icon: React.ElementType; color: string; bg: string };
export const ACTION_META: Record<RecoveryActionType, ActionMeta> = {
  CALLED:          { label: 'Called',          icon: PhoneCall,     color: 'text-blue-600',   bg: 'bg-blue-50'   },
  VISITED:         { label: 'Visited',         icon: MapPin,        color: 'text-violet-600', bg: 'bg-violet-50' },
  PROMISE_TO_PAY:  { label: 'Promise to Pay',  icon: HandCoins,     color: 'text-emerald-600',bg: 'bg-emerald-50'},
  REFUSED:         { label: 'Refused',         icon: XCircle,       color: 'text-red-600',    bg: 'bg-red-50'    },
  LEGAL_WARNING:   { label: 'Legal Warning',   icon: AlertOctagon,  color: 'text-orange-600', bg: 'bg-orange-50' },
};
export const ACTION_TYPES = Object.keys(ACTION_META) as RecoveryActionType[];

export type CollectionStage =
  | 'up_to_date' | 'soft_overdue' | 'overdue' | 'critical'
  | 'called' | 'visited' | 'promised' | 'broken_promise' | 'refused' | 'legal';

export const STAGE_META: Record<CollectionStage, { label: string; color: string; bg: string; dot: string }> = {
  up_to_date:     { label: 'Up to date',      color: 'text-emerald-700',bg: 'bg-emerald-50', dot: 'bg-emerald-400'},
  soft_overdue:   { label: '1–7d',           color: 'text-yellow-700', bg: 'bg-yellow-50',  dot: 'bg-yellow-400' },
  overdue:        { label: '8–30d',          color: 'text-orange-700', bg: 'bg-orange-50',  dot: 'bg-orange-500' },
  critical:       { label: '30d+',           color: 'text-red-700',    bg: 'bg-red-100',    dot: 'bg-red-600'    },
  called:         { label: 'Called',         color: 'text-blue-700',   bg: 'bg-blue-50',    dot: 'bg-blue-400'   },
  visited:        { label: 'Visited',        color: 'text-violet-700', bg: 'bg-violet-50',  dot: 'bg-violet-400' },
  promised:       { label: 'Promised',       color: 'text-emerald-700',bg: 'bg-emerald-50', dot: 'bg-emerald-400'},
  broken_promise: { label: 'Broken Promise', color: 'text-rose-700',   bg: 'bg-rose-50',    dot: 'bg-rose-600'   },
  refused:        { label: 'Refused',        color: 'text-red-700',    bg: 'bg-red-50',     dot: 'bg-red-400'    },
  legal:          { label: 'Legal Warning',  color: 'text-gray-700',   bg: 'bg-gray-100',   dot: 'bg-gray-500'   },
};

export interface StageInput {
  last_action_type: string | null;
  days_overdue: number;
  last_promise_date: string | null;
}

export function getStage(item: StageInput): CollectionStage {
  const { last_action_type, days_overdue, last_promise_date } = item;
  if (last_action_type === 'LEGAL_WARNING') return 'legal';
  if (last_action_type === 'REFUSED')       return 'refused';
  if (last_action_type === 'VISITED')       return 'visited';
  if (last_action_type === 'CALLED')        return 'called';
  if (last_action_type === 'PROMISE_TO_PAY') {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const pDate = last_promise_date ? new Date(last_promise_date) : null;
    return (pDate && pDate < today) ? 'broken_promise' : 'promised';
  }
  if (days_overdue <= 0)  return 'up_to_date';
  if (days_overdue <= 7)  return 'soft_overdue';
  if (days_overdue <= 30) return 'overdue';
  return 'critical';
}

export function CollectionStageBadge({ stage }: { stage: CollectionStage }) {
  const m = STAGE_META[stage];
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${m.bg} ${m.color}`}>
      {m.label}
    </span>
  );
}
