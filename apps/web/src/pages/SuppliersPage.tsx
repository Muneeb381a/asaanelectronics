import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2, Plus, Phone, MapPin, CreditCard, Trash2, Pencil, X, Check,
  TrendingUp, AlertCircle, Package, ChevronDown, ChevronRight, FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { suppliersApi, type Supplier, type SupplierInvoice, type CreateInvoiceLine, type PnLData } from '../api/suppliers.api.ts';
import { productsApi } from '../api/products.api.ts';
import { getErrorMessage } from '../utils/error.ts';

const pkr  = (n: number) => 'PKR ' + n.toLocaleString('en-PK', { maximumFractionDigits: 0 });
const pkrSh = (v: number) => {
  if (v >= 10_00_000) return `${(v / 10_00_000).toFixed(1)}M`;
  if (v >= 1_00_000)  return `${(v / 1_00_000).toFixed(v % 1_00_000 === 0 ? 0 : 1)}L`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(v % 1_000 === 0 ? 0 : 1)}K`;
  return String(v);
};
const todayStr = () => new Date().toISOString().slice(0, 10);
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/* ══════════════════════════════════════════════════════════
   SUPPLIER FORM MODAL
══════════════════════════════════════════════════════════ */
function SupplierModal({ supplier, onClose }: { supplier?: Supplier; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name:    supplier?.name    ?? '',
    phone:   supplier?.phone   ?? '',
    address: supplier?.address ?? '',
    iban:    supplier?.iban    ?? '',
    notes:   supplier?.notes   ?? '',
  });
  const upd = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const mut = useMutation({
    mutationFn: () => supplier ? suppliersApi.update(supplier.id, form) : suppliersApi.create(form),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['suppliers'] }); toast.success(supplier ? 'Supplier update ho gaya' : 'Supplier add ho gaya'); onClose(); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-slate-950 flex items-center justify-between px-5 py-4">
          <p className="text-white font-black text-sm">{supplier ? 'Supplier Edit Karo' : 'Naya Supplier'}</p>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Naam *</label>
            <input value={form.name} onChange={upd('name')} autoFocus
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 transition"
              placeholder="Supplier / vendor naam" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Phone</label>
              <input value={form.phone} onChange={upd('phone')}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 transition"
                placeholder="03XX-XXXXXXX" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">IBAN / Account</label>
              <input value={form.iban} onChange={upd('iban')}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 transition"
                placeholder="PK..." />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Address</label>
            <input value={form.address} onChange={upd('address')}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 transition"
              placeholder="City, area..." />
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
          <button onClick={() => mut.mutate()} disabled={!form.name.trim() || mut.isPending}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 text-sm font-black disabled:opacity-40 transition">
            {mut.isPending ? 'Save ho raha…' : supplier ? 'Save Karo' : 'Add Karo'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   INVOICE MODAL
══════════════════════════════════════════════════════════ */
interface LineItem { productId: string; productName: string; quantity: number; unitPrice: string; }

function InvoiceModal({ supplierId, supplierName, onClose }: { supplierId: string; supplierName: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [invoiceDate, setInvoiceDate] = useState(todayStr());
  const [paidAmount,  setPaidAmount]  = useState('');
  const [notes,       setNotes]       = useState('');
  const [lines, setLines] = useState<LineItem[]>([{ productId: '', productName: '', quantity: 1, unitPrice: '' }]);

  const { data: productsData } = useQuery({ queryKey: ['products', 'invoice-picker'], queryFn: () => productsApi.list({ limit: 999 }), staleTime: 5 * 60_000 });
  const productList = productsData?.data ?? [];
  const total = lines.reduce((s, l) => s + l.quantity * (parseFloat(l.unitPrice) || 0), 0);

  const addLine    = () => setLines(p => [...p, { productId: '', productName: '', quantity: 1, unitPrice: '' }]);
  const removeLine = (i: number) => setLines(p => p.filter((_, j) => j !== i));
  const updateLine = (i: number, patch: Partial<LineItem>) => setLines(p => p.map((l, j) => j === i ? { ...l, ...patch } : l));
  const pickProduct = (i: number, productId: string) => {
    const p = productList.find(p => p.id === productId);
    if (p) updateLine(i, { productId: p.id, productName: p.name, unitPrice: p.purchasePrice ?? '' });
    else    updateLine(i, { productId: '', productName: '', unitPrice: '' });
  };

  const isValid = invoiceDate && lines.length > 0 && lines.every(l => l.productName.trim() && l.quantity > 0 && parseFloat(l.unitPrice) > 0);

  const mut = useMutation({
    mutationFn: () => {
      const payload: CreateInvoiceLine[] = lines.map(l => ({ productId: l.productId || undefined, productName: l.productName.trim(), quantity: l.quantity, unitPrice: parseFloat(l.unitPrice) }));
      return suppliersApi.createInvoice(supplierId, { invoiceDate, paidAmount: paidAmount ? Number(paidAmount) : 0, description: notes.trim() || undefined, lines: payload });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['supplier-invoices', supplierId] });
      void qc.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Invoice add ho gaya — stock update ho gaya');
      onClose();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="bg-slate-950 flex items-center justify-between px-5 py-4 shrink-0">
          <div>
            <p className="text-white font-black text-sm">Purchase Invoice</p>
            <p className="text-slate-400 text-xs mt-0.5">{supplierName}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Invoice Date *</label>
              <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 transition" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Paid Amount (PKR)</label>
              <input type="number" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} min={0}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 transition"
                placeholder="0 = sirf record karo" />
            </div>
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-black text-slate-600 uppercase tracking-wide">Items *</label>
              <button onClick={addLine} className="flex items-center gap-1 text-xs font-black text-blue-600 hover:text-blue-700">
                <Plus size={11} /> Item Add
              </button>
            </div>
            <div className="grid gap-1 mb-1 px-0.5" style={{ gridTemplateColumns: '1fr 56px 100px 80px 28px' }}>
              {['Product','Qty','Unit Price','Total',''].map((h,i) => (
                <span key={i} className={`text-[10px] font-bold text-slate-400 uppercase tracking-wide ${i === 3 ? 'text-right' : ''}`}>{h}</span>
              ))}
            </div>
            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="grid gap-2 items-start" style={{ gridTemplateColumns: '1fr 56px 100px 80px 28px' }}>
                  <div className="flex flex-col gap-1">
                    <select value={line.productId} onChange={e => pickProduct(i, e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400 bg-white">
                      <option value="">— custom —</option>
                      {productList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    {!line.productId && (
                      <input value={line.productName} onChange={e => updateLine(i, { productName: e.target.value })}
                        className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400"
                        placeholder="Product naam" />
                    )}
                  </div>
                  <input type="number" value={line.quantity} min={1} onChange={e => updateLine(i, { quantity: Math.max(1, Number(e.target.value)) })}
                    className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none focus:border-blue-400" />
                  <input type="number" value={line.unitPrice} min={0} onChange={e => updateLine(i, { unitPrice: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400" placeholder="PKR" />
                  <span className="text-xs font-bold text-slate-700 text-right tabular-nums pt-1.5">
                    {line.unitPrice ? pkr(line.quantity * parseFloat(line.unitPrice)) : '—'}
                  </span>
                  <button onClick={() => removeLine(i)} disabled={lines.length === 1}
                    className="pt-1.5 text-slate-300 hover:text-red-400 disabled:opacity-20 transition flex justify-center">
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-100">
              <span className="text-xs text-slate-500">Grand Total</span>
              <span className="text-base font-black text-slate-900 tabular-nums">{pkr(total)}</span>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Notes</label>
            <input value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 transition"
              placeholder="e.g. bank transfer se pay kiya" />
          </div>

          <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
            <Package size={12} className="text-blue-500 shrink-0" />
            <p className="text-[11px] text-blue-700">Har linked product ka stock automatically barh jaye ga.</p>
          </div>
        </div>

        <div className="flex gap-2 px-5 pb-5 pt-3 border-t border-slate-100 shrink-0">
          <button onClick={onClose} className="flex-1 border border-slate-200 rounded-xl py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition">Wapas</button>
          <button onClick={() => mut.mutate()} disabled={!isValid || mut.isPending}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 text-sm font-black disabled:opacity-40 transition">
            {mut.isPending ? 'Add ho raha…' : `Invoice Add · ${pkr(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   SUPPLIER ROW (accordion)
══════════════════════════════════════════════════════════ */
function SupplierRow({ supplier, index }: { supplier: Supplier; index: number }) {
  const qc = useQueryClient();
  const [expanded,      setExpanded]      = useState(false);
  const [editing,       setEditing]       = useState(false);
  const [addingInvoice, setAddingInvoice] = useState(false);
  const [expandedInv,   setExpandedInv]   = useState<string | null>(null);

  const { data: invoices = [] } = useQuery<SupplierInvoice[]>({
    queryKey: ['supplier-invoices', supplier.id],
    queryFn:  () => suppliersApi.listInvoices(supplier.id),
    enabled:  expanded,
    staleTime: 2 * 60_000,
  });

  const deleteMut = useMutation({
    mutationFn: () => suppliersApi.remove(supplier.id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['suppliers'] }); toast.success('Supplier hata diya'); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const markPaidMut = useMutation({
    mutationFn: (inv: SupplierInvoice) => suppliersApi.updateInvoicePaid(supplier.id, inv.id, inv.totalAmount),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['supplier-invoices', supplier.id] }); void qc.invalidateQueries({ queryKey: ['suppliers'] }); toast.success('Paid mark ho gaya'); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const deleteInvMut = useMutation({
    mutationFn: (invId: string) => suppliersApi.deleteInvoice(supplier.id, invId),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['supplier-invoices', supplier.id] }); void qc.invalidateQueries({ queryKey: ['suppliers'] }); toast.success('Invoice hata diya'); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const hasDebt = supplier.outstanding > 0;
  const initials = supplier.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const avatarColors = ['bg-blue-100 text-blue-700','bg-violet-100 text-violet-700','bg-emerald-100 text-emerald-700','bg-amber-100 text-amber-700','bg-rose-100 text-rose-700'];
  const avatarCls = avatarColors[index % avatarColors.length];

  return (
    <>
      {editing       && <SupplierModal supplier={supplier}    onClose={() => setEditing(false)} />}
      {addingInvoice && <InvoiceModal  supplierId={supplier.id} supplierName={supplier.name} onClose={() => setAddingInvoice(false)} />}

      {/* Main row */}
      <div className={`${index > 0 ? 'border-t border-slate-100' : ''}`}>
        <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/60 transition">
          {/* Avatar */}
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${avatarCls}`}>
            {initials}
          </div>

          {/* Name + contact */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-slate-900 truncate">{supplier.name}</p>
              {hasDebt && <span className="hidden sm:inline-flex text-[9px] font-black bg-red-100 text-red-600 px-1.5 py-0.5 rounded shrink-0">Baaki</span>}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {supplier.phone   && <span className="flex items-center gap-1 text-[10px] text-slate-400"><Phone size={9}/>{supplier.phone}</span>}
              {supplier.address && <span className="flex items-center gap-1 text-[10px] text-slate-400"><MapPin size={9}/>{supplier.address}</span>}
            </div>
          </div>

          {/* Amounts — desktop */}
          <div className="hidden md:flex items-center gap-5 shrink-0">
            <div className="text-right">
              <p className="text-[10px] text-slate-400">Kharida</p>
              <p className="text-sm font-black text-slate-800 tabular-nums">{pkrSh(supplier.totalAmount)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-400">Diya</p>
              <p className="text-sm font-black text-emerald-600 tabular-nums">{pkrSh(supplier.paidAmount)}</p>
            </div>
            <div className="text-right w-20">
              <p className="text-[10px] text-slate-400">Baaki</p>
              <p className={`text-sm font-black tabular-nums ${hasDebt ? 'text-red-600' : 'text-slate-300'}`}>
                {hasDebt ? pkrSh(supplier.outstanding) : '—'}
              </p>
            </div>
          </div>

          {/* Invoice count */}
          <div className="shrink-0 text-center w-14 hidden sm:block">
            <p className="text-[10px] text-slate-400">Invoices</p>
            <p className="text-sm font-black text-slate-700">{supplier.invoiceCount}</p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setAddingInvoice(true)} title="Add invoice"
              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-black text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition">
              <Plus size={11} /> Invoice
            </button>
            <button onClick={() => setEditing(true)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition">
              <Pencil size={13} />
            </button>
            <button onClick={() => { if (confirm(`${supplier.name} ko hata dein?`)) deleteMut.mutate(); }}
              className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition">
              <Trash2 size={13} />
            </button>
            <button onClick={() => setExpanded(v => !v)}
              className={`p-1.5 rounded-lg transition ${expanded ? 'bg-slate-100 text-slate-700' : 'text-slate-400 hover:bg-slate-100'}`}>
              <ChevronDown size={14} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* Mobile amounts */}
        <div className="md:hidden flex gap-3 px-4 pb-3">
          <div className="flex-1 bg-slate-50 rounded-xl px-3 py-2 text-center">
            <p className="text-[9px] text-slate-400">Kharida</p>
            <p className="text-xs font-black text-slate-800 tabular-nums">{pkrSh(supplier.totalAmount)}</p>
          </div>
          <div className="flex-1 bg-emerald-50 rounded-xl px-3 py-2 text-center">
            <p className="text-[9px] text-emerald-500">Diya</p>
            <p className="text-xs font-black text-emerald-600 tabular-nums">{pkrSh(supplier.paidAmount)}</p>
          </div>
          {hasDebt && (
            <div className="flex-1 bg-red-50 rounded-xl px-3 py-2 text-center">
              <p className="text-[9px] text-red-400">Baaki</p>
              <p className="text-xs font-black text-red-600 tabular-nums">{pkrSh(supplier.outstanding)}</p>
            </div>
          )}
        </div>

        {/* Supplier IBAN */}
        {supplier.iban && expanded && (
          <div className="mx-4 mb-2 flex items-center gap-1.5 text-[11px] text-slate-400 bg-slate-50 rounded-lg px-3 py-1.5">
            <CreditCard size={10} /> <span className="font-mono">{supplier.iban}</span>
          </div>
        )}

        {/* Invoice accordion */}
        {expanded && (
          <div className="border-t border-slate-100 bg-slate-50/50">
            <div className="px-4 py-3">
              {invoices.length === 0 ? (
                <div className="text-center py-5">
                  <FileText size={24} className="text-slate-200 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">Koi invoice nahi</p>
                  <button onClick={() => setAddingInvoice(true)}
                    className="mt-2 text-xs font-black text-blue-600 hover:underline">
                    Pehla invoice add karo →
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {invoices.map(inv => {
                    const isPaid = inv.outstanding === 0;
                    return (
                      <div key={inv.id} className={`rounded-xl border overflow-hidden ${isPaid ? 'border-emerald-100 bg-white' : 'border-red-100 bg-white'}`}>
                        <div className="flex items-center gap-3 px-3 py-2.5">
                          <button onClick={() => setExpandedInv(expandedInv === inv.id ? null : inv.id)}
                            className="flex-1 min-w-0 flex items-center gap-2 text-left">
                            <ChevronRight size={12} className={`shrink-0 text-slate-400 transition-transform ${expandedInv === inv.id ? 'rotate-90' : ''}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-800 truncate">{inv.description || `Invoice · ${inv.invoiceDate}`}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-slate-400">{inv.invoiceDate}</span>
                                {inv.lines.length > 0 && <span className="text-[10px] text-blue-500">{inv.lines.length} item</span>}
                              </div>
                            </div>
                          </button>
                          <div className="text-right shrink-0 mr-2">
                            <p className="text-xs font-black text-slate-900 tabular-nums">{pkr(inv.totalAmount)}</p>
                            {isPaid
                              ? <p className="text-[10px] font-bold text-emerald-600">Paid ✓</p>
                              : <p className="text-[10px] font-bold text-red-500">Baaki: {pkr(inv.outstanding)}</p>}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            {!isPaid && (
                              <button onClick={() => markPaidMut.mutate(inv)} title="Mark paid"
                                className="p-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-600 transition">
                                <Check size={11} />
                              </button>
                            )}
                            <button onClick={() => deleteInvMut.mutate(inv.id)}
                              className="p-1.5 rounded-lg hover:bg-red-100 text-slate-300 hover:text-red-500 transition">
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                        {expandedInv === inv.id && inv.lines.length > 0 && (
                          <div className="border-t border-slate-100 px-4 pb-2.5 pt-2 bg-slate-50/60">
                            <div className="space-y-1">
                              {inv.lines.map(line => (
                                <div key={line.id} className="flex items-center justify-between">
                                  <span className="text-[11px] text-slate-600">{line.productName} <span className="text-slate-400">×{line.quantity}</span></span>
                                  <span className="text-[11px] font-bold text-slate-700 tabular-nums">{pkr(line.quantity * line.unitPrice)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════
   P&L SECTION
══════════════════════════════════════════════════════════ */
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
  const yearOptions = Array.from({ length: Math.max(1, currentYear - 2023) }, (_, i) => currentYear - i);

  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
            <TrendingUp size={13} className="text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-black text-slate-900">Profit & Loss</p>
            <p className="text-[10px] text-slate-400">Revenue minus COGS and expenses</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={month ?? ''} onChange={e => setMonth(e.target.value ? Number(e.target.value) : undefined)}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-600 focus:outline-none focus:border-blue-400 bg-white">
            <option value="">Full Year</option>
            {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-600 focus:outline-none focus:border-blue-400 bg-white">
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="px-4 py-8 flex items-center justify-center">
          <div className="flex gap-3">
            {[0,1,2,3].map(i => <div key={i} className="w-24 h-16 bg-slate-100 rounded-xl animate-pulse" />)}
          </div>
        </div>
      ) : pnl ? (
        <div className="p-4 space-y-4">
          {/* Top 4 KPI tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="border-l-4 border-blue-500 bg-blue-50/50 rounded-r-xl px-3 py-2.5">
              <p className="text-[9px] font-bold text-blue-500 uppercase tracking-widest mb-1">Revenue</p>
              <p className="text-xl font-black text-blue-700 tabular-nums">{pkrSh(pnl.totalRevenue)}</p>
              <p className="text-[10px] text-blue-400 mt-0.5 tabular-nums">{pkr(pnl.totalRevenue)}</p>
            </div>
            <div className="border-l-4 border-orange-400 bg-orange-50/50 rounded-r-xl px-3 py-2.5">
              <p className="text-[9px] font-bold text-orange-500 uppercase tracking-widest mb-1">COGS</p>
              <p className="text-xl font-black text-orange-700 tabular-nums">{pkrSh(pnl.cogsSales)}</p>
              <p className="text-[10px] text-orange-400 mt-0.5 tabular-nums">{pkr(pnl.cogsSales)}</p>
            </div>
            <div className="border-l-4 border-violet-400 bg-violet-50/50 rounded-r-xl px-3 py-2.5">
              <p className="text-[9px] font-bold text-violet-500 uppercase tracking-widest mb-1">Expenses</p>
              <p className="text-xl font-black text-violet-700 tabular-nums">{pkrSh(pnl.totalExpenses)}</p>
              <p className="text-[10px] text-violet-400 mt-0.5 tabular-nums">{pkr(pnl.totalExpenses)}</p>
            </div>
            <div className={`border-l-4 rounded-r-xl px-3 py-2.5 ${pnl.netProfit >= 0 ? 'border-emerald-500 bg-emerald-50/50' : 'border-red-500 bg-red-50/50'}`}>
              <p className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${pnl.netProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>Net Profit</p>
              <p className={`text-xl font-black tabular-nums ${pnl.netProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{pnl.netProfit >= 0 ? '' : '-'}{pkrSh(Math.abs(pnl.netProfit))}</p>
              <p className={`text-[10px] mt-0.5 tabular-nums ${pnl.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{pkr(Math.abs(pnl.netProfit))}</p>
            </div>
          </div>

          {/* Revenue breakdown */}
          <div className="bg-slate-50 rounded-xl overflow-hidden">
            <div className="px-4 py-2 bg-slate-100/80 border-b border-slate-200">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Revenue Breakdown</p>
            </div>
            {[
              { label: 'Installment Payments', val: pnl.installmentRevenue, cls: 'text-slate-800' },
              { label: 'Cash Sales',           val: pnl.cashRevenue,        cls: 'text-slate-800' },
              { label: 'Total Revenue',        val: pnl.totalRevenue,       cls: 'text-blue-700 font-black' },
            ].map((r, i) => (
              <div key={i} className={`flex justify-between px-4 py-2.5 ${i < 2 ? 'border-b border-slate-100' : ''}`}>
                <p className="text-xs text-slate-600">{r.label}</p>
                <p className={`text-xs font-bold tabular-nums ${r.cls}`}>{pkr(r.val)}</p>
              </div>
            ))}
          </div>

          {/* Gross profit */}
          <div className="bg-slate-50 rounded-xl overflow-hidden">
            <div className="px-4 py-2 bg-slate-100/80 border-b border-slate-200">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Gross Profit</p>
            </div>
            <div className="flex justify-between px-4 py-2.5 border-b border-slate-100">
              <div>
                <p className="text-xs text-slate-600">Cost of Goods Sold</p>
                <p className="text-[10px] text-slate-400">Product purchase prices per sale</p>
              </div>
              <p className="text-xs font-bold text-orange-600 tabular-nums">{pkr(pnl.cogsSales)}</p>
            </div>
            <div className="flex justify-between px-4 py-2.5 border-b border-slate-100">
              <p className="text-xs text-slate-600">Gross Profit</p>
              <p className={`text-xs font-black tabular-nums ${pnl.grossProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{pkr(pnl.grossProfit)}</p>
            </div>
            {pnl.totalRevenue > 0 && (
              <div className="flex items-center gap-3 px-4 py-2.5">
                <p className="text-xs text-slate-500">Gross Margin</p>
                <div className="flex-1 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                  <div className={`h-full rounded-full ${pnl.grossMarginPct >= 20 ? 'bg-emerald-500' : pnl.grossMarginPct >= 10 ? 'bg-amber-400' : 'bg-red-500'}`}
                    style={{ width: `${Math.max(0, Math.min(pnl.grossMarginPct, 100))}%` }} />
                </div>
                <p className="text-xs font-black text-slate-700 tabular-nums w-10 text-right">{pnl.grossMarginPct}%</p>
              </div>
            )}
          </div>

          {/* Net profit */}
          <div className="bg-slate-50 rounded-xl overflow-hidden">
            <div className="px-4 py-2 bg-slate-100/80 border-b border-slate-200">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Net Profit</p>
            </div>
            <div className="flex justify-between px-4 py-2.5 border-b border-slate-100">
              <p className="text-xs text-slate-600">Total Expenses</p>
              <p className="text-xs font-bold text-red-500 tabular-nums">{pkr(pnl.totalExpenses)}</p>
            </div>
            <div className="flex justify-between px-4 py-2.5">
              <p className="text-xs font-black text-slate-800">Net Profit</p>
              <p className={`text-sm font-black tabular-nums ${pnl.netProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{pkr(pnl.netProfit)}</p>
            </div>
          </div>

          {/* Supplier payables alert */}
          {pnl.supplierPurchases > 0 && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
              <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-black text-amber-700">Supplier Payables — Is Period</p>
                <p className="text-[11px] text-amber-600 mt-0.5">
                  {pkr(pnl.supplierPurchases)} invoiced · {pkr(pnl.supplierPaid)} paid
                  {pnl.supplierOutstanding > 0 && <span className="font-black"> · {pkr(pnl.supplierOutstanding)} baaki</span>}
                </p>
              </div>
            </div>
          )}

          {pnl.cogsSales === 0 && (
            <p className="text-xs text-slate-400 text-center">
              Products mein purchase price add karo COGS aur gross profit dekhne k liye.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════ */
export default function SuppliersPage() {
  const [showAdd, setShowAdd] = useState(false);

  const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn:  suppliersApi.list,
    staleTime: 3 * 60_000,
  });

  const totalPurchased    = suppliers.reduce((s, sup) => s + sup.totalAmount,  0);
  const totalPaid         = suppliers.reduce((s, sup) => s + sup.paidAmount,   0);
  const totalOutstanding  = suppliers.reduce((s, sup) => s + sup.outstanding,  0);

  return (
    <div className="bg-slate-100">

      {/* ── DARK HEADER ── */}
      <div className="bg-slate-950 px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div>
            <h1 className="text-base font-black text-white">Suppliers</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {suppliers.length} vendor
              {totalOutstanding > 0 && (
                <span className="text-red-400 font-black"> · {pkr(totalOutstanding)} baaki hai</span>
              )}
            </p>
          </div>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-black transition shadow-sm shadow-blue-900">
            <Plus size={13} /> Supplier Add
          </button>
        </div>
      </div>

      {/* ── KPI STRIP ── */}
      {!isLoading && suppliers.length > 0 && (
        <div className="bg-white border-b border-slate-200 shadow-sm">
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100 max-w-5xl mx-auto">
            {[
              { label: 'Total Kharida',   val: pkrSh(totalPurchased),   full: pkr(totalPurchased),  dot: 'bg-slate-400',   vCls: 'text-slate-900' },
              { label: 'Total Diya',      val: pkrSh(totalPaid),        full: pkr(totalPaid),        dot: 'bg-emerald-500', vCls: 'text-emerald-700' },
              { label: 'Baaki Hai',       val: pkrSh(totalOutstanding), full: pkr(totalOutstanding), dot: totalOutstanding > 0 ? 'bg-red-500' : 'bg-slate-300', vCls: totalOutstanding > 0 ? 'text-red-600' : 'text-slate-300' },
              { label: 'Suppliers',       val: String(suppliers.length), full: `${suppliers.length} vendors`, dot: 'bg-blue-500', vCls: 'text-slate-900' },
            ].map((t, i) => (
              <div key={i} className="px-4 py-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.label}</p>
                </div>
                <p className={`text-2xl font-black tabular-nums ${t.vCls}`}>{t.val}</p>
                <p className="text-[11px] text-slate-400 mt-0.5 tabular-nums">{t.full}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── BODY ── */}
      <div className="px-3 sm:px-5 py-4 max-w-5xl mx-auto space-y-4">

        {/* Suppliers list */}
        <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden">
          {/* Table header (desktop) */}
          {suppliers.length > 0 && (
            <div className="hidden md:grid px-4 py-2 bg-slate-50 border-b border-slate-100" style={{ gridTemplateColumns: '1fr 96px 96px 96px 88px 180px' }}>
              {['Supplier','Kharida','Diya','Baaki','Invoices',''].map((h, i) => (
                <p key={i} className={`text-[10px] font-black text-slate-400 uppercase tracking-widest ${i >= 1 && i <= 3 ? 'text-right' : ''}`}>{h}</p>
              ))}
            </div>
          )}

          {isLoading ? (
            <div className="divide-y divide-slate-50">
              {[0,1,2].map(i => (
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
          ) : suppliers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-3">
                <Building2 size={28} className="text-slate-300" />
              </div>
              <p className="text-sm font-black text-slate-600">Koi supplier nahi</p>
              <p className="text-xs text-slate-400 mt-1 mb-4">Vendors add karo purchase cost track karne k liye</p>
              <button onClick={() => setShowAdd(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-black rounded-xl hover:bg-blue-700 transition">
                <Plus size={12} /> Pehla Supplier Add Karo
              </button>
            </div>
          ) : (
            <div>
              {suppliers.map((s, i) => <SupplierRow key={s.id} supplier={s} index={i} />)}
            </div>
          )}
        </div>

        {/* P&L Section */}
        <PnLSection />

      </div>

      {showAdd && <SupplierModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}
