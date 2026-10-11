import { PageHeader, btn, shell } from '../components/ui/Page';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Landmark, Plus, Phone, Trash2, Pencil, X, ChevronDown,
  Wallet, HandCoins, History, Percent,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { investorsApi, type Investor, type InvestorLedgerRow } from '../api/investors.api.ts';
import { reportsApi } from '../api/reports.api.ts';
import { getErrorMessage } from '../utils/error.ts';
import ConfirmDialog from '../components/ui/ConfirmDialog.tsx';

const pkr  = (n: number) => 'PKR ' + n.toLocaleString('en-PK', { maximumFractionDigits: 0 });
const pkrSh = (v: number) => {
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 10_00_000) return `${sign}${(abs / 10_00_000).toFixed(1)}M`;
  if (abs >= 1_00_000)  return `${sign}${(abs / 1_00_000).toFixed(abs % 1_00_000 === 0 ? 0 : 1)}L`;
  if (abs >= 1_000)     return `${sign}${(abs / 1_000).toFixed(abs % 1_000 === 0 ? 0 : 1)}K`;
  return `${sign}${abs}`;
};
const todayStr = () => new Date().toISOString().slice(0, 10);
const currentPeriod = () => todayStr().slice(0, 7);
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const periodLabel = (p: string) => {
  const [y, m] = p.split('-').map(Number);
  return `${MONTH_NAMES[(m ?? 1) - 1]} ${y}`;
};

/* ══════════════════════════════════════════════════════════
   INVESTOR FORM MODAL
══════════════════════════════════════════════════════════ */
function InvestorModal({ investor, onClose }: { investor?: Investor; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name:               investor?.name ?? '',
    phone:              investor?.phone ?? '',
    cnic:               investor?.cnic ?? '',
    profitSharePercent: investor ? String(investor.profitSharePercent) : '',
    notes:              investor?.notes ?? '',
  });
  const upd = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const pct = parseFloat(form.profitSharePercent);
  const isValid = form.name.trim() && !isNaN(pct) && pct >= 0 && pct <= 100;

  const mut = useMutation({
    mutationFn: () => {
      const body = { name: form.name.trim(), phone: form.phone.trim() || undefined, cnic: form.cnic.trim() || undefined, profitSharePercent: pct, notes: form.notes.trim() || undefined };
      return investor ? investorsApi.update(investor.id, body) : investorsApi.create(body);
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['investors'] }); toast.success(investor ? 'Investor update ho gaya' : 'Investor add ho gaya'); onClose(); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="border-b border-gray-100 flex items-center justify-between px-5 py-4">
          <p className="text-gray-900 font-semibold text-sm">{investor ? 'Investor Edit Karo' : 'Naya Investor'}</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Naam *</label>
            <input value={form.name} onChange={upd('name')} autoFocus
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 transition"
              placeholder="Investor ka naam" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Phone</label>
              <input value={form.phone} onChange={upd('phone')}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 transition"
                placeholder="03XX-XXXXXXX" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">CNIC</label>
              <input value={form.cnic} onChange={upd('cnic')}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 transition"
                placeholder="XXXXX-XXXXXXX-X" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Profit Share %  *</label>
            <div className="relative">
              <input type="number" min={0} max={100} step="0.01" value={form.profitSharePercent} onChange={upd('profitSharePercent')}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 transition pr-8"
                placeholder="e.g. 20" />
              <Percent size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Har month net profit ka ye % is investor ko diya jaye ga (auto-suggestion ke liye — amount hamesha edit ho sakta hai).</p>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Notes</label>
            <textarea value={form.notes} onChange={upd('notes')} rows={2}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-blue-400 transition"
              placeholder="Optional..." />
          </div>
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="flex-1 border border-slate-200 rounded-xl py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition">Wapas</button>
          <button onClick={() => mut.mutate()} disabled={!isValid || mut.isPending}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-40 transition">
            {mut.isPending ? 'Save ho raha…' : investor ? 'Save Karo' : 'Add Karo'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   ADD CONTRIBUTION MODAL
══════════════════════════════════════════════════════════ */
function ContributionModal({ investorId, investorName, onClose }: { investorId: string; investorName: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [amount, setAmount]   = useState('');
  const [date, setDate]       = useState(todayStr());
  const [note, setNote]       = useState('');

  const mut = useMutation({
    mutationFn: () => investorsApi.addContribution(investorId, { amount: Number(amount), contributedOn: date, note: note.trim() || undefined }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['investors'] });
      void qc.invalidateQueries({ queryKey: ['investor-ledger', investorId] });
      toast.success('Contribution record ho gayi');
      onClose();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const amountNum = Number(amount);
  const valid = amountNum > 0 && date;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Capital Contribution</h2>
            <p className="text-xs text-slate-400 mt-0.5">{investorName}</p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 transition"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Amount (PKR)</label>
            <input type="number" min={0.01} step="0.01" autoFocus
              value={amount} onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm font-bold tabular-nums focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Date</label>
            <input type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-400 transition" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Note <span className="font-normal text-slate-400">(optional)</span></label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Kuch aur…"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-400 transition" />
          </div>
        </div>
        <div className="flex gap-3 px-5 py-4 border-t border-slate-100">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition">Cancel</button>
          <button onClick={() => mut.mutate()} disabled={!valid || mut.isPending}
            className="flex-1 py-2.5 text-sm font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition disabled:opacity-50 flex items-center justify-center gap-1.5">
            <Wallet size={14} /> {mut.isPending ? 'Record ho raha…' : 'Contribution Add Karo'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   RECORD PAYOUT MODAL — manual or auto-suggested
══════════════════════════════════════════════════════════ */
function RecordPayoutModal({ investor, onClose }: { investor: Investor; onClose: () => void }) {
  const qc = useQueryClient();
  const [method, setMethod]   = useState<'MANUAL' | 'AUTO'>('AUTO');
  const [period, setPeriod]   = useState(currentPeriod());
  const [amount, setAmount]   = useState('');
  const [paidOn, setPaidOn]   = useState(todayStr());
  const [note, setNote]       = useState('');
  const [calculatedShare, setCalculatedShare] = useState<number | null>(null);

  const [year, month] = period.split('-').map(Number);
  const { data: pnl, isFetching: pnlLoading } = useQuery({
    queryKey: ['pnl-for-payout', year, month],
    queryFn:  () => reportsApi.getPnL(year!, month),
    enabled:  method === 'AUTO',
    staleTime: 60_000,
  });

  const applySuggestion = (netProfit: number) => {
    const suggestion = netProfit > 0 ? Math.round(netProfit * investor.profitSharePercent / 100) : 0;
    setCalculatedShare(suggestion);
    setAmount(String(suggestion));
  };

  // Recompute the suggestion whenever the fetched month's P&L changes (new period picked, or data lands)
  const pnlNetProfit = pnl?.netProfit;
  const [lastAppliedFor, setLastAppliedFor] = useState<string | null>(null);
  if (method === 'AUTO' && pnl && lastAppliedFor !== period) {
    applySuggestion(pnlNetProfit!);
    setLastAppliedFor(period);
  }

  const mut = useMutation({
    mutationFn: () => investorsApi.recordPayout(investor.id, {
      period, method,
      calculatedShare: method === 'AUTO' ? (calculatedShare ?? undefined) : undefined,
      amount: Number(amount),
      note: note.trim() || undefined,
      paidOn,
    }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['investors'] });
      void qc.invalidateQueries({ queryKey: ['investor-ledger', investor.id] });
      toast.success('Payout record ho gaya');
      onClose();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const amountNum = Number(amount);
  const valid = amountNum >= 0 && amountNum > 0 && period && paidOn;
  const alreadyPaidThisPeriod = investor.lastPayoutPeriod === period;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Profit Payout</h2>
            <p className="text-xs text-slate-400 mt-0.5">{investor.name} · {investor.profitSharePercent}% share</p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 transition"><X size={16} /></button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {/* Manual / Auto toggle */}
          <div className="grid grid-cols-2 gap-2 bg-slate-100 rounded-xl p-1">
            {(['AUTO', 'MANUAL'] as const).map((m) => (
              <button key={m} onClick={() => setMethod(m)}
                className={`py-1.5 rounded-lg text-xs font-bold transition ${method === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
                {m === 'AUTO' ? 'Auto Suggest' : 'Manual'}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Month</label>
            <input type="month" value={period} max={currentPeriod()}
              onChange={(e) => { setPeriod(e.target.value); setLastAppliedFor(null); }}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-400 transition" />
            {alreadyPaidThisPeriod && (
              <p className="text-[11px] text-red-500 mt-1">{periodLabel(period)} ka payout pehle se record hai.</p>
            )}
          </div>

          {method === 'AUTO' && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
              {pnlLoading ? (
                <p className="text-xs text-blue-500">Net profit calculate ho raha…</p>
              ) : pnl ? (
                <>
                  <div className="flex justify-between text-xs">
                    <span className="text-blue-600">{periodLabel(period)} net profit</span>
                    <span className={`font-bold tabular-nums ${pnl.netProfit >= 0 ? 'text-blue-700' : 'text-red-600'}`}>{pkr(pnl.netProfit)}</span>
                  </div>
                  <div className="flex justify-between text-xs mt-1">
                    <span className="text-blue-600">Suggested share ({investor.profitSharePercent}%)</span>
                    <span className="font-bold text-blue-700 tabular-nums">{pkr(calculatedShare ?? 0)}</span>
                  </div>
                  {pnl.netProfit <= 0 && (
                    <p className="text-[11px] text-blue-500 mt-1.5">Loss/zero month — nuqsan investor ka risk hota hai, shop pe extra bill nahi banta. Suggestion 0 hai, chahen to manually amount likh sakte hain.</p>
                  )}
                  <p className="text-[11px] text-blue-400 mt-1.5">Amount neeche edit kar sakte hain — final decision aap ka hai.</p>
                </>
              ) : null}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Amount (PKR)</label>
            <input type="number" min={0.01} step="0.01"
              value={amount} onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm font-bold tabular-nums focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition" />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Date</label>
            <input type="date" value={paidOn} max={todayStr()} onChange={(e) => setPaidOn(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-400 transition" />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Note <span className="font-normal text-slate-400">(optional)</span></label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Kuch aur…"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-400 transition" />
          </div>
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-slate-100">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition">Cancel</button>
          <button onClick={() => mut.mutate()} disabled={!valid || alreadyPaidThisPeriod || mut.isPending}
            className="flex-1 py-2.5 text-sm font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition disabled:opacity-50 flex items-center justify-center gap-1.5">
            <HandCoins size={14} /> {mut.isPending ? 'Record ho raha…' : 'Payout Karo'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   INVESTOR ROW (accordion)
══════════════════════════════════════════════════════════ */
function InvestorRow({ investor, index }: { investor: Investor; index: number }) {
  const qc = useQueryClient();
  const [expanded, setExpanded]       = useState(false);
  const [editing, setEditing]         = useState(false);
  const [contributing, setContributing] = useState(false);
  const [payingOut, setPayingOut]     = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRowId, setConfirmRowId]   = useState<InvestorLedgerRow | null>(null);

  const { data: ledger } = useQuery({
    queryKey: ['investor-ledger', investor.id],
    queryFn:  () => investorsApi.getLedger(investor.id),
    enabled:  expanded,
    staleTime: 60_000,
  });

  const deleteMut = useMutation({
    mutationFn: () => investorsApi.remove(investor.id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['investors'] }); toast.success('Investor hata diya'); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const removeRowMut = useMutation({
    mutationFn: (row: InvestorLedgerRow) => row.type === 'CONTRIBUTION'
      ? investorsApi.removeContribution(investor.id, row.id)
      : investorsApi.removePayout(investor.id, row.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['investor-ledger', investor.id] });
      void qc.invalidateQueries({ queryKey: ['investors'] });
      toast.success('Entry hata diya');
      setConfirmRowId(null);
    },
    onError: (e) => { toast.error(getErrorMessage(e)); setConfirmRowId(null); },
  });

  const initials = investor.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const avatarColors = ['bg-blue-100 text-blue-700','bg-violet-100 text-violet-700','bg-emerald-100 text-emerald-700','bg-amber-100 text-amber-700','bg-rose-100 text-rose-700'];
  const avatarCls = avatarColors[index % avatarColors.length];

  return (
    <>
      {editing      && <InvestorModal investor={investor} onClose={() => setEditing(false)} />}
      {contributing && <ContributionModal investorId={investor.id} investorName={investor.name} onClose={() => setContributing(false)} />}
      {payingOut    && <RecordPayoutModal investor={investor} onClose={() => setPayingOut(false)} />}

      <div className={`${index > 0 ? 'border-t border-slate-100' : ''} ${!investor.isActive ? 'opacity-60' : ''}`}>
        <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/60 transition">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${avatarCls}`}>
            {initials}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-slate-900 truncate">{investor.name}</p>
              <span className="hidden sm:inline-flex text-[9px] font-bold bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded shrink-0">{investor.profitSharePercent}%</span>
              {!investor.isActive && <span className="text-[9px] font-bold bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded shrink-0">Inactive</span>}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {investor.phone && <span className="flex items-center gap-1 text-[10px] text-slate-400"><Phone size={9}/>{investor.phone}</span>}
              {investor.lastPayoutPeriod && <span className="text-[10px] text-slate-400">Last payout: {periodLabel(investor.lastPayoutPeriod)}</span>}
            </div>
          </div>

          <div className="hidden md:flex items-center gap-5 shrink-0">
            <div className="text-right">
              <p className="text-[10px] text-slate-400">Invest Kiya</p>
              <p className="text-sm font-bold text-slate-800 tabular-nums">{pkrSh(investor.totalContributed)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-400">Diya Gaya</p>
              <p className="text-sm font-bold text-emerald-600 tabular-nums">{pkrSh(investor.totalPaidOut)}</p>
            </div>
            <div className="text-right w-20">
              <p className="text-[10px] text-slate-400">Net Position</p>
              <p className="text-sm font-bold text-slate-700 tabular-nums">{pkrSh(investor.netPosition)}</p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setContributing(true)} title="Add contribution"
              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition">
              <Wallet size={11} /> <span className="hidden sm:inline">Contribution</span>
            </button>
            <button onClick={() => setPayingOut(true)} title="Record payout"
              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition">
              <HandCoins size={11} /> <span className="hidden sm:inline">Payout</span>
            </button>
            <button onClick={() => setEditing(true)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition">
              <Pencil size={13} />
            </button>
            <button onClick={() => setConfirmDelete(true)}
              className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition">
              <Trash2 size={13} />
            </button>
            <ConfirmDialog
              open={confirmDelete}
              title={`${investor.name} ko hata dein?`}
              description="Investor inactive ho jaye ga — contributions aur payouts ki history record mein rahegi."
              confirmLabel="Haan, hata do"
              cancelLabel="Nahi"
              isPending={deleteMut.isPending}
              onConfirm={() => deleteMut.mutate(undefined, { onSettled: () => setConfirmDelete(false) })}
              onCancel={() => setConfirmDelete(false)}
            />
            <button onClick={() => setExpanded(v => !v)}
              className={`p-1.5 rounded-lg transition ${expanded ? 'bg-slate-100 text-slate-700' : 'text-slate-400 hover:bg-slate-100'}`}>
              <ChevronDown size={14} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* Mobile amounts */}
        <div className="md:hidden flex gap-3 px-4 pb-3">
          <div className="flex-1 bg-slate-50 rounded-xl px-3 py-2 text-center">
            <p className="text-[9px] text-slate-400">Invest Kiya</p>
            <p className="text-xs font-bold text-slate-800 tabular-nums">{pkrSh(investor.totalContributed)}</p>
          </div>
          <div className="flex-1 bg-emerald-50 rounded-xl px-3 py-2 text-center">
            <p className="text-[9px] text-emerald-500">Diya Gaya</p>
            <p className="text-xs font-bold text-emerald-600 tabular-nums">{pkrSh(investor.totalPaidOut)}</p>
          </div>
          <div className="flex-1 bg-slate-50 rounded-xl px-3 py-2 text-center">
            <p className="text-[9px] text-slate-400">Net</p>
            <p className="text-xs font-bold text-slate-700 tabular-nums">{pkrSh(investor.netPosition)}</p>
          </div>
        </div>

        {/* Ledger accordion */}
        {expanded && (
          <div className="border-t border-slate-100 bg-slate-50/50">
            <div className="px-4 py-3">
              <div className="flex items-center gap-1.5 mb-2">
                <History size={11} className="text-slate-400" />
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Contribution & Payout History</p>
              </div>
              {!ledger ? (
                <p className="text-[11px] text-slate-300">Loading…</p>
              ) : ledger.rows.length === 0 ? (
                <p className="text-[11px] text-slate-400">Abhi tak koi record nahi.</p>
              ) : (
                <div className="space-y-1">
                  {ledger.rows.map((r) => (
                    <div key={`${r.type}-${r.id}`} className="flex items-center justify-between gap-2 bg-white rounded-lg px-2.5 py-1.5 border border-slate-100">
                      <div className="min-w-0 flex items-center gap-2">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${r.type === 'CONTRIBUTION' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}`}>
                          {r.type === 'CONTRIBUTION' ? 'Contribution' : 'Payout'}
                        </span>
                        <span className={`text-[11px] font-bold tabular-nums ${r.type === 'CONTRIBUTION' ? 'text-blue-700' : 'text-emerald-700'}`}>{pkr(r.amount)}</span>
                        <span className="text-[10px] text-slate-400">{r.date.slice(0, 10)}</span>
                        {r.period && <span className="text-[10px] text-slate-400">· {periodLabel(r.period)}</span>}
                        {r.method && <span className="text-[10px] text-slate-400">· {r.method === 'AUTO' ? 'Auto' : 'Manual'}</span>}
                        {r.note && <span className="text-[10px] text-slate-400 italic truncate">· {r.note}</span>}
                        {r.recordedByName && <span className="text-[10px] text-slate-300">— {r.recordedByName}</span>}
                      </div>
                      <button onClick={() => setConfirmRowId(r)} title="Undo this entry"
                        className="p-1 rounded-md hover:bg-red-50 text-slate-300 hover:text-red-500 transition shrink-0">
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <ConfirmDialog
                open={confirmRowId !== null}
                title="Ye entry hata dein?"
                description="Is entry ka record mit jayega aur cash book / ledger se bhi hat jayega."
                confirmLabel="Haan, hata do"
                cancelLabel="Nahi"
                isPending={removeRowMut.isPending}
                onConfirm={() => { if (confirmRowId) removeRowMut.mutate(confirmRowId); }}
                onCancel={() => setConfirmRowId(null)}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════ */
export default function InvestorsPage() {
  const [showAdd, setShowAdd] = useState(false);

  const { data: investors = [], isLoading } = useQuery<Investor[]>({
    queryKey: ['investors'],
    queryFn:  investorsApi.list,
    staleTime: 3 * 60_000,
  });

  const activeInvestors  = investors.filter(i => i.isActive);
  const totalInvested    = investors.reduce((s, i) => s + i.totalContributed, 0);
  const totalPaidOut     = investors.reduce((s, i) => s + i.totalPaidOut,     0);

  return (
    <div className="bg-canvas">

      <div className={`${shell.wide} !pb-0`}>
        <PageHeader title="Investors"
          subtitle={<>{activeInvestors.length} active investor{activeInvestors.length !== 1 ? 's' : ''}</>}
          actions={<button onClick={() => setShowAdd(true)} className={btn.primary}><Plus size={14} /> Add investor</button>} />
      </div>

      {/* ── KPI STRIP ── */}
      {!isLoading && investors.length > 0 && (
        <div className="bg-white border-y border-gray-200 mt-5">
          <div className="grid grid-cols-3 divide-x divide-slate-100 max-w-5xl mx-auto">
            {[
              { label: 'Total Invested', val: pkrSh(totalInvested), full: pkr(totalInvested), dot: 'bg-blue-500',    vCls: 'text-slate-900' },
              { label: 'Total Paid Out', val: pkrSh(totalPaidOut),  full: pkr(totalPaidOut),  dot: 'bg-emerald-500', vCls: 'text-emerald-700' },
              { label: 'Active Investors', val: String(activeInvestors.length), full: `${activeInvestors.length} investors`, dot: 'bg-indigo-500', vCls: 'text-slate-900' },
            ].map((t, i) => (
              <div key={i} className="px-4 py-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.label}</p>
                </div>
                <p className={`text-2xl font-bold tabular-nums ${t.vCls}`}>{t.val}</p>
                <p className="text-[11px] text-slate-400 mt-0.5 tabular-nums">{t.full}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── BODY ── */}
      <div className="px-3 sm:px-5 py-4 max-w-5xl mx-auto space-y-4">
        <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="divide-y divide-slate-50">
              {[0,1].map(i => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                  <div className="w-9 h-9 bg-slate-100 rounded-xl" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-slate-100 rounded w-32" />
                    <div className="h-2 bg-slate-100 rounded w-20" />
                  </div>
                  <div className="hidden md:flex gap-4">
                    {[0,1,2].map(j => <div key={j} className="h-6 bg-slate-100 rounded w-16" />)}
                  </div>
                </div>
              ))}
            </div>
          ) : investors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-3">
                <Landmark size={28} className="text-slate-300" />
              </div>
              <p className="text-sm font-bold text-slate-600">Koi investor nahi</p>
              <p className="text-xs text-slate-400 mt-1 mb-4">Investors add karo capital aur profit-share track karne k liye</p>
              <button onClick={() => setShowAdd(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition">
                <Plus size={12} /> Pehla Investor Add Karo
              </button>
            </div>
          ) : (
            <div>
              {investors.map((inv, i) => <InvestorRow key={inv.id} investor={inv} index={i} />)}
            </div>
          )}
        </div>
      </div>

      {showAdd && <InvestorModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}
