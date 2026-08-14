import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, Phone, MapPin, CreditCard, ChevronDown, ChevronUp, Trash2, Pencil, X, Check, TrendingUp, AlertCircle, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { suppliersApi, type Supplier, type SupplierInvoice, type CreateInvoiceLine, type PnLData } from '../api/suppliers.api.ts';
import { productsApi } from '../api/products.api.ts';
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

// ── Invoice Modal ─────────────────────────────────────────────────────────────
interface LineItem {
  productId:   string;
  productName: string;
  quantity:    number;
  unitPrice:   string;
}

function InvoiceModal({ supplierId, onClose }: { supplierId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [invoiceDate, setInvoiceDate] = useState(todayStr());
  const [paidAmount, setPaidAmount]   = useState('');
  const [notes, setNotes]             = useState('');
  const [lines, setLines]             = useState<LineItem[]>([
    { productId: '', productName: '', quantity: 1, unitPrice: '' },
  ]);

  const { data: productsData } = useQuery({
    queryKey: ['products', 'invoice-picker'],
    queryFn:  () => productsApi.list({ limit: 999 }),
    staleTime: 5 * 60_000,
  });
  const productList = productsData?.data ?? [];

  const total = lines.reduce((s, l) => s + l.quantity * (parseFloat(l.unitPrice) || 0), 0);

  function addLine() {
    setLines((prev) => [...prev, { productId: '', productName: '', quantity: 1, unitPrice: '' }]);
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, j) => j !== i));
  }

  function updateLine(i: number, patch: Partial<LineItem>) {
    setLines((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  function pickProduct(i: number, productId: string) {
    const p = productList.find((p) => p.id === productId);
    if (p) {
      updateLine(i, {
        productId:   p.id,
        productName: p.name,
        unitPrice:   p.purchasePrice ?? '',
      });
    } else {
      updateLine(i, { productId: '', productName: '', unitPrice: '' });
    }
  }

  const isValid =
    invoiceDate &&
    lines.length > 0 &&
    lines.every((l) => l.productName.trim() && l.quantity > 0 && parseFloat(l.unitPrice) > 0);

  const mut = useMutation({
    mutationFn: () => {
      const payload: CreateInvoiceLine[] = lines.map((l) => ({
        productId:   l.productId || undefined,
        productName: l.productName.trim(),
        quantity:    l.quantity,
        unitPrice:   parseFloat(l.unitPrice),
      }));
      return suppliersApi.createInvoice(supplierId, {
        invoiceDate,
        paidAmount:  paidAmount ? Number(paidAmount) : 0,
        description: notes.trim() || undefined,
        lines:       payload,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['supplier-invoices', supplierId] });
      void qc.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Invoice added — stock updated');
      onClose();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-semibold text-gray-900">New Purchase Invoice</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Date + Paid amount */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Invoice Date *</label>
              <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Amount Paid (PKR)</label>
              <input type="number" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0 = record only" min={0} />
            </div>
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-700">Items *</label>
              <button
                type="button"
                onClick={addLine}
                className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                <Plus size={12} /> Add Item
              </button>
            </div>

            {/* Column headers */}
            <div className="grid gap-2 mb-1 px-1" style={{ gridTemplateColumns: '1fr 52px 96px 72px 28px' }}>
              <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Product</span>
              <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Qty</span>
              <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Unit Price</span>
              <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide text-right">Total</span>
              <span />
            </div>

            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="grid gap-2 items-center" style={{ gridTemplateColumns: '1fr 52px 96px 72px 28px' }}>
                  {/* Product column: select + optional name input */}
                  <div className="flex flex-col gap-1">
                    <select
                      value={line.productId}
                      onChange={(e) => pickProduct(i, e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                    >
                      <option value="">— custom —</option>
                      {productList.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    {!line.productId && (
                      <input
                        value={line.productName}
                        onChange={(e) => updateLine(i, { productName: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                        placeholder="Product name"
                      />
                    )}
                  </div>

                  {/* Qty */}
                  <input
                    type="number"
                    value={line.quantity}
                    onChange={(e) => updateLine(i, { quantity: Math.max(1, Number(e.target.value)) })}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-400"
                    min={1}
                  />

                  {/* Unit price */}
                  <input
                    type="number"
                    value={line.unitPrice}
                    onChange={(e) => updateLine(i, { unitPrice: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                    placeholder="PKR"
                    min={0}
                  />

                  {/* Line total */}
                  <span className="text-xs font-medium text-gray-600 text-right tabular-nums">
                    {line.quantity && line.unitPrice
                      ? pkr(line.quantity * parseFloat(line.unitPrice))
                      : '—'}
                  </span>

                  {/* Remove */}
                  <button
                    type="button"
                    onClick={() => removeLine(i)}
                    disabled={lines.length === 1}
                    className="flex items-center justify-center text-gray-300 hover:text-red-400 disabled:opacity-20"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>

            {/* Grand total */}
            <div className="flex justify-end mt-3 pt-3 border-t border-gray-100 gap-4 items-center">
              <span className="text-xs text-gray-500">Grand Total</span>
              <span className="text-sm font-bold text-gray-900 tabular-nums">{pkr(total)}</span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes (optional)</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. paid via bank transfer, batch received"
            />
          </div>

          {/* Stock update notice */}
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
            <Package size={13} className="text-blue-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-blue-700">
              Stock will automatically increase for each linked product when this invoice is saved.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-5 pt-3 border-t border-gray-50 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => mut.mutate()}
            disabled={!isValid || mut.isPending}
            className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {mut.isPending ? 'Adding…' : `Add Invoice · ${pkr(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Supplier Card ─────────────────────────────────────────────────────────────
function SupplierCard({ supplier }: { supplier: Supplier }) {
  const qc = useQueryClient();
  const [expanded, setExpanded]           = useState(false);
  const [editing, setEditing]             = useState(false);
  const [addingInvoice, setAddingInvoice] = useState(false);
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);

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
      {addingInvoice && <InvoiceModal supplierId={supplier.id} onClose={() => setAddingInvoice(false)} />}
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
            <button
              onClick={() => setAddingInvoice(true)}
              className="w-full flex items-center justify-center gap-1.5 border border-dashed border-blue-300 text-blue-600 rounded-xl py-2.5 text-xs font-medium hover:bg-blue-50 transition mb-3"
            >
              <Plus size={13} /> Add Purchase Invoice
            </button>

            {invoices.length === 0 ? (
              <p className="text-center text-xs text-gray-400 py-3">No invoices yet</p>
            ) : (
              <div className="space-y-2">
                {invoices.map((inv) => (
                  <div key={inv.id} className={`rounded-xl border ${inv.outstanding > 0 ? 'border-red-100 bg-red-50' : 'border-green-100 bg-green-50'}`}>
                    {/* Invoice header row */}
                    <div className="px-3 py-2.5 flex items-center gap-3">
                      <button
                        onClick={() => setExpandedInvoice(expandedInvoice === inv.id ? null : inv.id)}
                        className="flex-1 min-w-0 text-left"
                      >
                        <p className="text-xs font-semibold text-gray-800 truncate">{inv.description}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-gray-400">{inv.invoiceDate}</span>
                          {inv.lines.length > 0 && (
                            <span className="text-[10px] text-blue-500">{inv.lines.length} item{inv.lines.length !== 1 ? 's' : ''}</span>
                          )}
                        </div>
                      </button>
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

                    {/* Line items — expand on click */}
                    {expandedInvoice === inv.id && inv.lines.length > 0 && (
                      <div className="border-t border-black/5 px-3 pb-3 pt-2">
                        <div className="space-y-1">
                          {inv.lines.map((line) => (
                            <div key={line.id} className="flex items-center justify-between text-[11px]">
                              <span className="text-gray-600 truncate">{line.productName} <span className="text-gray-400">×{line.quantity}</span></span>
                              <span className="text-gray-700 font-medium tabular-nums ml-3 shrink-0">{pkr(line.quantity * line.unitPrice)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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
