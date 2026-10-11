import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Truck } from 'lucide-react';
import toast from 'react-hot-toast';
import { deliveriesApi } from '../api/deliveries.api.ts';
import { customersApi } from '../api/customers.api.ts';
import { getErrorMessage } from '../utils/error.ts';

export default function CreateDeliveryModal({ saleType, saleId, customerId, onClose }: {
  saleType: 'CASH' | 'INSTALLMENT'; saleId: string; customerId?: string; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [address, setAddress] = useState('');
  const [driverMode, setDriverMode] = useState<'pick' | 'manual'>('pick');
  const [driverUserId, setDriverUserId] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [addressTouched, setAddressTouched] = useState(false);

  const { data: drivers = [] } = useQuery({
    queryKey: ['delivery-drivers'],
    queryFn: deliveriesApi.listDrivers,
    staleTime: 5 * 60_000,
  });

  // Prefill from the customer's address for installment-sourced deliveries (cash
  // sales have no customerId at all) — stays editable, and a manual edit wins.
  const { data: customer } = useQuery({
    queryKey: ['customer-address-prefill', customerId],
    queryFn: () => customersApi.getOne(customerId!),
    enabled: !!customerId,
    staleTime: 60_000,
  });

  const effectiveAddress = addressTouched ? address : (customer?.address ?? '');

  const mut = useMutation({
    mutationFn: () => deliveriesApi.create({
      saleType, saleId,
      deliveryAddress: effectiveAddress.trim(),
      driverUserId: driverMode === 'pick' ? driverUserId : undefined,
      driverName: driverMode === 'manual' ? driverName.trim() : undefined,
      driverPhone: driverPhone.trim() || undefined,
      scheduledDate: scheduledDate || undefined,
    }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['deliveries'] });
      toast.success('Delivery slip ban gayi');
      onClose();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const driverValid = driverMode === 'pick' ? !!driverUserId : !!driverName.trim();
  const valid = effectiveAddress.trim().length > 0 && driverValid;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="border-b border-gray-100 flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <Truck size={16} className="text-blue-500" />
            <p className="text-gray-900 font-semibold text-sm">Delivery Slip Banao</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Delivery Address *</label>
            <textarea value={effectiveAddress} onChange={(e) => { setAddress(e.target.value); setAddressTouched(true); }} rows={2}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-blue-400 transition"
              placeholder="Ghar ka pura address likhein…" />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Driver / Loader *</label>
            <div className="grid grid-cols-2 gap-2 bg-slate-100 rounded-xl p-1 mb-2">
              {(['pick', 'manual'] as const).map((m) => (
                <button key={m} onClick={() => setDriverMode(m)}
                  className={`py-1.5 rounded-lg text-xs font-bold transition ${driverMode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
                  {m === 'pick' ? 'Staff se chuno' : 'Naam likho'}
                </button>
              ))}
            </div>
            {driverMode === 'pick' ? (
              drivers.length === 0 ? (
                <p className="text-[11px] text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                  Koi staff "Deliveries" permission ke sath nahi hai — loader ko staff account banayein, ya "Naam likho" use karein.
                </p>
              ) : (
                <select value={driverUserId} onChange={(e) => setDriverUserId(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 bg-white transition">
                  <option value="">— driver chunein —</option>
                  {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              )
            ) : (
              <input value={driverName} onChange={(e) => setDriverName(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 transition"
                placeholder="Driver ka naam" />
            )}
            <input value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 transition mt-2"
              placeholder="Driver ka phone (optional)" />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Scheduled Date <span className="font-normal text-slate-400">(optional)</span></label>
            <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 transition" />
            <p className="text-[11px] text-slate-400 mt-1">Khali chhorain agar ASAP deliver karna hai.</p>
          </div>
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="flex-1 border border-slate-200 rounded-xl py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition">Wapas</button>
          <button onClick={() => mut.mutate()} disabled={!valid || mut.isPending}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-40 transition">
            {mut.isPending ? 'Ban raha…' : 'Slip Banao'}
          </button>
        </div>
      </div>
    </div>
  );
}
