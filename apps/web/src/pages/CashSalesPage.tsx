import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShoppingCart, Plus, Search, CheckCircle2, X, Trash2, Pencil,
  Printer, MessageCircle, AlertTriangle, Wallet, CreditCard, Smartphone,
  TrendingUp, Package, ChevronLeft, ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../utils/error.ts';
import { fmtDate } from '../utils/dateFormat.ts';
import { cashSalesApi, type CashSale, type PaymentMethod } from '../api/cashSales.api.ts';
import { productsApi, type Product } from '../api/products.api.ts';
import { productUnitsApi } from '../api/productUnits.api.ts';
import { statsApi } from '../api/stats.api.ts';
import { useDebounce } from '../hooks/useDebounce.ts';
import { sellersApi } from '../api/sellers.api.ts';
import { useAuthStore } from '../store/auth.store.ts';
import { openCashSaleBill } from '../utils/bill.ts';
import { cashSaleWhatsappUrl } from '../utils/receipt.ts';
import ConfirmDialog from '../components/ui/ConfirmDialog.tsx';
import { RowSkeleton } from '../components/ui/Skeleton.tsx';

/* ── constants ── */
const METHODS: PaymentMethod[] = ['CASH', 'BANK', 'JAZZCASH', 'EASYPAISA', 'OTHER'];
const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Cash', BANK: 'Bank', JAZZCASH: 'JazzCash', EASYPAISA: 'EasyPaisa', OTHER: 'Other',
};
const METHOD_COLORS: Record<PaymentMethod, { pill: string; dot: string; border: string }> = {
  CASH:      { pill: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', border: 'border-emerald-500' },
  BANK:      { pill: 'bg-blue-100    text-blue-700',    dot: 'bg-blue-500',    border: 'border-blue-500'    },
  JAZZCASH:  { pill: 'bg-red-100     text-red-700',     dot: 'bg-red-500',     border: 'border-red-500'     },
  EASYPAISA: { pill: 'bg-green-100   text-green-700',   dot: 'bg-green-500',   border: 'border-green-500'   },
  OTHER:     { pill: 'bg-slate-100   text-slate-600',   dot: 'bg-slate-400',   border: 'border-slate-300'   },
};
const METHOD_ICONS: Record<PaymentMethod, React.ReactNode> = {
  CASH:      <Wallet size={11}/>,
  BANK:      <CreditCard size={11}/>,
  JAZZCASH:  <Smartphone size={11}/>,
  EASYPAISA: <Smartphone size={11}/>,
  OTHER:     <Package size={11}/>,
};

const pkr   = (v: number) => 'PKR ' + v.toLocaleString('en-PK', { maximumFractionDigits: 0 });
const pkrSh = (v: number) => {
  if (v >= 10_00_000) return `${(v / 10_00_000).toFixed(1)}M`;
  if (v >= 1_00_000)  return `${(v / 1_00_000).toFixed(v % 1_00_000 === 0 ? 0 : 1)}L`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(v % 1_000 === 0 ? 0 : 1)}K`;
  return String(v);
};
const isToday = (d: string) => new Date(d).toDateString() === new Date().toDateString();
const isYesterday = (d: string) => {
  const y = new Date(); y.setDate(y.getDate() - 1);
  return new Date(d).toDateString() === y.toDateString();
};

function initForm() {
  return { quantity: 1, amount: '', method: 'CASH' as PaymentMethod, customerName: '', customerPhone: '', imeiNumber: '', note: '' };
}

/* ══ helpers ══ */
function groupByDate(sales: CashSale[]) {
  const groups: { label: string; key: string; items: CashSale[] }[] = [];
  const map = new Map<string, CashSale[]>();
  for (const s of sales) {
    const key = new Date(s.createdAt).toDateString();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  for (const [key, items] of map) {
    let label: string;
    if (isToday(items[0].createdAt))     label = 'Aaj';
    else if (isYesterday(items[0].createdAt)) label = 'Kal';
    else label = fmtDate(items[0].createdAt);
    groups.push({ label, key, items });
  }
  return groups;
}

/* ══════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════ */
export default function CashSalesPage() {
  const qc      = useQueryClient();
  const user    = useAuthStore((s) => s.user);
  const isOwner = user?.role === 'SELLER_OWNER';

  const [showModal,      setShowModal]      = useState(false);
  const [productSearch,  setProductSearch]  = useState('');
  const [selectedProd,   setSelectedProd]   = useState<Product | null>(null);
  const [form,           setForm]           = useState(initForm);
  const [listSearch,     setListSearch]     = useState('');
  const [listPage,       setListPage]       = useState(1);
  const [methodFilter,   setMethodFilter]   = useState<PaymentMethod | 'ALL'>('ALL');
  const [confirmDelete,  setConfirmDelete]  = useState<string | null>(null);
  const [editingSale,    setEditingSale]    = useState<CashSale | null>(null);
  const [lastSale,       setLastSale]       = useState<CashSale | null>(null);

  const { data: seller } = useQuery({ queryKey: ['seller-me'], queryFn: sellersApi.getMe, staleTime: 10 * 60_000, retry: false });
  const { data: stats }  = useQuery({ queryKey: ['stats'],     queryFn: statsApi.get,     staleTime: 5 * 60_000  });

  const { data: salesData, isLoading } = useQuery({
    queryKey: ['cash-sales', listSearch, listPage],
    queryFn: () => cashSalesApi.list({ search: listSearch || undefined, limit: 25, page: listPage }),
    staleTime: 30_000,
  });

  const { data: productsData } = useQuery({
    queryKey: ['products-picker', productSearch],
    queryFn: () => productsApi.list({ search: productSearch || undefined, limit: 60 }),
    staleTime: 30_000,
    enabled: showModal,
  });

  const debouncedImei = useDebounce(form.imeiNumber.replace(/\D/g, ''), 500);
  const { data: imeiLookup, isFetching: imeiChecking } = useQuery({
    queryKey: ['imei-lookup-cs', debouncedImei],
    queryFn: () => productUnitsApi.lookup(debouncedImei),
    enabled: debouncedImei.length === 15 && showModal,
    staleTime: 10_000,
  });

  const allSales   = salesData?.data  ?? [];
  const salesTotal = salesData?.total ?? 0;
  const salesPages = Math.max(1, Math.ceil(salesTotal / 25));
  const products   = productsData?.data ?? [];

  /* filtered view (client-side by method) */
  const visible = methodFilter === 'ALL' ? allSales : allSales.filter(s => s.method === methodFilter);
  const groups  = groupByDate(visible);

  /* derived stats */
  const todayCount  = allSales.filter(s => isToday(s.createdAt)).length;
  const todayRevenue = allSales.filter(s => isToday(s.createdAt)).reduce((a, s) => a + Number(s.amount), 0);

  type SaleList = { data: CashSale[]; total: number; page: number; limit: number };

  /* ── mutations ── */
  const createMutation = useMutation({
    mutationFn: cashSalesApi.create,
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ['cash-sales', listSearch, listPage] });
      const prev = qc.getQueryData<SaleList>(['cash-sales', listSearch, listPage]);
      const tempId = `optimistic-${Date.now()}`;
      const optimistic: CashSale = {
        id: tempId, sellerId: '', productId: vars.productId,
        quantity: vars.quantity ?? 1, amount: String(vars.amount), method: vars.method,
        customerName: vars.customerName ?? null, customerPhone: vars.customerPhone ?? null,
        imeiNumber: vars.imeiNumber ?? null, note: vars.note ?? null,
        soldByUserId: user?.id ?? null, createdAt: new Date().toISOString(),
        productName: selectedProd?.name ?? '', productCategory: selectedProd?.category ?? null,
      };
      qc.setQueryData<SaleList>(['cash-sales', listSearch, listPage], (c) =>
        c ? { ...c, data: [optimistic, ...c.data].slice(0, c.limit), total: c.total + 1 } : c,
      );
      return { prev, tempId };
    },
    onSuccess: (result, _vars, ctx) => {
      qc.setQueriesData<SaleList>({ queryKey: ['cash-sales'], exact: false }, (c) => {
        if (!c?.data) return c;
        const idx = c.data.findIndex(s => s.id === ctx?.tempId);
        if (idx === -1) return c;
        const d = [...c.data]; d[idx] = result;
        return { ...c, data: d };
      });
      void qc.invalidateQueries({ queryKey: ['cash-sales'],  exact: false, refetchType: 'none' });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      void qc.invalidateQueries({ queryKey: ['stats'] });
      if (selectedProd) {
        qc.setQueriesData<{ data: Product[]; total: number; page: number; limit: number }>(
          { queryKey: ['products-picker'], exact: false },
          (c) => c ? { ...c, data: c.data.map(p => p.id === selectedProd.id ? { ...p, stock: Math.max(0, p.stock - (result.quantity ?? 1)) } : p) } : c,
        );
      }
      setLastSale(result);
      void openCashSaleBill({
        shop:     { shopName: seller?.shopName ?? '', phone: seller?.phone ?? '', address: seller?.address },
        customer: { name: result.customerName, phone: result.customerPhone },
        product: result.productName, quantity: result.quantity, amount: result.amount,
        method: result.method, imeiNumber: result.imeiNumber,
        chassisNumber: selectedProd?.chassisNumber, engineNumber: selectedProd?.engineNumber,
        registrationNumber: selectedProd?.registrationNumber,
        note: result.note, soldAt: result.createdAt, saleId: result.id,
      });
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(['cash-sales', listSearch, listPage], ctx.prev);
      toast.error('Sale record nahi ho saki');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: cashSalesApi.remove,
    onSuccess: (_, id) => {
      qc.setQueriesData<SaleList>({ queryKey: ['cash-sales'], exact: false }, (c) => {
        if (!c?.data) return c;
        const filtered = c.data.filter(s => s.id !== id);
        return filtered.length === c.data.length ? c : { ...c, data: filtered, total: Math.max(0, c.total - 1) };
      });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      void qc.invalidateQueries({ queryKey: ['stats'] });
      setConfirmDelete(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof cashSalesApi.update>[1] }) => cashSalesApi.update(id, body),
    onSuccess: (updated) => {
      qc.setQueriesData<SaleList>({ queryKey: ['cash-sales'], exact: false }, (c) =>
        c ? { ...c, data: c.data.map(s => s.id === updated.id ? updated : s) } : c,
      );
      toast.success('Sale update ho gayi');
      setEditingSale(null);
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Update failed')),
  });

  function closeModal() {
    setShowModal(false); setSelectedProd(null); setProductSearch('');
    setForm(initForm()); setLastSale(null);
  }

  function selectProduct(p: Product) {
    setSelectedProd(p);
    setForm(f => ({ ...f, amount: String(Number(p.price).toFixed(0)), quantity: 1, imeiNumber: p.chassisNumber ?? '' }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProd || !form.amount) return;
    createMutation.mutate({
      productId: selectedProd.id, quantity: form.quantity, amount: Number(form.amount),
      method: form.method,
      customerName:  form.customerName  || undefined,
      customerPhone: form.customerPhone || undefined,
      imeiNumber:    form.imeiNumber    || undefined,
      note:          form.note          || undefined,
    });
  }

  const isVehicle = !!selectedProd?.chassisNumber;

  /* ══ PAGE ══ */
  return (
    <div className="bg-[#F0F2F8]">

      {/* ══ DARK HEADER ══ */}
      <div className="bg-slate-950 shadow-lg shadow-slate-950/20">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5">
          <div>
            <div className="flex items-center gap-2">
              <ShoppingCart size={15} className="text-emerald-400"/>
              <h1 className="text-[15px] font-black text-white">Cash Sales</h1>
              {salesTotal > 0 && (
                <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">{salesTotal} records</span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Bina installment direct sale</p>
          </div>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl transition shadow-sm shadow-emerald-900">
            <Plus size={13}/> Naya Cash Sale
          </button>
        </div>
      </div>

      {/* ══ KPI STRIP ══ */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100">
          <div className="px-5 py-3.5 border-l-[3px] border-emerald-500">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.18em]">Aaj Ki Revenue</p>
            <p className="text-2xl xl:text-3xl font-black text-slate-900 tabular-nums leading-none mt-1.5">
              {pkrSh(stats?.todayCashSales ?? todayRevenue)}
            </p>
            <p className="text-[10px] text-slate-400 mt-1">
              {todayCount > 0 ? `${todayCount} sale${todayCount !== 1 ? 's' : ''} aaj` : 'abhi koi nahi'}
            </p>
          </div>
          <div className="px-5 py-3.5 border-l-[3px] border-blue-500">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.18em]">Is Mahine</p>
            <p className="text-2xl xl:text-3xl font-black text-slate-900 tabular-nums leading-none mt-1.5">
              {pkrSh(stats?.monthCashSales ?? 0)}
            </p>
            <p className="text-[10px] text-slate-400 mt-1">{pkr(stats?.monthCashSales ?? 0)}</p>
          </div>
          <div className="px-5 py-3.5 border-l-[3px] border-violet-400">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.18em]">Kul Records</p>
            <p className="text-2xl xl:text-3xl font-black text-slate-900 tabular-nums leading-none mt-1.5">{salesTotal}</p>
            <p className="text-[10px] text-slate-400 mt-1">sab mila kar</p>
          </div>
          <div className="px-5 py-3.5 border-l-[3px] border-slate-200">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.18em]">Payment Methods</p>
            <div className="flex gap-1.5 mt-1.5 flex-wrap">
              {METHODS.map(m => {
                const cnt = allSales.filter(s => s.method === m).length;
                if (!cnt) return null;
                return (
                  <span key={m} className={`text-[10px] font-black px-1.5 py-0.5 rounded ${METHOD_COLORS[m].pill}`}>
                    {METHOD_LABELS[m]} {cnt}
                  </span>
                );
              })}
              {allSales.length === 0 && <span className="text-[10px] text-slate-300">—</span>}
            </div>
          </div>
        </div>
      </div>

      {/* ══ BODY ══ */}
      <div className="px-3 sm:px-5 lg:px-6 py-4 space-y-3">

        {/* Search + Method Filter */}
        <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            <div className="relative flex-1">
              <input
                type="text" value={listSearch}
                onChange={e => { setListSearch(e.target.value); setListPage(1); }}
                placeholder="Product ya customer dhundo…"
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"/>
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
            </div>
          </div>
          {/* Method filter pills */}
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => setMethodFilter('ALL')}
              className={`px-3 py-1 rounded-lg text-xs font-black transition ${methodFilter === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              Sab
            </button>
            {METHODS.map(m => (
              <button key={m} onClick={() => setMethodFilter(m)}
                className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-black transition ${methodFilter === m ? `${METHOD_COLORS[m].pill} ring-2 ring-offset-1 ring-current` : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {METHOD_ICONS[m]} {METHOD_LABELS[m]}
              </button>
            ))}
          </div>
        </div>

        {/* Sales List */}
        <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-slate-500"/>
              <h2 className="text-sm font-black text-slate-900">
                {methodFilter !== 'ALL' ? `${METHOD_LABELS[methodFilter]} Sales` : 'Tamam Sales'}
              </h2>
              {methodFilter !== 'ALL' && (
                <span className="text-[10px] text-slate-400">({visible.length} is page par)</span>
              )}
            </div>
            {salesTotal > 0 && (
              <span className="text-xs text-slate-400 tabular-nums">
                {(listPage - 1) * 25 + 1}–{Math.min(listPage * 25, salesTotal)} / {salesTotal}
              </span>
            )}
          </div>

          {isLoading ? (
            <RowSkeleton rows={6}/>
          ) : visible.length === 0 ? (
            <div className="py-14 flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center">
                <ShoppingCart size={20} className="text-slate-300"/>
              </div>
              <div>
                <p className="text-sm font-black text-slate-600">{listSearch ? 'Kuch nahi mila' : 'Koi sale nahi'}</p>
                <p className="text-xs text-slate-400 mt-1">{listSearch ? 'Alag search try karo' : '"Naya Cash Sale" par click karo'}</p>
              </div>
            </div>
          ) : (
            <div>
              {groups.map((group, gi) => (
                <div key={group.key}>
                  {/* Date group header */}
                  <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 border-y border-slate-100 sticky top-0 z-10">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{group.label}</p>
                    <div className="flex-1 border-t border-slate-200"/>
                    <p className="text-[10px] text-slate-400 tabular-nums">
                      {pkrSh(group.items.reduce((a, s) => a + Number(s.amount), 0))} total
                    </p>
                  </div>

                  {/* Row per sale */}
                  {group.items.map((s, i) => (
                    <div key={s.id}
                      className={`flex items-center gap-3 px-4 py-3 group hover:bg-slate-50 transition border-l-[3px] ${METHOD_COLORS[s.method].border} ${i > 0 || gi > 0 ? 'border-t border-slate-50' : ''}`}>

                      {/* Method badge */}
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${METHOD_COLORS[s.method].pill}`}>
                        {METHOD_ICONS[s.method]}
                      </div>

                      {/* Product + Customer */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-slate-900 truncate">{s.productName}</p>
                          {s.quantity > 1 && (
                            <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">×{s.quantity}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {s.customerName ? (
                            <p className="text-xs text-slate-500 truncate">{s.customerName}</p>
                          ) : (
                            <p className="text-xs text-slate-300 italic">Walk-in</p>
                          )}
                          {s.customerPhone && <span className="text-slate-200">·</span>}
                          {s.customerPhone && <p className="text-xs text-slate-400 tabular-nums">{s.customerPhone}</p>}
                          {s.imeiNumber && <span className="text-slate-200">·</span>}
                          {s.imeiNumber && <p className="text-[10px] text-slate-400 font-mono truncate max-w-[100px]">{s.imeiNumber}</p>}
                        </div>
                      </div>

                      {/* Amount + method */}
                      <div className="text-right shrink-0 mr-2 hidden sm:block">
                        <p className="text-base font-black text-slate-900 tabular-nums">{pkr(Number(s.amount))}</p>
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${METHOD_COLORS[s.method].pill}`}>
                          {METHOD_LABELS[s.method]}
                        </span>
                      </div>
                      {/* Amount on mobile */}
                      <p className="text-sm font-black text-slate-900 tabular-nums shrink-0 sm:hidden">{pkrSh(Number(s.amount))}</p>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0 opacity-60 group-hover:opacity-100 transition">
                        <button title="Print"
                          onClick={() => void openCashSaleBill({
                            shop: { shopName: seller?.shopName ?? '', phone: seller?.phone ?? '', address: seller?.address },
                            customer: { name: s.customerName, phone: s.customerPhone },
                            product: s.productName, quantity: s.quantity, amount: s.amount,
                            method: s.method, imeiNumber: s.imeiNumber, note: s.note,
                            soldAt: s.createdAt, saleId: s.id,
                          })}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition">
                          <Printer size={14}/>
                        </button>
                        {(s.customerPhone || s.customerName) && (
                          <a title="WhatsApp"
                            href={cashSaleWhatsappUrl({
                              shopName: seller?.shopName ?? 'Receipt', shopPhone: seller?.phone,
                              customerName: s.customerName, customerPhone: s.customerPhone,
                              productName: s.productName, quantity: s.quantity, amount: Number(s.amount),
                              method: s.method, imeiNumber: s.imeiNumber, note: s.note, soldAt: s.createdAt,
                            })}
                            target="_blank" rel="noreferrer"
                            className="p-1.5 text-slate-400 hover:text-[#25D366] hover:bg-green-50 rounded-lg transition">
                            <MessageCircle size={14}/>
                          </a>
                        )}
                        {isOwner && (
                          <>
                            <button title="Edit" onClick={() => setEditingSale(s)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                              <Pencil size={14}/>
                            </button>
                            <button title="Delete" onClick={() => setConfirmDelete(s.id)}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                              <Trash2 size={14}/>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}

              {/* Pagination */}
              {salesPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
                  <button onClick={() => setListPage(p => Math.max(1, p - 1))} disabled={listPage === 1}
                    className="flex items-center gap-1 text-xs font-black px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition">
                    <ChevronLeft size={13}/> Pehla
                  </button>
                  <span className="text-xs text-slate-500 tabular-nums">{listPage} / {salesPages}</span>
                  <button onClick={() => setListPage(p => Math.min(salesPages, p + 1))} disabled={listPage === salesPages}
                    className="flex items-center gap-1 text-xs font-black px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition">
                    Agla <ChevronRight size={13}/>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

      </div>{/* end body */}

      {/* ══ NEW SALE MODAL ══ */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-5 py-4 bg-slate-950 shrink-0">
              <div>
                <p className="text-white font-black text-sm">Naya Cash Sale</p>
                <p className="text-slate-400 text-xs mt-0.5">Product chunein aur amount bharen</p>
              </div>
              <button onClick={closeModal} className="text-slate-400 hover:text-white transition p-1">
                <X size={16}/>
              </button>
            </div>

            {/* Success screen */}
            {lastSale && (
              <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 size={26} className="text-emerald-600"/>
                </div>
                <div className="text-center">
                  <p className="font-black text-slate-900 text-base">Sale ho gayi!</p>
                  <p className="text-sm font-bold text-emerald-600 tabular-nums mt-0.5">{pkr(Number(lastSale.amount))}</p>
                  <p className="text-sm text-slate-500 mt-0.5">{lastSale.productName}</p>
                  {lastSale.customerName && <p className="text-xs text-slate-400 mt-0.5">{lastSale.customerName}</p>}
                </div>
                <div className="flex gap-3 w-full">
                  <button onClick={() => void openCashSaleBill({
                      shop: { shopName: seller?.shopName ?? '', phone: seller?.phone ?? '', address: seller?.address },
                      customer: { name: lastSale.customerName, phone: lastSale.customerPhone },
                      product: lastSale.productName, quantity: lastSale.quantity, amount: lastSale.amount,
                      method: lastSale.method, imeiNumber: lastSale.imeiNumber, note: lastSale.note,
                      soldAt: lastSale.createdAt, saleId: lastSale.id,
                    })}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-slate-200 rounded-xl text-sm font-black text-slate-700 hover:bg-slate-50 transition">
                    <Printer size={14}/> Print
                  </button>
                  <a href={cashSaleWhatsappUrl({
                      shopName: seller?.shopName ?? 'Receipt', shopPhone: seller?.phone,
                      customerName: lastSale.customerName, customerPhone: lastSale.customerPhone,
                      productName: lastSale.productName, quantity: lastSale.quantity, amount: Number(lastSale.amount),
                      method: lastSale.method, imeiNumber: lastSale.imeiNumber, note: lastSale.note, soldAt: lastSale.createdAt,
                    })}
                    target="_blank" rel="noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white rounded-xl text-sm font-black transition">
                    <MessageCircle size={14}/> WhatsApp
                  </a>
                </div>
                <button onClick={closeModal}
                  className="w-full py-2.5 border border-slate-200 text-slate-600 text-sm font-black rounded-xl hover:bg-slate-50 transition">
                  Done
                </button>
              </div>
            )}

            {/* Form */}
            {!lastSale && (
              <form id="cs-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {/* Product selector */}
                <div>
                  <label className="block text-xs font-black text-slate-600 mb-1.5">Product <span className="text-red-500">*</span></label>
                  {selectedProd ? (
                    <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-xl">
                      <div>
                        <p className="text-sm font-black text-blue-900">{selectedProd.name}</p>
                        <p className="text-xs text-blue-600 mt-0.5">Stock: {selectedProd.stock} · PKR {Number(selectedProd.price).toLocaleString()}</p>
                      </div>
                      <button type="button" onClick={() => { setSelectedProd(null); setForm(initForm()); }}
                        className="text-xs font-black text-blue-600 hover:text-blue-800 shrink-0 ml-3">Change</button>
                    </div>
                  ) : (
                    <>
                      <div className="relative mb-2">
                        <input type="text" value={productSearch} onChange={e => setProductSearch(e.target.value)}
                          placeholder="Product ka naam likho…" autoFocus
                          className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"/>
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                      </div>
                      <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-50">
                        {products.length === 0 ? (
                          <div className="py-5 text-center">
                            <p className="text-xs text-slate-400 mb-2">Koi product nahi mila</p>
                            <a href="/stock-receive" target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-black text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition">
                              ⚠ Maal Aya pe receive karo →
                            </a>
                          </div>
                        ) : products.map(p => (
                          <button key={p.id} type="button" onClick={() => selectProduct(p)} disabled={p.stock < 1}
                            className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 transition text-left disabled:opacity-40 disabled:cursor-not-allowed">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-900 truncate">{p.name}</p>
                              {(p.brand || p.model) && <p className="text-xs text-slate-400">{[p.brand, p.model].filter(Boolean).join(' ')}</p>}
                            </div>
                            <div className="text-right shrink-0 ml-3">
                              <p className="text-sm font-black text-slate-900 tabular-nums">PKR {Number(p.price).toLocaleString()}</p>
                              {p.stock < 1 ? (
                                <a href="/stock-receive" target="_blank" rel="noopener noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  className="text-[10px] font-black text-amber-600 hover:underline">
                                  Stock khatam · Receive karo →
                                </a>
                              ) : (
                                <p className="text-xs font-bold text-slate-400">Stock: {p.stock}</p>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {selectedProd && (
                  <>
                    {/* Qty + Amount */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-black text-slate-600 mb-1.5">Quantity</label>
                        <input type="number" min={1} max={selectedProd.stock} value={form.quantity}
                          onChange={e => setForm(f => ({ ...f, quantity: Math.max(1, Number(e.target.value)) }))}
                          className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition" required/>
                      </div>
                      <div>
                        <label className="block text-xs font-black text-slate-600 mb-1.5">Amount (PKR) <span className="text-red-500">*</span></label>
                        <input type="number" min={1} value={form.amount}
                          onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                          className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm font-black tabular-nums focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition" required/>
                      </div>
                    </div>

                    {/* Payment method */}
                    <div>
                      <label className="block text-xs font-black text-slate-600 mb-1.5">Payment Method</label>
                      <div className="flex gap-1.5 flex-wrap">
                        {METHODS.map(m => (
                          <button key={m} type="button" onClick={() => setForm(f => ({ ...f, method: m }))}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-black transition ${
                              form.method === m
                                ? `${METHOD_COLORS[m].pill} ring-2 ring-offset-1 ring-current border-transparent`
                                : 'border-slate-200 text-slate-500 hover:border-slate-300'
                            }`}>
                            {METHOD_ICONS[m]} {METHOD_LABELS[m]}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Customer */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-black text-slate-600 mb-1.5">Customer <span className="font-normal text-slate-400">(optional)</span></label>
                        <input type="text" value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
                          placeholder="Walk-in customer"
                          className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-400 transition"/>
                      </div>
                      <div>
                        <label className="block text-xs font-black text-slate-600 mb-1.5">Phone <span className="font-normal text-slate-400">(optional)</span></label>
                        <input type="tel" value={form.customerPhone} onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))}
                          placeholder="03XX-XXXXXXX"
                          className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-400 transition"/>
                      </div>
                    </div>

                    {/* IMEI / Vehicle + Note */}
                    <div className="grid grid-cols-2 gap-3">
                      {isVehicle ? (
                        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                          <p className="text-[10px] font-black text-indigo-700 uppercase tracking-wide mb-2">Vehicle IDs</p>
                          <div className="space-y-1.5">
                            <div><p className="text-[9px] text-slate-500">Chassis</p><p className="text-xs font-mono font-bold text-slate-900">{selectedProd?.chassisNumber ?? '—'}</p></div>
                            {selectedProd?.engineNumber && <div><p className="text-[9px] text-slate-500">Engine</p><p className="text-xs font-mono font-bold text-slate-900">{selectedProd.engineNumber}</p></div>}
                            {selectedProd?.registrationNumber && <div><p className="text-[9px] text-slate-500">Reg.</p><p className="text-xs font-mono text-slate-700">{selectedProd.registrationNumber}</p></div>}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-xs font-black text-slate-600 mb-1.5">IMEI <span className="font-normal text-slate-400">(optional)</span></label>
                          <input type="text" inputMode="numeric" maxLength={15} value={form.imeiNumber}
                            onChange={e => setForm(f => ({ ...f, imeiNumber: e.target.value.replace(/\D/g, '').slice(0, 15) }))}
                            placeholder="15-digit IMEI"
                            className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm font-mono focus:outline-none focus:border-blue-400 transition"/>
                          {debouncedImei.length === 15 && (
                            imeiChecking ? (
                              <p className="text-[10px] text-slate-400 mt-1">Check ho raha…</p>
                            ) : imeiLookup?.found ? (
                              imeiLookup.unit!.status === 'available' ? (
                                <p className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1"><CheckCircle2 size={10}/> Available{imeiLookup.unit!.productName ? ` — ${imeiLookup.unit!.productName}` : ''}</p>
                              ) : imeiLookup.unit!.status === 'sold' ? (
                                <p className="text-[10px] text-red-600 mt-1 flex items-center gap-1"><AlertTriangle size={10}/> Pehle se bik chuka — {imeiLookup.unit!.soldToName ?? 'kisi aur ko'}</p>
                              ) : (
                                <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1"><AlertTriangle size={10}/> Status: {imeiLookup.unit!.status}</p>
                              )
                            ) : (
                              <p className="text-[10px] text-slate-400 mt-1">Inventory mein nahi</p>
                            )
                          )}
                        </div>
                      )}
                      <div>
                        <label className="block text-xs font-black text-slate-600 mb-1.5">Note <span className="font-normal text-slate-400">(optional)</span></label>
                        <input type="text" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                          placeholder="Kuch aur…"
                          className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-400 transition"/>
                      </div>
                    </div>
                  </>
                )}
              </form>
            )}

            {/* Footer */}
            {!lastSale && (
              <div className="px-5 py-4 border-t border-slate-100 flex gap-3 shrink-0">
                <button type="button" onClick={closeModal}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 text-sm font-black rounded-xl hover:bg-slate-50 transition">
                  Cancel
                </button>
                <button type="submit" form="cs-form" disabled={!selectedProd || !form.amount || createMutation.isPending}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-black rounded-xl transition flex items-center justify-center gap-1.5">
                  {createMutation.isPending ? <span className="animate-pulse">Ho raha…</span> : <><CheckCircle2 size={14}/> Sale Record Karo</>}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ CONFIRM DELETE ══ */}
      <ConfirmDialog
        open={confirmDelete !== null}
        title="Sale Delete Karo?"
        description="Ye cash sale delete ho jaegi aur product ka stock wapis adjust ho jaega."
        confirmLabel="Delete Karo"
        variant="danger"
        isPending={deleteMutation.isPending}
        onConfirm={() => { if (confirmDelete) deleteMutation.mutate(confirmDelete); }}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* ══ EDIT MODAL ══ */}
      {editingSale && (
        <EditModal
          sale={editingSale}
          onClose={() => setEditingSale(null)}
          onSave={(body) => updateMutation.mutate({ id: editingSale.id, body })}
          isPending={updateMutation.isPending}
        />
      )}
    </div>
  );
}

/* ══ Edit Modal ══ */
function EditModal({
  sale, onClose, onSave, isPending,
}: {
  sale: CashSale;
  onClose: () => void;
  onSave: (body: { amount?: number; method?: PaymentMethod; customerName?: string | null; customerPhone?: string | null; imeiNumber?: string | null; note?: string | null }) => void;
  isPending: boolean;
}) {
  const [amount,        setAmount]        = useState(String(Number(sale.amount)));
  const [method,        setMethod]        = useState<PaymentMethod>(sale.method);
  const [customerName,  setCustomerName]  = useState(sale.customerName ?? '');
  const [customerPhone, setCustomerPhone] = useState(sale.customerPhone ?? '');
  const [imeiNumber,    setImeiNumber]    = useState(sale.imeiNumber ?? '');
  const [note,          setNote]          = useState(sale.note ?? '');

  function handleSave() {
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error('Sahi raqam dalen'); return; }
    onSave({ amount: amt, method, customerName: customerName || null, customerPhone: customerPhone || null, imeiNumber: imeiNumber || null, note: note || null });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 bg-slate-950 shrink-0">
          <div>
            <p className="text-white font-black text-sm">Sale Edit Karo</p>
            <p className="text-slate-400 text-xs mt-0.5">{sale.productName} · Qty {sale.quantity}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition p-1"><X size={16}/></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <div>
            <label className="block text-xs font-black text-slate-500 uppercase tracking-wide mb-1.5">Amount (PKR)</label>
            <input type="number" min="1" autoFocus value={amount} onChange={e => setAmount(e.target.value)}
              className="w-full px-3 py-3 border border-slate-200 rounded-xl text-lg font-black tabular-nums focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"/>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-500 uppercase tracking-wide mb-1.5">Payment Method</label>
            <div className="flex flex-wrap gap-1.5">
              {METHODS.map(m => (
                <button key={m} type="button" onClick={() => setMethod(m)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black border transition ${
                    method === m
                      ? `${METHOD_COLORS[m].pill} ring-2 ring-offset-1 ring-current border-transparent`
                      : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}>
                  {METHOD_ICONS[m]} {METHOD_LABELS[m]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-500 uppercase tracking-wide mb-1.5">Customer Name</label>
            <input type="text" placeholder="Walk-in" value={customerName} onChange={e => setCustomerName(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 transition"/>
          </div>
          <div>
            <label className="block text-xs font-black text-slate-500 uppercase tracking-wide mb-1.5">Phone</label>
            <input type="tel" placeholder="03xx-xxxxxxx" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 transition"/>
          </div>
          <div>
            <label className="block text-xs font-black text-slate-500 uppercase tracking-wide mb-1.5">IMEI / Serial</label>
            <input type="text" placeholder="Optional" value={imeiNumber} onChange={e => setImeiNumber(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:border-blue-400 transition"/>
          </div>
          <div>
            <label className="block text-xs font-black text-slate-500 uppercase tracking-wide mb-1.5">Note</label>
            <input type="text" placeholder="Optional" value={note} onChange={e => setNote(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 transition"/>
          </div>
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-slate-100 shrink-0">
          <button onClick={onClose}
            className="flex-1 py-2.5 border border-slate-200 text-slate-600 text-sm font-black rounded-xl hover:bg-slate-50 transition">
            Wapas
          </button>
          <button onClick={handleSave} disabled={isPending || !amount}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-black rounded-xl transition flex items-center justify-center gap-1.5">
            {isPending ? <span className="animate-pulse">Save ho raha…</span> : <><Pencil size={13}/> Save Karo</>}
          </button>
        </div>
      </div>
    </div>
  );
}
