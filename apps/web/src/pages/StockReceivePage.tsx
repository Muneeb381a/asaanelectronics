import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Plus, Trash2, Copy, ChevronDown,
  Package, Smartphone, Bike, AlertCircle, CheckCircle2,
  ClipboardList, UserPlus, X, Loader2,
} from 'lucide-react';
import { suppliersApi } from '../api/suppliers.api.ts';
import { productsApi, type BulkReceiveUnit } from '../api/products.api.ts';
import CategoryCombobox from '../components/ui/CategoryCombobox.tsx';

// ─── types ──────────────────────────────────────────────────────────────────

type ProductType = 'mobile' | 'vehicle' | 'other';

interface RowData {
  _id:              string;
  // identifiers
  imeiNumber:       string;
  chassisNumber:    string;
  engineNumber:     string;
  registrationNumber: string;
  // common descriptive
  color:            string;
  modelYear:        string;
  vehicleCondition: 'NEW' | 'USED' | '';
  // prices
  purchasePrice:    string;
  price:            string;         // sale price
  installmentPrice: string;
  // status (vehicle)
  letterStatus:     string;
  biometricStatus:  string;
  vehicleFileLocation: string;
  // phone
  storageGb:        string;
  // misc
  description:      string;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2); }

function emptyRow(): RowData {
  return {
    _id: uid(), imeiNumber: '', chassisNumber: '', engineNumber: '',
    registrationNumber: '', color: '', modelYear: '', vehicleCondition: '',
    purchasePrice: '', price: '', installmentPrice: '',
    letterStatus: '', biometricStatus: '', vehicleFileLocation: '',
    storageGb: '', description: '',
  };
}

function pkr(n: number) {
  return n.toLocaleString('en-PK', { maximumFractionDigits: 0 });
}

const LETTER_OPTIONS  = ['NONE','FIRST_NOTICE','SECOND_NOTICE','LEGAL_NOTICE','FILED'] as const;
const BIO_OPTIONS     = ['PENDING','SELLER_DONE','BUYER_DONE','COMPLETED','NOT_REQUIRED'] as const;
const STORAGE_OPTIONS = ['2','4','6','8','12','16','32','64','128','256','512'] as const;

// ─── sub-components ──────────────────────────────────────────────────────────

const inp = 'w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-white placeholder:text-slate-300 transition';
const sel = `${inp} cursor-pointer`;

function Sel({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void;
  options: readonly string[]; placeholder?: string;
}) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)} className={sel}>
        <option value="">{placeholder ?? '—'}</option>
        {options.map((o) => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
      </select>
      <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function StockReceivePage() {
  const navigate    = useNavigate();
  const qc          = useQueryClient();
  // ── step 1 state ──
  const [supplierId,      setSupplierId]      = useState('');
  const [showQuickSupplier, setShowQuickSupplier] = useState(false);
  const [quickSupName,    setQuickSupName]    = useState('');
  const [quickSupPhone,   setQuickSupPhone]   = useState('');
  const [quickSupErr,     setQuickSupErr]     = useState('');
  const [productName,  setProductName]  = useState('');
  const [category,     setCategory]     = useState('');
  const [brand,        setBrand]        = useState('');
  const [model,        setModel]        = useState('');
  const [productType,  setProductType]  = useState<ProductType>('mobile');
  const [qty,          setQty]          = useState('1');
  const [invoiceDate,  setInvoiceDate]  = useState(() => new Date().toISOString().slice(0, 10));
  const [paidAmount,   setPaidAmount]   = useState('0');

  // default prices (fill-all)
  const [defBuy,  setDefBuy]  = useState('');
  const [defSale, setDefSale] = useState('');
  const [defInst, setDefInst] = useState('');

  // ── rows ──
  const [rows, setRows] = useState<RowData[]>([emptyRow()]);
  const [tableReady, setTableReady] = useState(false);

  // queries
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn:  suppliersApi.list,
    staleTime: 5 * 60_000,
  });
  const { data: dbCategories = [] } = useQuery({
    queryKey: ['product-categories'],
    queryFn:  productsApi.getCategories,
    staleTime: 5 * 60_000,
  });

  const quickSupplierMut = useMutation({
    mutationFn: () => suppliersApi.create({ name: quickSupName.trim(), phone: quickSupPhone.trim() || undefined }),
    onSuccess: (s) => {
      void qc.invalidateQueries({ queryKey: ['suppliers'] });
      setSupplierId(s.id);
      setShowQuickSupplier(false);
      setQuickSupName(''); setQuickSupPhone(''); setQuickSupErr('');
      toast.success(`Supplier "${s.name}" save ho gaya`);
    },
    onError: () => setQuickSupErr('Save nahi hua — dobara try karein'),
  });

  // mutation
  const saveMutation = useMutation({
    mutationFn: (units: BulkReceiveUnit[]) =>
      productsApi.bulkReceive({
        supplierId:  supplierId || undefined,
        invoiceDate: invoiceDate || undefined,
        paidAmount:  paidAmount ? Number(paidAmount) : 0,
        units,
      }),
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: ['products'] });
      void qc.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success(`${created.length} products stock mein shamil ho gaye!`);
      navigate('/products');
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : 'Save nahi hua, dobara try karein');
    },
  });

  // ── row helpers ──
  const updateRow = useCallback((id: string, field: keyof RowData, value: string) => {
    setRows((prev) => prev.map((r) => r._id === id ? { ...r, [field]: value } : r));
  }, []);

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (id: string) => setRows((prev) => prev.length > 1 ? prev.filter((r) => r._id !== id) : prev);
  const duplicateRow = (id: string) => {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r._id === id);
      const copy = { ...prev[idx]!, _id: uid(), imeiNumber: '', chassisNumber: '' };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  };

  // apply defaults to all rows
  const applyDefaults = () => {
    setRows((prev) => prev.map((r) => ({
      ...r,
      purchasePrice:    defBuy  || r.purchasePrice,
      price:            defSale || r.price,
      installmentPrice: defInst || r.installmentPrice,
    })));
  };

  // generate table from qty
  const generateTable = () => {
    if (!productName.trim()) { toast.error('Product name zaroor likhein'); return; }
    const n = Math.max(1, Math.min(100, Number(qty) || 1));
    setQty(String(n));
    setRows(Array.from({ length: n }, emptyRow));
    setTableReady(true);
    setTimeout(() => {
      document.getElementById('stock-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  // paste IMEIs from clipboard (one per line)
  const pasteImeis = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const imeis = text.split(/[\n,\t]/).map((s) => s.trim()).filter(Boolean);
      if (!imeis.length) { toast.error('Clipboard mein koi IMEI nahi mili'); return; }
      setRows((prev) => {
        const updated = [...prev];
        imeis.forEach((imei, i) => {
          if (i < updated.length) updated[i] = { ...updated[i]!, imeiNumber: imei };
          else updated.push({ ...emptyRow(), imeiNumber: imei });
        });
        return updated;
      });
      toast.success(`${imeis.length} IMEI numbers fill ho gayi`);
    } catch { toast.error('Clipboard access nahi mila'); }
  };

  // ── validation & build units ──
  const buildUnits = (): BulkReceiveUnit[] | null => {
    const errors: string[] = [];
    const units: BulkReceiveUnit[] = [];
    const seenImei    = new Set<string>();
    const seenChassis = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]!;
      const rowNum = i + 1;

      if (!r.price && !defSale) { errors.push(`Row ${rowNum}: Sale price missing`); continue; }
      const salePrice = Number(r.price || defSale);
      if (isNaN(salePrice) || salePrice <= 0) { errors.push(`Row ${rowNum}: Sale price invalid`); continue; }

      if (productType === 'mobile') {
        if (!r.imeiNumber.trim()) { errors.push(`Row ${rowNum}: IMEI number missing`); continue; }
        if (seenImei.has(r.imeiNumber)) { errors.push(`Row ${rowNum}: Duplicate IMEI "${r.imeiNumber}"`); continue; }
        seenImei.add(r.imeiNumber);
      }

      if (productType === 'vehicle') {
        if (!r.chassisNumber.trim()) { errors.push(`Row ${rowNum}: Chassis number missing`); continue; }
        if (seenChassis.has(r.chassisNumber)) { errors.push(`Row ${rowNum}: Duplicate Chassis "${r.chassisNumber}"`); continue; }
        seenChassis.add(r.chassisNumber);
      }

      const effectiveBuy = r.purchasePrice ? Number(r.purchasePrice) : (defBuy ? Number(defBuy) : undefined);
      units.push({
        name:             productName.trim(),
        category:         category || undefined,
        brand:            brand    || undefined,
        model:            model    || undefined,
        color:            r.color  || undefined,
        purchasePrice:    effectiveBuy,
        price:            salePrice,
        installmentPrice: r.installmentPrice ? Number(r.installmentPrice) : (defInst ? Number(defInst) : undefined),
        stock:            1,
        minStock:         1,
        description:      r.description || undefined,
        attributes:       (productType === 'mobile' && r.storageGb) ? { storageGb: Number(r.storageGb) } : undefined,
        imeiNumber:       r.imeiNumber       || undefined,
        chassisNumber:    r.chassisNumber    || undefined,
        engineNumber:     r.engineNumber     || undefined,
        registrationNumber: r.registrationNumber || undefined,
        vehicleCondition: (r.vehicleCondition as 'NEW' | 'USED') || undefined,
        modelYear:        r.modelYear ? Number(r.modelYear) : undefined,
        letterStatus:     (r.letterStatus as BulkReceiveUnit['letterStatus']) || undefined,
        biometricStatus:  (r.biometricStatus as BulkReceiveUnit['biometricStatus']) || undefined,
        vehicleFileLocation: (r.vehicleFileLocation as BulkReceiveUnit['vehicleFileLocation']) || undefined,
      });
    }

    if (errors.length) { toast.error(errors.slice(0, 3).join('\n') + (errors.length > 3 ? `\n...aur ${errors.length - 3} errors` : '')); return null; }
    return units;
  };

  const handleSave = () => {
    const units = buildUnits();
    if (!units) return;
    if (supplierId && paidAmount) {
      const totalBuy = units.reduce((s, u) => s + (u.purchasePrice ?? 0), 0);
      if (Number(paidAmount) > totalBuy && totalBuy > 0) {
        toast.error(`Paid amount (${pkr(Number(paidAmount))}) invoice total (${pkr(totalBuy)}) se zyada hai`);
        return;
      }
    }
    saveMutation.mutate(units);
  };

  // ── derived ──
  const totalPurchase    = rows.reduce((s, r) => s + Number(r.purchasePrice || defBuy || 0), 0);
  const totalSale        = rows.reduce((s, r) => s + Number(r.price || defSale || 0), 0);
  const profit           = totalSale - totalPurchase;
  const missingBuyPrices = tableReady && totalPurchase === 0 && totalSale > 0;

  const typeIcons: Record<ProductType, React.ReactNode> = {
    mobile:  <Smartphone size={16} />,
    vehicle: <Bike size={16} />,
    other:   <Package size={16} />,
  };

  // ─── render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Header ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/products')} className="p-2 rounded-xl hover:bg-slate-100 transition text-slate-500">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-lg font-black text-slate-900">Maal Aya — Stock Receive</h1>
              <p className="text-xs text-slate-400">Supplier se maal aya tu yahan add karein</p>
            </div>
          </div>
          {tableReady && (
            <button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black text-sm rounded-xl transition shadow-sm"
            >
              <CheckCircle2 size={15} />
              {saveMutation.isPending ? 'Save ho raha hai...' : `${rows.length} Products Save Karein`}
            </button>
          )}
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* ── Setup Card ── */}
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center">
              <ClipboardList size={15} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-900">Step 1 — Setup</p>
              <p className="text-[11px] text-slate-400">Supplier, product aur quantity batao</p>
            </div>
          </div>

          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

            {/* Supplier */}
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block text-xs font-black text-slate-600 mb-1.5">Supplier</label>
              <div className="relative">
                <select value={supplierId} onChange={(e) => { setSupplierId(e.target.value); setShowQuickSupplier(false); }}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 bg-white transition cursor-pointer appearance-none">
                  <option value="">— Supplier select karein (optional)</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              {/* Quick-add supplier button */}
              {!showQuickSupplier && !supplierId && (
                <button type="button" onClick={() => setShowQuickSupplier(true)}
                  className="mt-2 flex items-center gap-1.5 text-xs font-black text-indigo-600 hover:text-indigo-800 transition">
                  <UserPlus size={12}/> Naya supplier add karo
                </button>
              )}

              {/* Inline quick-add panel */}
              {showQuickSupplier && (
                <div className="mt-2 rounded-xl border border-indigo-200 bg-indigo-50 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black text-indigo-700 flex items-center gap-1"><UserPlus size={12}/> Naya Supplier</p>
                    <button type="button" onClick={() => { setShowQuickSupplier(false); setQuickSupErr(''); }} className="text-indigo-400 hover:text-indigo-700"><X size={13}/></button>
                  </div>
                  <input value={quickSupName} onChange={e => setQuickSupName(e.target.value)} placeholder="Naam *"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-indigo-400 bg-white" autoFocus/>
                  <input value={quickSupPhone} onChange={e => setQuickSupPhone(e.target.value)} placeholder="Phone (optional)"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-indigo-400 bg-white" type="tel"/>
                  {quickSupErr && <p className="text-xs text-red-600">{quickSupErr}</p>}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setShowQuickSupplier(false); setQuickSupErr(''); }}
                      className="flex-1 py-1.5 text-xs border border-indigo-200 rounded-lg text-indigo-500 hover:bg-white transition">Cancel</button>
                    <button type="button" disabled={!quickSupName.trim() || quickSupplierMut.isPending}
                      onClick={() => { setQuickSupErr(''); if (!quickSupName.trim()) return setQuickSupErr('Naam zaruri hai'); quickSupplierMut.mutate(); }}
                      className="flex-1 py-1.5 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-60 transition flex items-center justify-center gap-1">
                      {quickSupplierMut.isPending ? <><Loader2 size={11} className="animate-spin"/> Saving…</> : <><UserPlus size={11}/> Save</>}
                    </button>
                  </div>
                </div>
              )}

              {supplierId && (
                <div className="mt-1.5 space-y-1.5">
                  <div>
                    <label className="block text-xs font-black text-slate-600 mb-1">Invoice Date</label>
                    <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400 transition" />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-600 mb-1">Paid Amount (PKR)</label>
                    <input type="number" min="0" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400 transition tabular-nums"
                      placeholder="0" />
                  </div>
                </div>
              )}
            </div>

            {/* Product info */}
            <div className="sm:col-span-2 lg:col-span-2 space-y-2.5">
              <div>
                <label className="block text-xs font-black text-slate-600 mb-1.5">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input value={productName} onChange={(e) => setProductName(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition"
                  placeholder="e.g. Samsung Galaxy A15, Honda 125, iPhone 15 Pro" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-black text-slate-600 mb-1">Category</label>
                  <CategoryCombobox
                    value={category}
                    onChange={setCategory}
                    extraOptions={dbCategories}
                    placeholder="Category…"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-600 mb-1">Brand</label>
                  <input value={brand} onChange={(e) => setBrand(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400 transition"
                    placeholder="Samsung..." />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-600 mb-1">Model</label>
                  <input value={model} onChange={(e) => setModel(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400 transition"
                    placeholder="A15..." />
                </div>
              </div>
            </div>

            {/* Type + Qty */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-black text-slate-600 mb-1.5">Product Type</label>
                <div className="flex flex-col gap-1.5">
                  {(['mobile', 'vehicle', 'other'] as ProductType[]).map((t) => (
                    <button key={t} type="button" onClick={() => setProductType(t)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-sm font-bold transition ${
                        productType === t
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-200 text-slate-500 hover:border-slate-300'
                      }`}>
                      {typeIcons[t]}
                      {t === 'mobile' ? 'Mobile Phone' : t === 'vehicle' ? 'Vehicle (Bike/Car)' : 'Other Item'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-black text-slate-600 mb-1.5">Kitne Units? <span className="text-red-500">*</span></label>
                <input type="number" min="1" max="100" value={qty} onChange={(e) => setQty(e.target.value)}
                  className="w-full px-3 py-2.5 text-lg font-black border border-slate-200 rounded-xl outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition text-center tabular-nums" />
              </div>
              <button onClick={generateTable}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-sm rounded-xl transition flex items-center justify-center gap-2">
                <Plus size={15} /> Table Banao
              </button>
            </div>
          </div>

          {/* Default prices */}
          {tableReady && (
            <div className="px-5 pb-5">
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-black text-blue-800">Default Prices — Ek baar fill karo, sab rows pe apply karo</p>
                  <button onClick={applyDefaults}
                    className="text-xs font-black text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition">
                    Sab Rows Pe Apply ↓
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Purchase Price (Buy)', val: defBuy,  set: setDefBuy,  ph: '28,000' },
                    { label: 'Sale Price (Cash)',    val: defSale, set: setDefSale, ph: '35,000' },
                    { label: 'Installment Price',   val: defInst, set: setDefInst, ph: '40,000' },
                  ].map(({ label, val, set, ph }) => (
                    <div key={label}>
                      <label className="block text-[11px] font-bold text-blue-600 mb-1">{label}</label>
                      <input type="number" min="0" value={val} onChange={(e) => set(e.target.value)}
                        className="w-full px-3 py-2 text-sm font-black border border-blue-200 rounded-xl outline-none focus:border-blue-500 bg-white transition tabular-nums"
                        placeholder={ph} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Table ── */}
        {tableReady && (
          <div id="stock-table" className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
              <div>
                <p className="text-sm font-black text-slate-900">Step 2 — Har Unit Ki Details</p>
                <p className="text-[11px] text-slate-400">
                  {rows.length} units · {productName} · {productType === 'mobile' ? 'IMEI required' : productType === 'vehicle' ? 'Chassis required' : 'Optional serial'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {productType === 'mobile' && (
                  <button onClick={pasteImeis}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition">
                    <Copy size={12} /> IMEIs Paste Karo
                  </button>
                )}
                <button onClick={addRow}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition">
                  <Plus size={12} /> Row Add
                </button>
              </div>
            </div>

            {/* ── Mobile Table ── */}
            {productType === 'mobile' && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-3 py-2.5 text-left font-black text-slate-500 w-8">#</th>
                      <th className="px-3 py-2.5 text-left font-black text-slate-500">IMEI <span className="text-red-500">*</span></th>
                      <th className="px-3 py-2.5 text-left font-black text-slate-500">Color</th>
                      <th className="px-3 py-2.5 text-left font-black text-slate-500">Storage</th>
                      <th className="px-3 py-2.5 text-left font-black text-slate-500">Buy Price</th>
                      <th className="px-3 py-2.5 text-left font-black text-slate-500">Sale Price <span className="text-red-500">*</span></th>
                      <th className="px-3 py-2.5 text-left font-black text-slate-500">Inst Price</th>
                      <th className="px-3 py-2.5 text-left font-black text-slate-500">Notes</th>
                      <th className="px-3 py-2.5 w-16" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {rows.map((row, i) => {
                      const imeiDup = rows.some((r, j) => j !== i && r.imeiNumber && r.imeiNumber === row.imeiNumber);
                      return (
                        <tr key={row._id} className="hover:bg-slate-50/50 transition">
                          <td className="px-3 py-2 text-slate-400 font-bold">{i + 1}</td>
                          <td className="px-2 py-1.5 min-w-[150px]">
                            <div className="relative">
                              <input value={row.imeiNumber} onChange={(e) => updateRow(row._id, 'imeiNumber', e.target.value)}
                                className={`${inp} ${imeiDup ? 'border-red-400 bg-red-50' : ''} font-mono`}
                                placeholder="15-digit IMEI" maxLength={20} inputMode="numeric" />
                              {imeiDup && <AlertCircle size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500" />}
                            </div>
                          </td>
                          <td className="px-2 py-1.5 min-w-[90px]">
                            <input value={row.color} onChange={(e) => updateRow(row._id, 'color', e.target.value)}
                              className={inp} placeholder="Black" />
                          </td>
                          <td className="px-2 py-1.5 min-w-[80px]">
                            <Sel value={row.storageGb} onChange={(v) => updateRow(row._id, 'storageGb', v)}
                              options={STORAGE_OPTIONS} placeholder="GB" />
                          </td>
                          <td className="px-2 py-1.5 min-w-[100px]">
                            <input type="number" min="0" value={row.purchasePrice}
                              onChange={(e) => updateRow(row._id, 'purchasePrice', e.target.value)}
                              className={inp} placeholder={defBuy || '0'} />
                          </td>
                          <td className="px-2 py-1.5 min-w-[100px]">
                            <input type="number" min="0" value={row.price}
                              onChange={(e) => updateRow(row._id, 'price', e.target.value)}
                              className={`${inp} ${!row.price && !defSale ? 'border-red-300' : ''}`}
                              placeholder={defSale || '0'} />
                          </td>
                          <td className="px-2 py-1.5 min-w-[100px]">
                            <input type="number" min="0" value={row.installmentPrice}
                              onChange={(e) => updateRow(row._id, 'installmentPrice', e.target.value)}
                              className={inp} placeholder={defInst || '0'} />
                          </td>
                          <td className="px-2 py-1.5 min-w-[120px]">
                            <input value={row.description} onChange={(e) => updateRow(row._id, 'description', e.target.value)}
                              className={inp} placeholder="Optional note" />
                          </td>
                          <td className="px-2 py-1.5">
                            <div className="flex items-center gap-1">
                              <button onClick={() => duplicateRow(row._id)} title="Duplicate row"
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                                <Copy size={12} />
                              </button>
                              <button onClick={() => removeRow(row._id)} title="Remove row"
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Vehicle Table ── */}
            {productType === 'vehicle' && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-3 py-2.5 text-left font-black text-slate-500 w-8">#</th>
                      <th className="px-3 py-2.5 text-left font-black text-slate-500">Chassis No <span className="text-red-500">*</span></th>
                      <th className="px-3 py-2.5 text-left font-black text-slate-500">Engine No</th>
                      <th className="px-3 py-2.5 text-left font-black text-slate-500">Year</th>
                      <th className="px-3 py-2.5 text-left font-black text-slate-500">Color</th>
                      <th className="px-3 py-2.5 text-left font-black text-slate-500">Condition</th>
                      <th className="px-3 py-2.5 text-left font-black text-slate-500">Buy Price</th>
                      <th className="px-3 py-2.5 text-left font-black text-slate-500">Sale Price <span className="text-red-500">*</span></th>
                      <th className="px-3 py-2.5 text-left font-black text-slate-500">Inst Price</th>
                      <th className="px-3 py-2.5 text-left font-black text-slate-500">Letter</th>
                      <th className="px-3 py-2.5 text-left font-black text-slate-500">Biometric</th>
                      <th className="px-3 py-2.5 w-16" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {rows.map((row, i) => {
                      const chassisDup = rows.some((r, j) => j !== i && r.chassisNumber && r.chassisNumber === row.chassisNumber);
                      return (
                        <tr key={row._id} className="hover:bg-slate-50/50 transition">
                          <td className="px-3 py-2 text-slate-400 font-bold">{i + 1}</td>
                          <td className="px-2 py-1.5 min-w-[140px]">
                            <div className="relative">
                              <input value={row.chassisNumber} onChange={(e) => updateRow(row._id, 'chassisNumber', e.target.value)}
                                className={`${inp} font-mono ${chassisDup ? 'border-red-400 bg-red-50' : ''}`}
                                placeholder="Chassis number" />
                              {chassisDup && <AlertCircle size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500" />}
                            </div>
                          </td>
                          <td className="px-2 py-1.5 min-w-[120px]">
                            <input value={row.engineNumber} onChange={(e) => updateRow(row._id, 'engineNumber', e.target.value)}
                              className={`${inp} font-mono`} placeholder="Engine No" />
                          </td>
                          <td className="px-2 py-1.5 min-w-[72px]">
                            <input type="number" min="1990" max="2030" value={row.modelYear}
                              onChange={(e) => updateRow(row._id, 'modelYear', e.target.value)}
                              className={inp} placeholder={String(new Date().getFullYear())} />
                          </td>
                          <td className="px-2 py-1.5 min-w-[80px]">
                            <input value={row.color} onChange={(e) => updateRow(row._id, 'color', e.target.value)}
                              className={inp} placeholder="Black" />
                          </td>
                          <td className="px-2 py-1.5 min-w-[80px]">
                            <Sel value={row.vehicleCondition} onChange={(v) => updateRow(row._id, 'vehicleCondition', v)}
                              options={['NEW', 'USED']} placeholder="Cond." />
                          </td>
                          <td className="px-2 py-1.5 min-w-[95px]">
                            <input type="number" min="0" value={row.purchasePrice}
                              onChange={(e) => updateRow(row._id, 'purchasePrice', e.target.value)}
                              className={inp} placeholder={defBuy || '0'} />
                          </td>
                          <td className="px-2 py-1.5 min-w-[95px]">
                            <input type="number" min="0" value={row.price}
                              onChange={(e) => updateRow(row._id, 'price', e.target.value)}
                              className={`${inp} ${!row.price && !defSale ? 'border-red-300' : ''}`}
                              placeholder={defSale || '0'} />
                          </td>
                          <td className="px-2 py-1.5 min-w-[95px]">
                            <input type="number" min="0" value={row.installmentPrice}
                              onChange={(e) => updateRow(row._id, 'installmentPrice', e.target.value)}
                              className={inp} placeholder={defInst || '0'} />
                          </td>
                          <td className="px-2 py-1.5 min-w-[100px]">
                            <Sel value={row.letterStatus} onChange={(v) => updateRow(row._id, 'letterStatus', v)}
                              options={LETTER_OPTIONS} placeholder="Letter" />
                          </td>
                          <td className="px-2 py-1.5 min-w-[110px]">
                            <Sel value={row.biometricStatus} onChange={(v) => updateRow(row._id, 'biometricStatus', v)}
                              options={BIO_OPTIONS} placeholder="Bio" />
                          </td>
                          <td className="px-2 py-1.5">
                            <div className="flex items-center gap-1">
                              <button onClick={() => duplicateRow(row._id)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                                <Copy size={12} />
                              </button>
                              <button onClick={() => removeRow(row._id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Other Table ── */}
            {productType === 'other' && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px] text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-3 py-2.5 text-left font-black text-slate-500 w-8">#</th>
                      <th className="px-3 py-2.5 text-left font-black text-slate-500">Serial / Code</th>
                      <th className="px-3 py-2.5 text-left font-black text-slate-500">Color</th>
                      <th className="px-3 py-2.5 text-left font-black text-slate-500">Buy Price</th>
                      <th className="px-3 py-2.5 text-left font-black text-slate-500">Sale Price <span className="text-red-500">*</span></th>
                      <th className="px-3 py-2.5 text-left font-black text-slate-500">Inst Price</th>
                      <th className="px-3 py-2.5 text-left font-black text-slate-500">Notes</th>
                      <th className="px-3 py-2.5 w-16" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {rows.map((row, i) => (
                      <tr key={row._id} className="hover:bg-slate-50/50 transition">
                        <td className="px-3 py-2 text-slate-400 font-bold">{i + 1}</td>
                        <td className="px-2 py-1.5 min-w-[130px]">
                          <input value={row.imeiNumber} onChange={(e) => updateRow(row._id, 'imeiNumber', e.target.value)}
                            className={`${inp} font-mono`} placeholder="Serial / code (optional)" />
                        </td>
                        <td className="px-2 py-1.5 min-w-[80px]">
                          <input value={row.color} onChange={(e) => updateRow(row._id, 'color', e.target.value)}
                            className={inp} placeholder="Color" />
                        </td>
                        <td className="px-2 py-1.5 min-w-[95px]">
                          <input type="number" min="0" value={row.purchasePrice}
                            onChange={(e) => updateRow(row._id, 'purchasePrice', e.target.value)}
                            className={inp} placeholder={defBuy || '0'} />
                        </td>
                        <td className="px-2 py-1.5 min-w-[95px]">
                          <input type="number" min="0" value={row.price}
                            onChange={(e) => updateRow(row._id, 'price', e.target.value)}
                            className={`${inp} ${!row.price && !defSale ? 'border-red-300' : ''}`}
                            placeholder={defSale || '0'} />
                        </td>
                        <td className="px-2 py-1.5 min-w-[95px]">
                          <input type="number" min="0" value={row.installmentPrice}
                            onChange={(e) => updateRow(row._id, 'installmentPrice', e.target.value)}
                            className={inp} placeholder={defInst || '0'} />
                        </td>
                        <td className="px-2 py-1.5 min-w-[120px]">
                          <input value={row.description} onChange={(e) => updateRow(row._id, 'description', e.target.value)}
                            className={inp} placeholder="Optional note" />
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1">
                            <button onClick={() => duplicateRow(row._id)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                              <Copy size={12} />
                            </button>
                            <button onClick={() => removeRow(row._id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Add row footer */}
            <div className="px-5 py-3 border-t border-slate-50">
              <button onClick={addRow}
                className="flex items-center gap-1.5 text-xs font-black text-slate-500 hover:text-blue-600 transition">
                <Plus size={13} /> Aur row add karein
              </button>
            </div>
          </div>
        )}

        {/* ── Summary + Save ── */}
        {tableReady && (
          <div className="bg-slate-900 rounded-2xl p-5 lg:p-6 text-white">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-4">Summary</p>
            {missingBuyPrices && (
              <div className="flex items-center gap-2 bg-amber-500/20 border border-amber-400/30 rounded-xl px-4 py-2.5 mb-4 text-amber-300 text-xs font-bold">
                <AlertCircle size={13} /> Purchase prices nahi bhari — Gross Profit sahi nahi hoga. Invoice total bhi 0 jayegi.
              </div>
            )}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Total Units',   val: String(rows.length),                                   cls: 'text-white' },
                { label: 'Purchase Cost', val: totalPurchase > 0 ? `PKR ${pkr(totalPurchase)}` : '—', cls: totalPurchase > 0 ? 'text-amber-300' : 'text-slate-600' },
                { label: 'Sale Value',    val: `PKR ${pkr(totalSale)}`,                               cls: 'text-emerald-300' },
                { label: 'Gross Profit',  val: missingBuyPrices ? '—' : `PKR ${pkr(profit)}`,        cls: missingBuyPrices ? 'text-slate-600' : profit >= 0 ? 'text-emerald-400' : 'text-red-400' },
              ].map(({ label, val, cls }) => (
                <div key={label} className="bg-white/8 rounded-2xl p-4">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
                  <p className={`text-xl lg:text-2xl font-black tabular-nums ${cls}`}>{val}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between gap-4">
              <p className="text-[11px] text-slate-500">
                {supplierId
                  ? `Supplier invoice bhi create hogi — ${suppliers.find(s => s.id === supplierId)?.name}`
                  : 'Supplier select nahi kia — sirf products add honge'}
              </p>
              <button onClick={handleSave} disabled={saveMutation.isPending}
                className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black text-base rounded-xl transition shadow-lg shadow-blue-900/30">
                <CheckCircle2 size={18} />
                {saveMutation.isPending ? 'Save ho raha hai...' : `${rows.length} Products Save Karein`}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
