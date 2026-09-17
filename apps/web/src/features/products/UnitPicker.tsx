import { useState } from 'react';
import { Search, CheckCircle2, ShieldCheck, ShieldAlert, Smartphone, Car } from 'lucide-react';
import type { ProductUnit } from '../../api/productUnits.api.ts';

export function unitSerial(u: ProductUnit): string {
  return u.serialType === 'imei' ? (u.imei ?? '') : (u.serialNumber ?? '');
}

/**
 * Lets the seller pick the exact physical unit (IMEI for phones, chassis/engine for
 * vehicles) that is leaving stock. `value` is the serial the sale will carry.
 */
export default function UnitPicker({ units, value, onChange, compact }: {
  units: ProductUnit[]; value: string; onChange: (serial: string) => void; compact?: boolean;
}) {
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? units.filter((u) => [u.imei, u.imei2, u.serialNumber, u.engineNumber, u.color].some((f) => f?.toLowerCase().includes(needle)))
    : units;
  const isVehicle = units[0]?.serialType === 'chassis_engine';

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs font-semibold text-blue-800 flex items-center gap-1.5">
          {isVehicle ? <Car size={13} /> : <Smartphone size={13} />}
          {isVehicle ? 'Gaari chunein (chassis / engine)' : 'Unit chunein (IMEI)'}
          <span className="text-blue-500 font-normal">· {units.length} available</span>
        </p>
        {value && <span className="text-[11px] font-medium text-emerald-700 flex items-center gap-1"><CheckCircle2 size={12} /> selected</span>}
      </div>
      {units.length > 4 && (
        <div className="relative mb-2">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="IMEI / chassis / colour search…"
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-400" />
        </div>
      )}
      <div className={`space-y-1 overflow-y-auto ${compact ? 'max-h-40' : 'max-h-56'}`}>
        {filtered.length === 0 && <p className="text-xs text-gray-400 py-3 text-center">Koi unit match nahi hua</p>}
        {filtered.map((u) => {
          const serial = unitSerial(u);
          const selected = value === serial || (!!u.engineNumber && value === u.engineNumber);
          return (
            <button key={u.id} type="button" onClick={() => onChange(selected ? '' : serial)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left border transition ${selected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200 hover:border-blue-300'}`}>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-mono font-semibold truncate ${selected ? 'text-white' : 'text-gray-900'}`}>{serial || '—'}</p>
                <p className={`text-[11px] truncate ${selected ? 'text-blue-100' : 'text-gray-500'}`}>
                  {u.serialType === 'imei'
                    ? [u.imei2 && `IMEI2 ${u.imei2}`, u.color, u.storageGb && `${u.storageGb} GB`, u.condition === 'refurbished' && 'Refurbished'].filter(Boolean).join(' · ') || 'Phone'
                    : [u.engineNumber && `Engine ${u.engineNumber}`, u.color].filter(Boolean).join(' · ') || 'Vehicle'}
                </p>
              </div>
              {u.serialType === 'imei' && u.ptaStatus !== 'unknown' && (
                <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                  selected ? 'bg-white/20 text-white' : u.ptaStatus === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                  {u.ptaStatus === 'approved' ? <ShieldCheck size={10} /> : <ShieldAlert size={10} />}
                  {u.ptaStatus === 'approved' ? 'PTA' : 'Non-PTA'}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
