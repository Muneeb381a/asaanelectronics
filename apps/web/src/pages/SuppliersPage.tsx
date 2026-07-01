import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, Phone, MapPin, CreditCard, ChevronDown, ChevronUp, Trash2, Pencil, X, Check, TrendingUp, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { suppliersApi, type Supplier, type SupplierInvoice, type PnLData } from '../api/suppliers.api.ts';
import { getErrorMessage } from '../utils/error.ts';

function pkr(n: number) {
  return 'PKR ' + n.toLocaleString('en-PK', { maximumFractionDigits: 0 });
}

function todayStr() { return new Date().toISOString().slice(0, 10); }

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── Supplier Form Modal ───────────────────────────────────────────────────────
function SupplierModal({ supplier, onClose }: { supplier?: Supplier; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name:    supplier?.name    ?? '',
    phone:   supplier?.phone   ?? '',
    address: supplier?.address ?? '',
    iban:    supplier?.iban    ?? '',
    notes:   supplier?.notes   ?? '',
  });

  const mut = useMutation({
    mutationFn: () => supplier
      ? suppliersApi.update(supplier.id, form)
      : suppliersApi.create(form),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success(supplier ? 'Supplier updated' : 'Supplier added');
      onClose();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{supplier ? 'Edit Supplier' : 'Add Supplier'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Supplier / vendor name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
              <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="03XX-XXXXXXX" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">IBAN / Account</label>
              <input value={form.iban} onChange={(e) => setForm((f) => ({ ...f, iban: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="PK..." />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Address</label>
            <input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="City, area..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Optional notes..." />
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-5">
          <button onClick={onClose} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => mut.mutate()}
            disabled={!form.name.trim() || mut.isPending}
            className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {mut.isPending ? 'Saving…' : supplier ? 'Save Changes' : 'Add Supplier'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Invoice Form ──────────────────────────────────────────────────────────────
function InvoiceForm({ supplierId, onClose }: { supplierId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    description: '', totalAmount: '', paidAmount: '', invoiceDate: todayStr(),
  });

  const mut = useMutation({
    mutationFn: () => suppliersApi.createInvoice(supplierId, {
      description: form.description,
      totalAmount: Number(form.totalAmount),
      paidAmount:  form.paidAmount ? Number(form.paidAmount) : 0,
      invoiceDate: form.invoiceDate,
    }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['supplier-invoices', supplierId] });
      void qc.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Invoice added');
      onClose();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-3">
      <p className="text-xs font-semibold text-blue-700 mb-3">New Purchase Invoice</p>
      <div className="space-y-2">
        <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          placeholder="Description (e.g. Samsung A15 ×10)" />
        <div className="grid grid-cols-3 gap-2">
          <input value={form.invoiceDate} onChange={(e) => setForm((f) => ({ ...f, invoiceDate: e.target.value }))}
            type="date" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          <input value={form.totalAmount} onChange={(e) => setForm((f) => ({ ...f, totalAmount: e.target.value }))}
            type="number" placeholder="Total PKR" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          <input value={form.paidAmount} onChange={(e) => setForm((f) => ({ ...f, paidAmount: e.target.value }))}
            type="number" placeholder="Paid PKR" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={onClose} className="flex-1 border border-gray-200 bg-white rounded-lg py-2 text-xs font-medium text-gray-500">Cancel</button>
        <button
          onClick={() => mut.mutate()}
          disabled={!form.description || !form.totalAmount || !form.invoiceDate || mut.isPending}
          className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-xs font-semibold disabled:opacity-40"
        >
          {mut.isPending ? 'Adding…' : 'Add Invoice'}
        </button>
      </div>
    </div>
  );
}

// ── Supplier Card ─────────────────────────────────────────────────────────────
function SupplierCard({ supplier }: { supplier: Supplier }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing]   = useState(false);
  const [addingInvoice, setAddingInvoice] = useState(false);

  const { data: invoices = [] } = useQuery<SupplierInvoice[]>({
    queryKey: ['supplier-invoices', supplier.id],
    queryFn:  () => suppliersApi.listInvoices(supplier.id),
    enabled:  expanded,
    staleTime: 2 * 60_000,
  });

  const deleteMut = useMutation({
    mutationFn: () => suppliersApi.remove(supplier.id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['suppliers'] }); toast.success('Supplier removed'); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const markPaidMut = useMutation({
    mutationFn: (inv: SupplierInvoice) => suppliersApi.updateInvoicePaid(supplier.id, inv.id, inv.totalAmount),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['supplier-invoices', supplier.id] });
      void qc.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Marked as paid');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const deleteInvMut = useMutation({
    mutationFn: (invId: string) => suppliersApi.deleteInvoice(supplier.id, invId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['supplier-invoices', supplier.id] });
      void qc.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Invoice removed');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const hasDebt = supplier.outstanding > 0;

  return (
    <>
      {editing && <SupplierModal supplier={supplier} onClose={() => setEditing(false)} />}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${hasDebt ? 'bg-red-50' : 'bg-green-50'}`}>
                <Building2 size={18} className={hasDebt ? 'text-red-500' : 'text-green-500'} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{supplier.name}</p>
                <div className="flex flex-wrap gap-2 mt-0.5">
                  {supplier.phone && (
                    <span className="flex items-center gap-1 text-[11px] text-gray-400">
                      <Phone size={10} />{supplier.phone}
                    </span>
                  )}
                  {supplier.address && (
                    <span className="flex items-center gap-1 text-[11px] text-gray-400">
                      <MapPin size={10} />{supplier.address}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => setEditing(true)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <Pencil size={14} />
              </button>
              <button
                onClick={() => { if (confirm(`Remove ${supplier.name}?`)) deleteMut.mutate(); }}
                className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-[10px] text-gray-500 mb-0.5">Total Purchased</p>
              <p className="text-sm font-bold text-gray-800">{pkr(supplier.totalAmount)}</p>
            </div>
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <p className="text-[10px] text-green-600 mb-0.5">Total Paid</p>
              <p className="text-sm font-bold text-green-700">{pkr(supplier.paidAmount)}</p>
            </div>
            <div className={`rounded-xl p-3 text-center ${hasDebt ? 'bg-red-50' : 'bg-gray-50'}`}>
              <p className={`text-[10px] mb-0.5 ${hasDebt ? 'text-red-500' : 'text-gray-400'}`}>Outstanding</p>
              <p className={`text-sm font-bold ${hasDebt ? 'text-red-600' : 'text-gray-400'}`}>
                {hasDebt ? pkr(supplier.outstanding) : '—'}
              </p>
            </div>
          </div>

          {supplier.iban && (
            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
              <CreditCard size={11} /><span className="font-mono">{supplier.iban}</span>
            </div>
          )}
        </div>

        {/* Expand/collapse invoices */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 border-t border-gray-100 text-xs font-medium text-gray-500 hover:bg-gray-100 transition"
        >
          <span>{supplier.invoiceCount} invoice{supplier.invoiceCount !== 1 ? 's' : ''}</span>
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>

        {expanded && (
          <div className="px-5 py-4 border-t border-gray-50">
            {addingInvoice && <InvoiceForm supplierId={supplier.id} onClose={() => setAddingInvoice(false)} />}

            {!addingInvoice && (
              <button
                onClick={() => setAddingInvoice(true)}
                className="w-full flex items-center justify-center gap-1.5 border border-dashed border-blue-300 text-blue-600 rounded-xl py-2.5 text-xs font-medium hover:bg-blue-50 transition mb-3"
              >
                <Plus size={13} /> Add Purchase Invoice
              </button>
            )}

            {invoices.length === 0 ? (
              <p className="text-center text-xs text-gray-400 py-3">No invoices yet</p>
            ) : (
              <div className="space-y-2">
                {invoices.map((inv) => (
                  <div key={inv.id} className={`rounded-xl border px-3 py-2.5 flex items-center gap-3 ${inv.outstanding > 0 ? 'border-red-100 bg-red-50' : 'border-green-100 bg-green-50'}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">{inv.description}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{inv.invoiceDate}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-gray-700">{pkr(inv.totalAmount)}</p>
                      {inv.outstanding > 0 ? (
                        <p className="text-[10px] text-red-500">Owed: {pkr(inv.outstanding)}</p>
                      ) : (
                        <p className="text-[10px] text-green-600">Paid</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      {inv.outstanding > 0 && (
                        <button
                          onClick={() => markPaidMut.mutate(inv)}
                          title="Mark fully paid"
                          className="p-1 rounded-md bg-green-100 hover:bg-green-200 text-green-600"
                        >
                          <Check size={12} />
                        </button>
                      )}
                      <button
                        onClick={() => deleteInvMut.mutate(inv.id)}
                        className="p-1 rounded-md hover:bg-red-100 text-gray-300 hover:text-red-500"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ── P&L Card ──────────────────────────────────────────────────────────────────
function PnLSection() {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState<number | undefined>(now.getMonth() + 1);

  const { data: pnl, isLoading } = useQuery<PnLData>({
    queryKey: ['pnl', year, month],
    queryFn:  () => suppliersApi.getPnL(year, month),
    staleTime: 3 * 60_000,
  });

  const currentYear = now.getFullYear();
  const yearOptions = Array.from({ length: currentYear - 2023 }, (_, i) => currentYear - i);

  function MetricRow({ label, value, sub, color }: { label: string; value: number; sub?: string; color: string }) {
    return (
      <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
        <div>
          <p className="text-sm text-gray-700">{label}</p>
          {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
        </div>
        <p className={`text-sm font-bold ${color}`}>{pkr(value)}</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden mt-6">
      <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-blue-500" />
          <div>
            <p className="text-sm font-semibold text-gray-900">Profit & Loss</p>
            <p className="text-xs text-gray-400">Revenue minus COGS and expenses</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={month ?? ''} onChange={(e) => setMonth(e.target.value ? Number(e.target.value) : undefined)}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-600">
            <option value="">Full Year</option>
            {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-600">
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
      ) : pnl ? (
        <div className="px-6 py-4">
          {/* Top summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="bg-blue-50 rounded-xl p-4 text-center">
              <p className="text-[10px] text-blue-600 font-medium uppercase tracking-wide mb-1">Revenue</p>
              <p className="text-lg font-extrabold text-blue-700">{pkr(pnl.totalRevenue)}</p>
            </div>
            <div className="bg-orange-50 rounded-xl p-4 text-center">
              <p className="text-[10px] text-orange-600 font-medium uppercase tracking-wide mb-1">COGS</p>
              <p className="text-lg font-extrabold text-orange-700">{pkr(pnl.cogsSales)}</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-4 text-center">
              <p className="text-[10px] text-purple-600 font-medium uppercase tracking-wide mb-1">Expenses</p>
              <p className="text-lg font-extrabold text-purple-700">{pkr(pnl.totalExpenses)}</p>
            </div>
            <div className={`rounded-xl p-4 text-center ${pnl.netProfit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <p className={`text-[10px] font-medium uppercase tracking-wide mb-1 ${pnl.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>Net Profit</p>
              <p className={`text-lg font-extrabold ${pnl.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>{pkr(pnl.netProfit)}</p>
            </div>
          </div>

          {/* Detailed breakdown */}
          <div className="bg-gray-50 rounded-xl px-4 py-2 mb-4">
            <MetricRow label="Installment Payments" value={pnl.installmentRevenue} color="text-gray-800" />
            <MetricRow label="Cash Sales" value={pnl.cashRevenue} color="text-gray-800" />
            <MetricRow label="Total Revenue" value={pnl.totalRevenue} color="text-blue-700" />
          </div>

          <div className="bg-gray-50 rounded-xl px-4 py-2 mb-4">
            <MetricRow label="Cost of Goods Sold" sub="Based on product purchase prices" value={pnl.cogsSales} color="text-orange-600" />
            <MetricRow label="Gross Profit" value={pnl.grossProfit} color={pnl.grossProfit >= 0 ? 'text-green-700' : 'text-red-600'} />
            {pnl.totalRevenue > 0 && (
              <div className="flex items-center justify-between py-2">
                <p className="text-xs text-gray-500">Gross Margin</p>
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                    <div className={`h-full rounded-full ${pnl.grossMarginPct >= 20 ? 'bg-green-500' : pnl.grossMarginPct >= 10 ? 'bg-orange-400' : 'bg-red-500'}`}
                      style={{ width: `${Math.max(0, Math.min(pnl.grossMarginPct, 100))}%` }} />
                  </div>
                  <span className="text-xs font-bold text-gray-700">{pnl.grossMarginPct}%</span>
                </div>
              </div>
            )}
          </div>

          <div className="bg-gray-50 rounded-xl px-4 py-2 mb-4">
            <MetricRow label="Total Expenses" value={pnl.totalExpenses} color="text-red-600" />
            <MetricRow label="Net Profit" value={pnl.netProfit} color={pnl.netProfit >= 0 ? 'text-green-700' : 'text-red-600'} />
          </div>

          {/* Supplier payables */}
          {pnl.supplierPurchases > 0 && (
            <div className="bg-yellow-50 border border-yellow-100 rounded-xl px-4 py-3 flex items-center gap-3">
              <AlertCircle size={15} className="text-yellow-500 shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-yellow-700">Supplier Payables This Period</p>
                <p className="text-[11px] text-yellow-600">
                  {pkr(pnl.supplierPurchases)} invoiced · {pkr(pnl.supplierPaid)} paid
                  {pnl.supplierOutstanding > 0 && ` · ${pkr(pnl.supplierOutstanding)} outstanding`}
                </p>
              </div>
            </div>
          )}

          {pnl.cogsSales === 0 && (
            <p className="text-xs text-gray-400 text-center mt-3">
              Add purchase prices to products to see accurate COGS & gross profit.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SuppliersPage() {
  const [showAdd, setShowAdd] = useState(false);

  const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn:  suppliersApi.list,
    staleTime: 3 * 60_000,
  });

  const totalOutstanding = suppliers.reduce((s, sup) => s + sup.outstanding, 0);

  return (
    <div className="px-4 py-5 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Suppliers</h1>
          <p className="text-sm text-gray-400 mt-0.5">{suppliers.length} vendor{suppliers.length !== 1 ? 's' : ''}
            {totalOutstanding > 0 && <> · <span className="text-red-500 font-medium">{pkr(totalOutstanding)} payable</span></>}
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition shadow-sm"
        >
          <Plus size={15} />Add Supplier
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2].map((i) => <div key={i} className="h-52 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : suppliers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Building2 size={40} className="text-gray-200 mb-3" />
          <p className="text-sm font-semibold text-gray-500">No suppliers yet</p>
          <p className="text-xs text-gray-400 mt-1">Add your first vendor to track purchase costs</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {suppliers.map((s) => <SupplierCard key={s.id} supplier={s} />)}
        </div>
      )}

      <PnLSection />

      {showAdd && <SupplierModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}
