import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShoppingCart, Plus, Loader2, Search, CheckCircle2, X, Trash2, Printer, MessageCircle,
} from 'lucide-react';
import { cashSalesApi, type CashSale, type PaymentMethod } from '../api/cashSales.api.ts';
import { productsApi, type Product } from '../api/products.api.ts';
import { sellersApi } from '../api/sellers.api.ts';
import { useAuthStore } from '../store/auth.store.ts';
import { printCashSaleReceipt, cashSaleWhatsappUrl } from '../utils/receipt.ts';

const METHODS: PaymentMethod[] = ['CASH', 'BANK', 'JAZZCASH', 'EASYPAISA', 'OTHER'];
const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Cash', BANK: 'Bank', JAZZCASH: 'JazzCash', EASYPAISA: 'EasyPaisa', OTHER: 'Other',
};
const METHOD_COLORS: Record<PaymentMethod, string> = {
  CASH:      'bg-emerald-100 text-emerald-700',
  BANK:      'bg-blue-100 text-blue-700',
  JAZZCASH:  'bg-red-100 text-red-700',
  EASYPAISA: 'bg-green-100 text-green-700',
  OTHER:     'bg-gray-100 text-gray-600',
};

function initForm() {
  return { quantity: 1, amount: '', method: 'CASH' as PaymentMethod, customerName: '', customerPhone: '', imeiNumber: '', note: '' };
}

export default function CashSalesPage() {
  const qc     = useQueryClient();
  const user   = useAuthStore((s) => s.user);
  const isOwner = user?.role === 'SELLER_OWNER';

  const [showModal,      setShowModal]      = useState(false);
  const [productSearch,  setProductSearch]  = useState('');
  const [selectedProd,   setSelectedProd]   = useState<Product | null>(null);
  const [form,           setForm]           = useState(initForm);
  const [listSearch,     setListSearch]     = useState('');
  const [confirmDelete,  setConfirmDelete]  = useState<string | null>(null);
  const [lastSale,       setLastSale]       = useState<CashSale | null>(null);

  const { data: seller } = useQuery({
    queryKey: ['seller-me'],
    queryFn: sellersApi.getMe,
    staleTime: 10 * 60_000,
    retry: false,
  });

  const { data: salesData, isLoading } = useQuery({
    queryKey: ['cash-sales', listSearch],
    queryFn: () => cashSalesApi.list({ search: listSearch || undefined, limit: 50 }),
    staleTime: 30_000,
  });

  const { data: productsData } = useQuery({
    queryKey: ['products-picker', productSearch],
    queryFn: () => productsApi.list({ search: productSearch || undefined, limit: 60 }),
    staleTime: 30_000,
    enabled: showModal,
  });

  const sales    = salesData?.data    ?? [];
  const products = productsData?.data ?? [];

  const createMutation = useMutation({
    mutationFn: cashSalesApi.create,
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ['cash-sales'] });
      void qc.invalidateQueries({ queryKey: ['products'] });
      void qc.invalidateQueries({ queryKey: ['products-picker'] });
      setLastSale(result);
      printCashSaleReceipt({
        shopName:      seller?.shopName ?? 'Receipt',
        shopPhone:     seller?.phone,
        customerName:  result.customerName,
        customerPhone: result.customerPhone,
        productName:   result.productName,
        quantity:      result.quantity,
        amount:        Number(result.amount),
        method:        result.method,
        imeiNumber:    result.imeiNumber,
        note:          result.note,
        soldAt:        result.createdAt,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: cashSalesApi.remove,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['cash-sales'] });
      void qc.invalidateQueries({ queryKey: ['products'] });
      void qc.invalidateQueries({ queryKey: ['products-picker'] });
      setConfirmDelete(null);
    },
  });

  function closeModal() {
    setShowModal(false);
    setSelectedProd(null);
    setProductSearch('');
    setForm(initForm());
    setLastSale(null);
  }

  function selectProduct(p: Product) {
    setSelectedProd(p);
    setForm((f) => ({ ...f, amount: String(Number(p.price).toFixed(0)), quantity: 1 }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProd || !form.amount) return;
    createMutation.mutate({
      productId:     selectedProd.id,
      quantity:      form.quantity,
      amount:        Number(form.amount),
      method:        form.method,
      customerName:  form.customerName  || undefined,
      customerPhone: form.customerPhone || undefined,
      imeiNumber:    form.imeiNumber    || undefined,
      note:          form.note          || undefined,
    });
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  const todayTotal = sales
    .filter((s) => new Date(s.createdAt).toDateString() === new Date().toDateString())
    .reduce((sum, s) => sum + Number(s.amount), 0);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Cash Sales</h1>
          <p className="text-sm text-gray-500 mt-0.5">Quick sales without installment plan</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition"
        >
          <Plus size={16} /> New Cash Sale
        </button>
      </div>

      {/* Today stats */}
      {sales.length > 0 && (
        <div className="flex gap-3 mb-5">
          <div className="flex-1 bg-white border border-gray-200 rounded-2xl px-4 py-3">
            <p className="text-xs text-gray-500 mb-0.5">Today's Sales</p>
            <p className="text-lg font-bold text-gray-900">
              {sales.filter((s) => new Date(s.createdAt).toDateString() === new Date().toDateString()).length}
            </p>
          </div>
          <div className="flex-1 bg-white border border-gray-200 rounded-2xl px-4 py-3">
            <p className="text-xs text-gray-500 mb-0.5">Today's Revenue</p>
            <p className="text-lg font-bold text-emerald-600">PKR {todayTotal.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <input
          type="text"
          value={listSearch}
          onChange={(e) => setListSearch(e.target.value)}
          placeholder="Search by product or customer..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white transition"
        />
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      </div>

      {/* Sales list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : sales.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-white border border-gray-200 rounded-2xl">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <ShoppingCart size={24} className="text-gray-400" />
          </div>
          <p className="text-sm font-semibold text-gray-700">
            {listSearch ? 'No matching sales' : 'No cash sales yet'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {listSearch ? 'Try a different search term' : 'Click "New Cash Sale" to record the first one'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Product</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Customer</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Amount</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden sm:table-cell">Method</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden md:table-cell">Date</th>
                  {isOwner && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sales.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50/60 transition">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{s.productName}</p>
                      {s.quantity > 1 && <p className="text-xs text-gray-400">Qty: {s.quantity}</p>}
                      {s.imeiNumber && <p className="text-xs text-gray-400 font-mono">{s.imeiNumber}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-700">{s.customerName ?? <span className="text-gray-400 italic">Walk-in</span>}</p>
                      {s.customerPhone && <p className="text-xs text-gray-400">{s.customerPhone}</p>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-bold text-gray-900">PKR {Number(s.amount).toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${METHOD_COLORS[s.method]}`}>
                        {METHOD_LABELS[s.method]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs hidden md:table-cell">
                      {fmtDate(s.createdAt)}
                    </td>
                    {isOwner && (
                      <td className="px-4 py-3 text-right">
                        {confirmDelete === s.id ? (
                          <div className="flex items-center gap-1.5 justify-end">
                            <button
                              onClick={() => deleteMutation.mutate(s.id)}
                              disabled={deleteMutation.isPending}
                              className="text-xs font-semibold text-red-600 hover:text-red-700"
                            >
                              {deleteMutation.isPending ? '...' : 'Confirm'}
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="text-xs text-gray-400 hover:text-gray-600"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(s.id)}
                            className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Cash Sale Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <h2 className="font-bold text-gray-900 text-base">New Cash Sale</h2>
              <button onClick={closeModal} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            {/* Receipt screen — shown after successful sale */}
            {lastSale && (
              <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 size={24} className="text-emerald-600" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-gray-900 text-base">Sale Recorded!</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {lastSale.productName} · PKR {Number(lastSale.amount).toLocaleString()}
                  </p>
                  {lastSale.customerName && (
                    <p className="text-xs text-gray-400 mt-0.5">{lastSale.customerName}</p>
                  )}
                </div>
                <div className="flex gap-3 w-full">
                  <button
                    type="button"
                    onClick={() => printCashSaleReceipt({
                      shopName:      seller?.shopName ?? 'Receipt',
                      shopPhone:     seller?.phone,
                      customerName:  lastSale.customerName,
                      customerPhone: lastSale.customerPhone,
                      productName:   lastSale.productName,
                      quantity:      lastSale.quantity,
                      amount:        Number(lastSale.amount),
                      method:        lastSale.method,
                      imeiNumber:    lastSale.imeiNumber,
                      note:          lastSale.note,
                      soldAt:        lastSale.createdAt,
                    })}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
                  >
                    <Printer size={15} /> Print
                  </button>
                  <a
                    href={cashSaleWhatsappUrl({
                      shopName:      seller?.shopName ?? 'Receipt',
                      shopPhone:     seller?.phone,
                      customerName:  lastSale.customerName,
                      customerPhone: lastSale.customerPhone,
                      productName:   lastSale.productName,
                      quantity:      lastSale.quantity,
                      amount:        Number(lastSale.amount),
                      method:        lastSale.method,
                      imeiNumber:    lastSale.imeiNumber,
                      note:          lastSale.note,
                      soldAt:        lastSale.createdAt,
                    })}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white rounded-xl text-sm font-semibold transition"
                  >
                    <MessageCircle size={15} /> WhatsApp
                  </a>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="w-full py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition"
                >
                  Done
                </button>
              </div>
            )}

            {/* Scrollable form */}
            {!lastSale && <form id="cash-sale-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Product selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Product <span className="text-red-500">*</span>
                </label>
                {selectedProd ? (
                  <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-xl">
                    <div>
                      <p className="text-sm font-semibold text-blue-900">{selectedProd.name}</p>
                      <p className="text-xs text-blue-600 mt-0.5">
                        Stock: {selectedProd.stock} · Price: PKR {Number(selectedProd.price).toLocaleString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSelectedProd(null); setForm(initForm()); }}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 ml-3 shrink-0"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative mb-2">
                      <input
                        type="text"
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder="Search product by name..."
                        autoFocus
                        className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                      />
                      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                    <div className="max-h-44 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-50">
                      {products.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-5">No products found</p>
                      ) : (
                        products.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => selectProduct(p)}
                            disabled={p.stock < 1}
                            className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 transition text-left disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                              {(p.brand || p.model) && (
                                <p className="text-xs text-gray-400">{[p.brand, p.model].filter(Boolean).join(' ')}</p>
                              )}
                            </div>
                            <div className="text-right shrink-0 ml-3">
                              <p className="text-sm font-semibold text-gray-900">PKR {Number(p.price).toLocaleString()}</p>
                              <p className={`text-xs ${p.stock < 1 ? 'text-red-500' : 'text-gray-400'}`}>
                                {p.stock < 1 ? 'Out of stock' : `Stock: ${p.stock}`}
                              </p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Qty + Amount */}
              {selectedProd && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">Quantity</label>
                      <input
                        type="number" min={1} max={selectedProd.stock}
                        value={form.quantity}
                        onChange={(e) => setForm((f) => ({ ...f, quantity: Math.max(1, Number(e.target.value)) }))}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Amount (PKR) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number" min={1}
                        value={form.amount}
                        onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                        required
                      />
                    </div>
                  </div>

                  {/* Payment method */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Payment Method</label>
                    <div className="flex gap-2 flex-wrap">
                      {METHODS.map((m) => (
                        <button
                          key={m} type="button"
                          onClick={() => setForm((f) => ({ ...f, method: m }))}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
                            form.method === m
                              ? 'bg-blue-600 border-blue-600 text-white'
                              : 'border-gray-200 text-gray-600 hover:border-blue-300'
                          }`}
                        >
                          {METHOD_LABELS[m]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Customer info */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Customer Name <span className="font-normal text-gray-400">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={form.customerName}
                        onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
                        placeholder="Walk-in customer"
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Phone <span className="font-normal text-gray-400">(optional)</span>
                      </label>
                      <input
                        type="tel"
                        value={form.customerPhone}
                        onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
                        placeholder="03XX-XXXXXXX"
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                      />
                    </div>
                  </div>

                  {/* IMEI + Note */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        IMEI <span className="font-normal text-gray-400">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={form.imeiNumber}
                        onChange={(e) => setForm((f) => ({ ...f, imeiNumber: e.target.value }))}
                        placeholder="15-digit IMEI"
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Note <span className="font-normal text-gray-400">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={form.note}
                        onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                      />
                    </div>
                  </div>
                </>
              )}
            </form>}

            {/* Footer — hidden when receipt is showing */}
            {!lastSale && <div className="px-5 py-4 border-t border-gray-100 flex gap-3 shrink-0">
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 py-2.5 border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="cash-sale-form"
                disabled={!selectedProd || !form.amount || createMutation.isPending}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition flex items-center justify-center gap-2"
              >
                {createMutation.isPending
                  ? <Loader2 size={15} className="animate-spin" />
                  : <CheckCircle2 size={15} />
                }
                Record Sale
              </button>
            </div>}
          </div>
        </div>
      )}
    </div>
  );
}
