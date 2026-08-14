import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Search, Plus, Upload, Package, CheckCircle2,
  AlertTriangle, X, ChevronDown, RotateCcw, Wrench, ShieldCheck,
} from 'lucide-react';
import { productUnitsApi, type ProductUnit, type UnitStatus, type PtaStatus, type SerialType } from '../api/productUnits.api.ts';
import { productsApi } from '../api/products.api.ts';
import { useDebounce } from '../hooks/useDebounce.ts';
import { fmtDate } from '../utils/dateFormat.ts';
import { getErrorMessage } from '../utils/error.ts';

// ── Luhn validator (client-side) ─────────────────────────────────────────────
function isValidImei(v: string): boolean {
  if (!/^\d{15}$/.test(v)) return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let d = parseInt(v[i]!);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

// ── Serial identifier display helper ─────────────────────────────────────────
function serialLabel(unit: ProductUnit): string {
  if (unit.serialType === 'imei') return unit.imei ?? '—';
  return unit.serialNumber ?? '—';
}

function serialTypeLabel(type: SerialType): string {
  return type === 'imei' ? 'IMEI' : type === 'chassis_engine' ? 'Chassis/Engine' : 'Serial No.';
}

// ── Status helpers ────────────────────────────────────────────────────────────
const STATUS_CFG: Record<UnitStatus, { label: string; cls: string }> = {
  available: { label: 'Available', cls: 'bg-emerald-100 text-emerald-700' },
  sold:      { label: 'Sold',      cls: 'bg-gray-100 text-gray-600' },
  defective: { label: 'Defective', cls: 'bg-red-100 text-red-700' },
  returned:  { label: 'Returned',  cls: 'bg-amber-100 text-amber-700' },
};

function StatusBadge({ s }: { s: UnitStatus }) {
  const cfg = STATUS_CFG[s];
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>{cfg.label}</span>;
}

const PTA_CFG: Record<PtaStatus, { label: string; cls: string }> = {
  approved: { label: 'PTA ✓',   cls: 'bg-emerald-100 text-emerald-700' },
  non_pta:  { label: 'Non-PTA', cls: 'bg-red-100 text-red-700' },
  unknown:  { label: 'PTA ?',   cls: 'bg-gray-100 text-gray-500' },
};

function PtaBadge({ s }: { s: PtaStatus }) {
  const cfg = PTA_CFG[s];
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>{cfg.label}</span>;
}

// ── Add-unit modal ────────────────────────────────────────────────────────────
function AddUnitModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const qc = useQueryClient();
  const [serialType, setSerialType] = useState<SerialType>('imei');
  const [imei,         setImei]         = useState('');
  const [imei2,        setImei2]        = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [color,        setColor]        = useState('');
  const [storage,      setStorage]      = useState('');
  const [condition,    setCondition]    = useState<'new' | 'refurbished'>('new');
  const [productId,    setProductId]    = useState('');
  const [notes,        setNotes]        = useState('');

  const { data: products } = useQuery({
    queryKey: ['products-list'],
    queryFn: () => productsApi.list({ limit: 200 }),
    staleTime: 5 * 60_000,
  });

  const imeiValid  = serialType === 'imei' ? isValidImei(imei) : true;
  const imei2Valid = imei2 === '' || isValidImei(imei2);
  const serialValid = serialType !== 'imei' ? serialNumber.trim().length > 0 : true;
  const canSubmit  = imeiValid && imei2Valid && serialValid;

  const mutation = useMutation({
    mutationFn: () => productUnitsApi.create({
      serialType,
      imei:         serialType === 'imei' ? imei : undefined,
      imei2:        serialType === 'imei' && imei2 ? imei2 : undefined,
      serialNumber: serialType !== 'imei' ? serialNumber : undefined,
      productId:    productId || undefined,
      color:        color || undefined,
      storageGb:    serialType === 'imei' && storage ? Number(storage) : undefined,
      condition,
      notes:        notes || undefined,
    }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['units'] });
      void qc.invalidateQueries({ queryKey: ['unit-stats'] });
      toast.success('Unit added to inventory');
      onAdded();
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Failed to add unit')),
  });

  const inp = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-gray-900">Add Unit to Inventory</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 space-y-3.5">

          {/* Serial type toggle */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Unit Type</label>
            <div className="grid grid-cols-3 gap-1.5">
              {([
                { key: 'imei',          label: 'Phone (IMEI)' },
                { key: 'serial',        label: 'Serial No.' },
                { key: 'chassis_engine',label: 'Chassis/Engine' },
              ] as const).map(({ key, label }) => (
                <button key={key} type="button" onClick={() => setSerialType(key)}
                  className={`py-1.5 rounded-lg text-xs font-medium border transition ${serialType === key ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Phone fields */}
          {serialType === 'imei' && (
            <>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">IMEI 1 <span className="text-red-500">*</span></label>
                <input
                  type="text" inputMode="numeric" maxLength={15}
                  value={imei} onChange={(e) => setImei(e.target.value.replace(/\D/g, '').slice(0, 15))}
                  placeholder="15-digit IMEI"
                  className={`${inp} font-mono`}
                />
                {imei.length > 0 && (
                  <p className={`text-[11px] mt-0.5 ${imei.length < 15 ? 'text-gray-400' : imeiValid ? 'text-emerald-600' : 'text-red-500'}`}>
                    {imei.length < 15 ? `${imei.length}/15 digits` : imeiValid ? '✓ Valid IMEI' : '✗ Invalid IMEI (checksum failed)'}
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">IMEI 2 <span className="text-gray-400">(dual-SIM, optional)</span></label>
                <input
                  type="text" inputMode="numeric" maxLength={15}
                  value={imei2} onChange={(e) => setImei2(e.target.value.replace(/\D/g, '').slice(0, 15))}
                  placeholder="Leave empty for single-SIM"
                  className={`${inp} font-mono`}
                />
                {imei2.length > 0 && !imei2Valid && (
                  <p className="text-[11px] text-red-500 mt-0.5">✗ Invalid IMEI</p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Storage (GB)</label>
                <input type="number" value={storage} onChange={(e) => setStorage(e.target.value)} placeholder="e.g. 128" className={inp} />
              </div>
            </>
          )}

          {/* Non-phone serial number */}
          {serialType !== 'imei' && (
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                {serialType === 'chassis_engine' ? 'Chassis / Engine Number' : 'Serial Number'} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)}
                placeholder={serialType === 'chassis_engine' ? 'e.g. JS1GX71A1Y2100001 / JC85E-1234567' : 'e.g. SN-ABC-12345'}
                className={inp}
              />
            </div>
          )}

          {/* Product */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Product / Model</label>
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className={`${inp} bg-white`}>
              <option value="">— Select product (optional) —</option>
              {products?.data.map((p) => (
                <option key={p.id} value={p.id}>{p.brand ? `${p.brand} ${p.name}` : p.name}</option>
              ))}
            </select>
          </div>

          {/* Color */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Color</label>
            <input type="text" value={color} onChange={(e) => setColor(e.target.value)} placeholder="e.g. Black" className={inp} />
          </div>

          {/* Condition */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Condition</label>
            <div className="flex gap-2">
              {(['new', 'refurbished'] as const).map((c) => (
                <button key={c} type="button" onClick={() => setCondition(c)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition ${condition === c ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                  {c === 'new' ? 'New' : 'Refurbished'}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Notes</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" className={inp} />
          </div>
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">Cancel</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!canSubmit || mutation.isPending}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition disabled:opacity-50">
            {mutation.isPending ? 'Adding…' : 'Add Unit'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Bulk-add modal (IMEI only) ────────────────────────────────────────────────
function BulkAddModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const qc = useQueryClient();
  const [text,      setText]      = useState('');
  const [productId, setProductId] = useState('');
  const [condition, setCondition] = useState<'new' | 'refurbished'>('new');

  const { data: products } = useQuery({
    queryKey: ['products-list'],
    queryFn: () => productsApi.list({ limit: 200 }),
    staleTime: 5 * 60_000,
  });

  const imeis = text.split(/[\n,\s]+/).map((s) => s.replace(/\D/g, '')).filter((s) => s.length === 15);
  const validImeis   = imeis.filter(isValidImei);
  const invalidImeis = imeis.filter((s) => !isValidImei(s));

  const mutation = useMutation({
    mutationFn: () => productUnitsApi.bulkCreate({ imeis: validImeis, productId: productId || undefined, condition }),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['units'] });
      void qc.invalidateQueries({ queryKey: ['unit-stats'] });
      toast.success(`${data.created} units added${data.skipped.length ? `, ${data.skipped.length} skipped (already exist)` : ''}`);
      onAdded();
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Bulk add failed')),
  });

  const inp = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-gray-900">Bulk Add IMEIs (Phones)</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 space-y-3.5">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">IMEIs (one per line, or comma-separated)</label>
            <textarea
              rows={8} value={text} onChange={(e) => setText(e.target.value)}
              placeholder={`357938070123456\n353849060987654\n...`}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            {imeis.length > 0 && (
              <div className="flex gap-3 mt-1.5">
                <span className="text-[11px] text-emerald-600 font-medium">✓ {validImeis.length} valid</span>
                {invalidImeis.length > 0 && (
                  <span className="text-[11px] text-red-500 font-medium">✗ {invalidImeis.length} invalid (will be skipped)</span>
                )}
              </div>
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Product / Model</label>
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className={`${inp} bg-white`}>
              <option value="">— Select product (optional) —</option>
              {products?.data.map((p) => (
                <option key={p.id} value={p.id}>{p.brand ? `${p.brand} ${p.name}` : p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Condition</label>
            <div className="flex gap-2">
              {(['new', 'refurbished'] as const).map((c) => (
                <button key={c} type="button" onClick={() => setCondition(c)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition ${condition === c ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                  {c === 'new' ? 'New' : 'Refurbished'}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">Cancel</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={validImeis.length === 0 || mutation.isPending}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition disabled:opacity-50">
            {mutation.isPending ? 'Adding…' : `Add ${validImeis.length} Units`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PTA DIRBS check modal ─────────────────────────────────────────────────────
function PtaCheckModal({ unit, onClose }: { unit: ProductUnit; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['pta-check', unit.imei],
    queryFn:  () => productUnitsApi.ptaCheck(unit.imei!),
    enabled:  !!unit.imei,
    staleTime: 5 * 60_000,
  });

  const qc = useQueryClient();
  const updateMutation = useMutation({
    mutationFn: (ptaStatus: PtaStatus) => productUnitsApi.update(unit.id, { ptaStatus }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['units'] });
      toast.success('PTA status updated');
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-semibold text-gray-900">PTA DIRBS Check</h2>
            <p className="text-xs text-gray-400 font-mono mt-0.5">{unit.imei}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"><X size={16} /></button>
        </div>
        <div className="px-5 py-5">
          {isLoading && (
            <div className="flex items-center gap-3 text-gray-500">
              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm">Checking PTA DIRBS database…</p>
            </div>
          )}
          {data && data.status === 'UNAVAILABLE' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-amber-800 text-sm">PTA API Unavailable</p>
                  <p className="text-xs text-amber-700 mt-1">{data.message ?? 'Could not reach PTA DIRBS at this time'}</p>
                  <p className="text-xs text-amber-600 mt-2">You can still manually set the PTA status below.</p>
                </div>
              </div>
            </div>
          )}
          {data && data.status === 'OK' && (
            <div className={`rounded-xl p-4 border ${data.registered ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-start gap-3">
                {data.registered
                  ? <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5" />
                  : <AlertTriangle size={20} className="text-red-600 shrink-0 mt-0.5" />
                }
                <div>
                  <p className={`font-bold text-sm ${data.registered ? 'text-emerald-800' : 'text-red-800'}`}>
                    {data.registered ? 'PTA Approved' : 'Not PTA Approved'}
                  </p>
                  <p className={`text-xs mt-0.5 ${data.registered ? 'text-emerald-700' : 'text-red-700'}`}>
                    DIRBS Status: <span className="font-medium">{data.statusMessage}</span>
                  </p>
                  <p className="text-[11px] text-gray-400 mt-2">Source: PTA DIRBS API — Pakistan Telecommunication Authority</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-current/10">
                <p className="text-xs font-medium text-gray-600 mb-2">Update inventory record:</p>
                <div className="flex gap-2">
                  <button onClick={() => updateMutation.mutate('approved')} disabled={updateMutation.isPending || unit.ptaStatus === 'approved'}
                    className="flex-1 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 transition">
                    Mark Approved
                  </button>
                  <button onClick={() => updateMutation.mutate('non_pta')} disabled={updateMutation.isPending || unit.ptaStatus === 'non_pta'}
                    className="flex-1 py-1.5 text-xs font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 transition">
                    Mark Non-PTA
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="px-5 pb-5">
          <button onClick={onClose} className="w-full py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Row actions dropdown ──────────────────────────────────────────────────────
function UnitActions({ unit, onDone, onPtaCheck }: { unit: ProductUnit; onDone: () => void; onPtaCheck: () => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const mutation = useMutation({
    mutationFn: (body: Parameters<typeof productUnitsApi.update>[1]) => productUnitsApi.update(unit.id, body),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['units'] }); void qc.invalidateQueries({ queryKey: ['unit-stats'] }); onDone(); setOpen(false); },
    onError: (e) => toast.error(getErrorMessage(e, 'Update failed')),
  });

  const deleteMutation = useMutation({
    mutationFn: () => productUnitsApi.remove(unit.id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['units'] }); void qc.invalidateQueries({ queryKey: ['unit-stats'] }); toast.success('Unit removed'); setOpen(false); },
    onError: (e) => toast.error(getErrorMessage(e, 'Delete failed')),
  });

  const isPhone = unit.serialType === 'imei';

  const actions = [
    unit.status !== 'available' && { label: 'Mark Available', icon: CheckCircle2, cls: 'text-emerald-600', fn: () => mutation.mutate({ status: 'available' }) },
    unit.status !== 'defective' && { label: 'Mark Defective', icon: Wrench,       cls: 'text-red-600',     fn: () => mutation.mutate({ status: 'defective' }) },
    unit.status !== 'returned'  && { label: 'Mark Returned',  icon: RotateCcw,    cls: 'text-amber-600',   fn: () => mutation.mutate({ status: 'returned' }) },
    isPhone && { label: 'Check PTA DIRBS', icon: ShieldCheck, cls: 'text-blue-600', fn: () => { setOpen(false); onPtaCheck(); } },
    isPhone && unit.ptaStatus !== 'approved' && { label: 'Mark PTA Approved', icon: CheckCircle2,  cls: 'text-emerald-600', fn: () => mutation.mutate({ ptaStatus: 'approved' }) },
    isPhone && unit.ptaStatus !== 'non_pta'  && { label: 'Mark Non-PTA',      icon: AlertTriangle, cls: 'text-red-600',    fn: () => mutation.mutate({ ptaStatus: 'non_pta' }) },
    unit.status !== 'sold' && { label: 'Delete', icon: X, cls: 'text-red-600', fn: () => { if (confirm('Delete this unit?')) deleteMutation.mutate(); } },
  ].filter(Boolean) as { label: string; icon: React.ElementType; cls: string; fn: () => void }[];

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition">
        <ChevronDown size={13} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-6 z-40 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[160px]">
            {actions.map(({ label, icon: Icon, cls, fn }) => (
              <button key={label} onClick={fn} className={`flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-gray-50 ${cls}`}>
                <Icon size={12} />{label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function ImeiPage() {
  const qc = useQueryClient();
  const [search,    setSearch]    = useState('');
  const [status,    setStatus]    = useState<string>('all');
  const [showAdd,   setShowAdd]   = useState(false);
  const [showBulk,  setShowBulk]  = useState(false);
  const [lookupVal, setLookupVal] = useState('');
  const [ptaUnit,   setPtaUnit]   = useState<ProductUnit | null>(null);

  const debouncedSearch = useDebounce(search, 350);
  const debouncedLookup = useDebounce(lookupVal.replace(/\D/g, ''), 400);

  const { data: stats } = useQuery({
    queryKey: ['unit-stats'],
    queryFn:  productUnitsApi.getStats,
    staleTime: 30_000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['units', debouncedSearch, status],
    queryFn:  () => productUnitsApi.list({ search: debouncedSearch || undefined, status, limit: 50 }),
    staleTime: 30_000,
  });

  const { data: lookupResult, isFetching: lookupFetching } = useQuery({
    queryKey: ['imei-lookup', debouncedLookup],
    queryFn:  () => productUnitsApi.lookup(debouncedLookup),
    enabled:  debouncedLookup.length === 15,
    staleTime: 10_000,
  });

  const statusTabs: { key: string; label: string; count?: number }[] = [
    { key: 'all',       label: 'All',       count: stats?.total },
    { key: 'available', label: 'Available', count: stats?.available },
    { key: 'sold',      label: 'Sold',      count: stats?.sold },
    { key: 'defective', label: 'Defective', count: stats?.defective },
    { key: 'returned',  label: 'Returned',  count: stats?.returned },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Package size={20} className="text-blue-600" /> Serial Inventory
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Track every unit — phones by IMEI, bikes by chassis, laptops by serial number</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowBulk(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition">
            <Upload size={14} /> Bulk IMEI
          </button>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition">
            <Plus size={14} /> Add Unit
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {statusTabs.map(({ key, label, count }) => {
          const cls: Record<string, string> = {
            all: 'bg-gray-900 text-white', available: 'bg-emerald-600 text-white',
            sold: 'bg-gray-200 text-gray-700', defective: 'bg-red-600 text-white', returned: 'bg-amber-500 text-white',
          };
          return (
            <button key={key} onClick={() => setStatus(key)}
              className={`rounded-xl p-3 text-center transition ${status === key ? (cls[key] ?? 'bg-blue-600 text-white') : 'bg-white border border-gray-200 text-gray-700 hover:border-blue-300'}`}>
              <p className={`text-2xl font-bold ${status === key ? '' : 'text-gray-900'}`}>{count ?? '—'}</p>
              <p className={`text-xs font-medium ${status === key ? 'opacity-80' : 'text-gray-500'}`}>{label}</p>
            </button>
          );
        })}
      </div>

      {/* IMEI Lookup box */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-4">
        <p className="text-xs font-semibold text-blue-700 mb-2 uppercase tracking-wide">IMEI Quick Lookup (Phone)</p>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text" inputMode="numeric" maxLength={15}
            value={lookupVal} onChange={(e) => setLookupVal(e.target.value.replace(/\D/g, '').slice(0, 15))}
            placeholder="Type 15-digit IMEI to look up instantly"
            className="w-full pl-9 pr-4 py-2.5 text-sm font-mono border border-blue-200 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {lookupVal.length > 0 && (
            <button onClick={() => setLookupVal('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={13} />
            </button>
          )}
        </div>
        {lookupFetching && <p className="text-xs text-gray-400 mt-2">Searching…</p>}
        {lookupResult && !lookupFetching && (
          <div className="mt-3">
            {lookupResult.found ? (
              <div className={`flex items-start gap-3 rounded-xl p-3 ${
                lookupResult.unit!.status === 'available' ? 'bg-emerald-50 border border-emerald-200' :
                lookupResult.unit!.status === 'sold' ? 'bg-red-50 border border-red-200' :
                'bg-amber-50 border border-amber-200'
              }`}>
                <div className="mt-0.5">
                  {lookupResult.unit!.status === 'available'
                    ? <CheckCircle2 size={16} className="text-emerald-600" />
                    : <AlertTriangle size={16} className="text-red-600" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900">
                    {lookupResult.unit!.productBrand ? `${lookupResult.unit!.productBrand} ` : ''}{lookupResult.unit!.productName ?? 'Unknown Product'}
                    {lookupResult.unit!.color ? ` · ${lookupResult.unit!.color}` : ''}
                    {lookupResult.unit!.storageGb ? ` · ${lookupResult.unit!.storageGb}GB` : ''}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <StatusBadge s={lookupResult.unit!.status} />
                    <span className="text-xs text-gray-500">{lookupResult.unit!.condition === 'refurbished' ? 'Refurbished' : 'New'}</span>
                  </div>
                  {lookupResult.unit!.status === 'sold' && lookupResult.unit!.soldToName && (
                    <p className="text-xs text-red-700 mt-1 font-medium">
                      Sold to: {lookupResult.unit!.soldToName}
                      {lookupResult.unit!.soldAt ? ` on ${fmtDate(lookupResult.unit!.soldAt)}` : ''}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl p-3">
                <Search size={15} className="text-gray-400 shrink-0" />
                <p className="text-sm text-gray-500">IMEI <span className="font-mono text-gray-700">{lookupResult.imei}</span> is not in your inventory.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Search + status filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by IMEI, serial number, or customer name…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {statusTabs.map(({ key, label }) => (
            <button key={key} onClick={() => setStatus(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${status === key ? 'bg-gray-900 text-white' : 'text-gray-600 border border-gray-200 hover:border-gray-400'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table — desktop */}
      <div className="hidden md:block bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Serial / IMEI</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Product</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Details</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Sold To</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date Added</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 7 }).map((_, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                ))}</tr>
              ))
            ) : !data?.data.length ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <Package size={32} className="text-gray-200 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">No units found</p>
                  <button onClick={() => setShowAdd(true)} className="mt-2 text-blue-600 text-sm hover:underline">Add your first unit</button>
                </td>
              </tr>
            ) : (
              data.data.map((unit) => (
                <tr key={unit.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs text-gray-800 font-semibold">{serialLabel(unit)}</p>
                    <p className="text-[10px] text-gray-400">{serialTypeLabel(unit.serialType)}</p>
                    {unit.imei2 && <p className="font-mono text-[10px] text-gray-400">{unit.imei2}</p>}
                  </td>
                  <td className="px-4 py-3">
                    {unit.productName ? (
                      <p className="text-sm text-gray-800">
                        {unit.productBrand ? <span className="text-gray-400">{unit.productBrand} </span> : null}
                        {unit.productName}
                      </p>
                    ) : <span className="text-gray-400 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {unit.color && <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{unit.color}</span>}
                      {unit.storageGb && <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{unit.storageGb}GB</span>}
                      {unit.condition === 'refurbished' && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Refurb</span>}
                      {unit.serialType === 'imei' && <PtaBadge s={unit.ptaStatus} />}
                    </div>
                  </td>
                  <td className="px-4 py-3"><StatusBadge s={unit.status} /></td>
                  <td className="px-4 py-3">
                    {unit.soldToName ? (
                      <div>
                        <p className="text-sm text-gray-800">{unit.soldToName}</p>
                        {unit.soldAt && <p className="text-[10px] text-gray-400">{fmtDate(unit.soldAt)}</p>}
                      </div>
                    ) : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(unit.createdAt)}</td>
                  <td className="px-4 py-3">
                    <UnitActions unit={unit} onDone={() => void qc.invalidateQueries({ queryKey: ['units'] })} onPtaCheck={() => setPtaUnit(unit)} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Cards — mobile */}
      <div className="md:hidden space-y-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-40 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-24" />
            </div>
          ))
        ) : !data?.data.length ? (
          <div className="text-center py-12">
            <Package size={32} className="text-gray-200 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">No units found</p>
          </div>
        ) : (
          data.data.map((unit) => (
            <div key={unit.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-mono text-xs font-bold text-gray-800">{serialLabel(unit)}</p>
                    <StatusBadge s={unit.status} />
                    <span className="text-[10px] text-gray-400">{serialTypeLabel(unit.serialType)}</span>
                  </div>
                  {unit.productName && (
                    <p className="text-sm text-gray-700">
                      {unit.productBrand ? `${unit.productBrand} ` : ''}{unit.productName}
                    </p>
                  )}
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {unit.color && <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{unit.color}</span>}
                    {unit.storageGb && <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{unit.storageGb}GB</span>}
                    {unit.serialType === 'imei' && <PtaBadge s={unit.ptaStatus} />}
                  </div>
                  {unit.soldToName && (
                    <p className="text-xs text-gray-500 mt-1">
                      Sold to: <span className="font-medium text-gray-700">{unit.soldToName}</span>
                      {unit.soldAt ? ` · ${fmtDate(unit.soldAt)}` : ''}
                    </p>
                  )}
                </div>
                <UnitActions unit={unit} onDone={() => void qc.invalidateQueries({ queryKey: ['units'] })} onPtaCheck={() => setPtaUnit(unit)} />
              </div>
            </div>
          ))
        )}
      </div>

      {data && (
        <p className="text-xs text-gray-400 text-right">
          Showing {data.data.length} of {data.total} units
        </p>
      )}

      {showAdd  && <AddUnitModal  onClose={() => setShowAdd(false)}  onAdded={() => setShowAdd(false)} />}
      {showBulk && <BulkAddModal  onClose={() => setShowBulk(false)} onAdded={() => setShowBulk(false)} />}
      {ptaUnit  && <PtaCheckModal unit={ptaUnit} onClose={() => setPtaUnit(null)} />}
    </div>
  );
}
