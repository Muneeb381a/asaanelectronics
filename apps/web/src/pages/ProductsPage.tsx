import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  productsApi, type Product, type InventoryIntelligence,
  type FastMovingItem, type SlowMovingItem, type ForecastItem, type ReorderItem,
} from '../api/products.api.ts';
import type { CreateProductInput } from '@assaan/shared';
import ProductForm from '../features/products/ProductForm.tsx';
import { useDebounce } from '../hooks/useDebounce.ts';
import { getErrorMessage } from '../utils/error.ts';
import {
  Package, Pencil, Trash2, TrendingUp, TrendingDown, Minus,
  AlertTriangle, Zap, BarChart3, ShoppingCart, Brain, X,
} from 'lucide-react';
import { TableSkeleton, EmptyState, BlockSkeleton } from '../components/ui/Skeleton.tsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.tsx';

const LOW_STOCK = 3;
type Modal = { mode: 'add' } | { mode: 'edit'; product: Product } | null;
type Tab   = 'inventory' | 'intelligence';

function pkr(v: number) { return 'PKR ' + v.toLocaleString('en-PK', { maximumFractionDigits: 0 }); }
function formatPKR(v: string) { return 'PKR ' + Number(v).toLocaleString('en-PK'); }

function StockBadge({ stock }: { stock: number }) {
  if (stock === 0)        return <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">OUT</span>;
  if (stock <= LOW_STOCK) return <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">LOW</span>;
  return null;
}

// ── Intelligence sub-components ────────────────────────────────────────────────

function ConfidenceDot({ c }: { c: 'HIGH' | 'MEDIUM' | 'LOW' }) {
  const cls = c === 'HIGH' ? 'bg-emerald-500' : c === 'MEDIUM' ? 'bg-amber-400' : 'bg-gray-300';
  return <span className={`inline-block w-2 h-2 rounded-full ${cls}`} title={`${c} confidence`} />;
}

function FastMovingPanel({ items }: { items: FastMovingItem[] }) {
  if (!items.length) return (
    <div className="text-center py-8 text-gray-400 text-sm">No sales data in last 30 days</div>
  );
  const max = Math.max(...items.map((i) => i.salesLast30), 1);
  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <div key={item.id} className="flex items-center gap-3">
          <span className="text-xs font-bold text-gray-300 w-4 text-right shrink-0">{idx + 1}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-800 truncate">{item.name}</span>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                {item.trendPct !== null && (
                  <span className={`flex items-center gap-0.5 text-xs font-semibold ${
                    item.trendPct > 0 ? 'text-emerald-600' : item.trendPct < 0 ? 'text-red-500' : 'text-gray-400'
                  }`}>
                    {item.trendPct > 0 ? <TrendingUp size={11} /> : item.trendPct < 0 ? <TrendingDown size={11} /> : <Minus size={11} />}
                    {item.trendPct > 0 ? '+' : ''}{item.trendPct}%
                  </span>
                )}
                <span className="text-xs text-gray-500">{item.salesLast30} sold</span>
              </div>
            </div>
            <div className="bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${(item.salesLast30 / max) * 100}%` }} />
            </div>
          </div>
          <span className={`text-xs shrink-0 ${item.stock === 0 ? 'text-red-500 font-bold' : item.stock <= LOW_STOCK ? 'text-amber-600 font-semibold' : 'text-gray-400'}`}>
            {item.stock} in stock
          </span>
        </div>
      ))}
    </div>
  );
}

function SlowMovingPanel({ items }: { items: SlowMovingItem[] }) {
  if (!items.length) return (
    <div className="text-center py-8 text-gray-400 text-sm">All products are selling well</div>
  );
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className={`flex items-center justify-between rounded-xl px-3 py-2.5 ${
          item.severity === 'CRITICAL' ? 'bg-red-50 border border-red-100' : 'bg-amber-50 border border-amber-100'
        }`}>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
            <p className={`text-xs ${item.severity === 'CRITICAL' ? 'text-red-500' : 'text-amber-600'}`}>
              {item.daysSinceLastSale === null ? 'Never sold' : `No sale for ${item.daysSinceLastSale} days`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            <span className="text-xs text-gray-500">{item.stock} units</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              item.severity === 'CRITICAL' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
            }`}>{item.severity}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ForecastPanel({ items }: { items: ForecastItem[] }) {
  if (!items.length) return (
    <div className="text-center py-8 text-gray-400 text-sm">Not enough sales history to forecast</div>
  );
  return (
    <div className="space-y-2">
      {items.map((item) => {
        const stockDays = item.predicted30 > 0 ? Math.round((item.stock / item.predicted30) * 30) : null;
        return (
          <div key={item.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-0.5">
                <ConfidenceDot c={item.confidence} />
                <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
              </div>
              <p className="text-xs text-gray-400">
                ~{item.predicted30} units / month · {item.salesLast30} sold last 30d
              </p>
            </div>
            <div className="text-right shrink-0 ml-3">
              <p className="text-sm font-bold text-gray-900">{item.stock}</p>
              <p className={`text-[10px] ${stockDays !== null && stockDays < 30 ? 'text-amber-600 font-semibold' : 'text-gray-400'}`}>
                {stockDays !== null ? `~${stockDays}d cover` : 'no forecast'}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ReorderPanel({ items }: { items: ReorderItem[] }) {
  if (!items.length) return (
    <div className="text-center py-8 text-gray-400 text-sm">Stock levels are healthy — no reorders needed</div>
  );
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className={`flex items-center justify-between rounded-xl px-3 py-2.5 ${
          item.priority === 'URGENT' ? 'bg-red-50 border border-red-100' : 'bg-blue-50 border border-blue-100'
        }`}>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                item.priority === 'URGENT' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
              }`}>{item.priority}</span>
              <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
            </div>
            <p className="text-xs text-gray-500">
              {item.stock} in stock · {item.predicted30} forecast/mo
              {item.purchasePrice ? ` · ${pkr(Number(item.purchasePrice) * item.suggestedQty)} restock cost` : ''}
            </p>
          </div>
          <div className="text-right shrink-0 ml-3">
            <p className="text-sm font-bold text-gray-900">+{item.suggestedQty}</p>
            <p className="text-[10px] text-gray-400">units to order</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function IntelligenceSkeletonPanel() {
  return (
    <div className="space-y-3">
      {[1,2,3,4].map((i) => <BlockSkeleton key={i} className="h-12 rounded-xl" />)}
    </div>
  );
}

function IntelligenceView({ data, isLoading }: { data: InventoryIntelligence | undefined; isLoading: boolean }) {
  const panels = [
    {
      key: 'fast',
      title: 'Fast Moving',
      icon: <Zap size={14} className="text-blue-600" />,
      bg: 'bg-blue-50',
      content: isLoading ? <IntelligenceSkeletonPanel /> : <FastMovingPanel items={data?.fastMoving ?? []} />,
    },
    {
      key: 'slow',
      title: 'Slow Moving Alerts',
      icon: <AlertTriangle size={14} className="text-amber-600" />,
      bg: 'bg-amber-50',
      content: isLoading ? <IntelligenceSkeletonPanel /> : <SlowMovingPanel items={data?.slowMoving ?? []} />,
    },
    {
      key: 'forecast',
      title: 'Demand Forecast — 30 days',
      icon: <BarChart3 size={14} className="text-violet-600" />,
      bg: 'bg-violet-50',
      content: isLoading ? <IntelligenceSkeletonPanel /> : <ForecastPanel items={data?.demandForecast ?? []} />,
    },
    {
      key: 'reorder',
      title: 'Reorder Suggestions',
      icon: <ShoppingCart size={14} className="text-emerald-600" />,
      bg: 'bg-emerald-50',
      content: isLoading ? <IntelligenceSkeletonPanel /> : <ReorderPanel items={data?.reorderSuggestions ?? []} />,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {panels.map((p) => (
        <div key={p.key} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className={`flex items-center gap-2 px-4 py-3 border-b border-gray-100 ${p.bg}`}>
            {p.icon}
            <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">{p.title}</h3>
          </div>
          <div className="p-4">{p.content}</div>
        </div>
      ))}

      {/* Legend */}
      <div className="md:col-span-2 flex items-center gap-4 text-[11px] text-gray-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> HIGH confidence (9+ sales/90d)</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> MEDIUM (4–8)</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300 inline-block" /> LOW (&lt;4)</span>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ProductsPage() {
  const qc = useQueryClient();
  const [modal, setModal]   = useState<Modal>(null);
  const [tab, setTab]       = useState<Tab>('inventory');
  const [search, setSearch] = useState('');
  const [page, setPage]     = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const debouncedSearch     = useDebounce(search, 300);
  const LIMIT = 20;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['products', debouncedSearch, page],
    queryFn:  () => productsApi.list({ search: debouncedSearch || undefined, page, limit: LIMIT }),
  });

  const { data: intelligence, isLoading: intelligenceLoading } = useQuery({
    queryKey: ['products-intelligence'],
    queryFn:  productsApi.getIntelligence,
    staleTime: 120_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['products'] });

  const createMutation = useMutation({
    mutationFn: productsApi.create,
    onSuccess: () => { invalidate(); setModal(null); toast.success('Product added'); },
    onError:   (e) => toast.error(getErrorMessage(e, 'Failed to add product')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateProductInput }) => productsApi.update(id, data),
    onSuccess: () => { invalidate(); setModal(null); toast.success('Product updated'); },
    onError:   (e) => toast.error(getErrorMessage(e, 'Failed to update product')),
  });

  const deleteMutation = useMutation({
    mutationFn: productsApi.remove,
    onSuccess: () => { invalidate(); toast.success('Product deleted'); },
    onError:   (e) => toast.error(getErrorMessage(e, 'Failed to delete product')),
  });

  const handleDelete = (id: string) => setDeleteConfirm({ open: true, id });

  const isPending    = createMutation.isPending || updateMutation.isPending;
  const lowStockItems = data?.data.filter((p) => p.stock <= LOW_STOCK) ?? [];

  const urgentReorders = intelligence?.reorderSuggestions.filter((r) => r.priority === 'URGENT').length ?? 0;
  const criticalSlow   = intelligence?.slowMoving.filter((s) => s.severity === 'CRITICAL').length ?? 0;

  return (
    <div className="px-4 py-5 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Products</h1>
          <p className="text-sm text-gray-500 mt-0.5">{data?.total ?? 0} items</p>
        </div>
        <button onClick={() => setModal({ mode: 'add' })}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition">
          + Add product
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-5 border-b border-gray-200">
        {([
          { key: 'inventory',    label: 'Inventory',    icon: <Package size={13} /> },
          { key: 'intelligence', label: 'Intelligence', icon: <Brain size={13} />,
            badge: (urgentReorders + criticalSlow) > 0 ? urgentReorders + criticalSlow : null },
        ] as const).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition relative ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.icon}{t.label}
            {'badge' in t && t.badge ? (
              <span className="ml-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                {t.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === 'intelligence' ? (
        <IntelligenceView data={intelligence} isLoading={intelligenceLoading} />
      ) : (
        <>
          {/* Low stock banner */}
          {lowStockItems.length > 0 && (
            <div className="mb-4 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <span className="text-amber-600 text-sm font-semibold">
                ⚠ {lowStockItems.filter((p) => p.stock === 0).length > 0
                  ? `${lowStockItems.filter((p) => p.stock === 0).length} out of stock · `
                  : ''}{lowStockItems.length} product{lowStockItems.length !== 1 ? 's' : ''} need restocking
              </span>
              <span className="text-xs text-amber-500">Threshold: {LOW_STOCK} units</span>
            </div>
          )}

          <div className="mb-4">
            <input type="text" placeholder="Search products…" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition" />
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
            {isLoading ? <TableSkeleton rows={5} cols={5} />
              : isError ? <div className="p-8 text-center text-sm text-red-500">Failed to load products.</div>
              : !data?.data.length ? (
                <EmptyState icon={<Package size={32} />} title="No products yet"
                  action={
                    <button onClick={() => setModal({ mode: 'add' })}
                      className="px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-xl hover:bg-blue-700 transition">
                      Add your first product
                    </button>
                  } />
              ) : (
                <div className="overflow-x-auto">
              <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Serial</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Cash Price</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Install Price</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Stock</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.data.map((p) => (
                      <tr key={p.id} className={`transition ${
                        p.stock === 0       ? 'bg-red-50 hover:bg-red-100'
                        : p.stock <= LOW_STOCK ? 'bg-amber-50 hover:bg-gray-50'
                        : 'hover:bg-gray-50'
                      }`}>
                        <td className="px-4 py-3">
                          <span className="font-medium text-gray-900">{p.name}</span>
                          <StockBadge stock={p.stock} />
                        </td>
                        <td className="px-4 py-3 text-gray-500">{p.serial ?? '—'}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{formatPKR(p.price)}</td>
                        <td className="px-4 py-3 text-right">
                          {p.installmentPrice
                            ? <span className="text-blue-700 font-medium">{formatPKR(p.installmentPrice)}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-bold ${
                            p.stock === 0       ? 'text-red-600'
                            : p.stock <= LOW_STOCK ? 'text-amber-600'
                            : 'text-gray-900'
                          }`}>{p.stock}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => setModal({ mode: 'edit', product: p })} title="Edit"
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => handleDelete(p.id)} disabled={deleteMutation.isPending} title="Delete"
                              className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition disabled:opacity-40">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
          </div>

          {data && data.total > LIMIT && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">
                Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, data.total)} of {data.total}
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition disabled:opacity-40 disabled:cursor-not-allowed">
                  Previous
                </button>
                <span className="text-sm text-gray-600 font-medium">{page} / {Math.ceil(data.total / LIMIT)}</span>
                <button onClick={() => setPage((p) => p + 1)} disabled={page * LIMIT >= data.total}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition disabled:opacity-40 disabled:cursor-not-allowed">
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col max-h-[calc(100vh-2rem)]">
            {/* Fixed header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <h2 className="text-base font-semibold text-gray-900">
                {modal.mode === 'add' ? 'Add product' : 'Edit product'}
              </h2>
              <button
                onClick={() => setModal(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Scrollable form area */}
            <div className="overflow-y-auto flex-1 px-6 py-5">
              <ProductForm
                defaultValues={modal.mode === 'edit' ? {
                  name:             modal.product.name,
                  category:         modal.product.category         ?? undefined,
                  brand:            modal.product.brand            ?? undefined,
                  model:            modal.product.model            ?? undefined,
                  color:            modal.product.color            ?? undefined,
                  price:            Number(modal.product.price),
                  installmentPrice: modal.product.installmentPrice ? Number(modal.product.installmentPrice) : undefined,
                  purchasePrice:    modal.product.purchasePrice    ? Number(modal.product.purchasePrice)    : undefined,
                  stock:            modal.product.stock,
                  serial:           modal.product.serial           ?? undefined,
                  warrantyMonths:   modal.product.warrantyMonths   ?? undefined,
                  description:      modal.product.description      ?? undefined,
                } : undefined}
                isPending={isPending}
                onCancel={() => setModal(null)}
                onSubmit={(data) => {
                  if (modal.mode === 'add') createMutation.mutate(data);
                  else updateMutation.mutate({ id: modal.product.id, data });
                }}
              />
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteConfirm.open}
        title="Product Delete Karo?"
        description="Ye product permanently delete ho jaega. Stock bhi hata diya jaega. Ye action undo nahi ho sakta."
        confirmLabel="Delete Karo"
        variant="danger"
        isPending={deleteMutation.isPending}
        onConfirm={() => { if (deleteConfirm.id) deleteMutation.mutate(deleteConfirm.id); setDeleteConfirm({ open: false, id: null }); }}
        onCancel={() => setDeleteConfirm({ open: false, id: null })}
      />
    </div>
  );
}
