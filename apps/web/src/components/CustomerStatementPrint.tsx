import { useEffect } from 'react';
import type { Customer } from '../api/customers.api.ts';
import type { Installment } from '../api/installments.api.ts';
import { fmtDate, fmtDateTime } from '../utils/dateFormat.ts';

interface Props {
  customer: Customer;
  installments: Installment[];
  shopName: string;
  shopPhone: string;
  onClose: () => void;
}

function pkr(v: string | number) {
  return 'PKR ' + Number(v).toLocaleString('en-PK', { maximumFractionDigits: 0 });
}

export default function CustomerStatementPrint({ customer, installments, shopName, shopPhone, onClose }: Props) {
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'statement-print-override';
    style.innerHTML = `
      @media print {
        body * { visibility: hidden !important; }
        #statement-print-root, #statement-print-root * { visibility: visible !important; }
        #statement-print-root { position: fixed !important; inset: 0 !important; background: white !important; overflow: visible !important; box-shadow: none !important; border-radius: 0 !important; }
        #statement-action-bar { display: none !important; }
      }
    `;
    document.head.appendChild(style);
    return () => { document.getElementById('statement-print-override')?.remove(); };
  }, []);

  const totalBusiness  = installments.reduce((s, i) => s + Number(i.totalAmount), 0);
  const totalPaid      = installments.reduce((s, i) => s + (Number(i.totalAmount) - Number(i.remaining)), 0);
  const totalRemaining = installments.reduce((s, i) => s + Number(i.remaining), 0);

  const s = {
    fontFamily: "'Segoe UI', Arial, sans-serif",
    fontSize: 12, color: '#1e293b', background: 'white',
    padding: '28px 36px', boxSizing: 'border-box' as const,
  };

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '24px 16px', backdropFilter: 'blur(4px)' }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div style={{ width: '100%', maxWidth: 780 }}>

          {/* Action bar */}
          <div id="statement-action-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ color: 'white', fontWeight: 700 }}>Customer Statement</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'white', fontSize: 13, cursor: 'pointer' }}>Close</button>
              <button onClick={() => window.print()} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#2563eb', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>🖨 Print / Save PDF</button>
            </div>
          </div>

          {/* Document */}
          <div id="statement-print-root" style={{ background: 'white', borderRadius: 12, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={s}>

              {/* Header */}
              <div style={{ background: 'linear-gradient(135deg,#0f172a,#1e3a5f)', margin: '-28px -36px 24px', padding: '24px 36px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: 'white' }}>{shopName}</div>
                    <div style={{ fontSize: 11, color: '#93c5fd', marginTop: 4 }}>Tel: {shopPhone}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-block', background: '#2563eb', color: 'white', fontSize: 10, fontWeight: 800, padding: '3px 12px', borderRadius: 20, letterSpacing: 1 }}>ACCOUNT STATEMENT</div>
                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 6 }}>Date: {fmtDate(new Date())}</div>
                  </div>
                </div>
                <div style={{ height: 3, background: 'linear-gradient(90deg,#f59e0b,#3b82f6,#f59e0b)', margin: '18px -36px 0' }} />
              </div>

              {/* Customer info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px 20px', marginBottom: 20 }}>
                {[
                  ['Customer', customer.name],
                  ['Phone', customer.phone],
                  ['CNIC', customer.cnicMasked],
                  ['Address', customer.address],
                ].map(([l, v]) => v && (
                  <div key={l}>
                    <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>{l}</div>
                    <div style={{ fontSize: 12, color: '#0f172a', fontWeight: 500, borderBottom: '1px solid #f1f5f9', paddingBottom: 4 }}>{v}</div>
                  </div>
                ))}
              </div>

              {/* Summary boxes */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
                {[
                  { label: 'Total Business', value: pkr(totalBusiness), color: '#0f172a' },
                  { label: 'Total Paid',     value: pkr(totalPaid),     color: '#059669' },
                  { label: 'Outstanding',    value: pkr(totalRemaining), color: totalRemaining > 0 ? '#ea580c' : '#059669' },
                ].map((c) => (
                  <div key={c.label} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{c.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: c.color }}>{c.value}</div>
                  </div>
                ))}
              </div>

              {/* Installments */}
              {installments.map((inst) => {
                const paid = Number(inst.totalAmount) - Number(inst.remaining);
                const pct  = Math.round((paid / Number(inst.totalAmount)) * 100);
                const STATUS_COLOR: Record<string, string> = { ACTIVE: '#2563eb', COMPLETED: '#059669', DEFAULTED: '#dc2626', CANCELLED: '#6b7280' };
                return (
                  <div key={inst.id} style={{ marginBottom: 18, border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                    {/* Plan header */}
                    <div style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{inst.productName}</span>
                        <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 8 }}>Started {fmtDate(inst.startDate)} · {inst.months} months</span>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: STATUS_COLOR[inst.status] ?? '#6b7280', background: `${STATUS_COLOR[inst.status]}18`, padding: '2px 8px', borderRadius: 12 }}>
                        {inst.status}
                      </span>
                    </div>
                    {/* Plan figures */}
                    <div style={{ padding: '10px 16px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                      {[
                        ['Total', pkr(inst.totalAmount)],
                        ['Down Payment', pkr(inst.downPayment)],
                        ['Monthly', pkr(inst.monthly)],
                        ['Remaining', pkr(inst.remaining)],
                      ].map(([l, v]) => (
                        <div key={l}>
                          <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 2 }}>{l}</div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#0f172a' }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    {/* Progress bar */}
                    <div style={{ padding: '0 16px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, background: '#e2e8f0', borderRadius: 4, height: 4 }}>
                        <div style={{ width: `${pct}%`, background: pct === 100 ? '#059669' : '#2563eb', height: 4, borderRadius: 4 }} />
                      </div>
                      <span style={{ fontSize: 10, color: '#94a3b8', width: 30 }}>{pct}%</span>
                    </div>
                  </div>
                );
              })}

              {installments.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: 12 }}>No installments on record.</div>
              )}

              {/* Footer */}
              <div style={{ borderTop: '1px solid #f1f5f9', marginTop: 8, paddingTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#94a3b8' }}>
                <span>{shopName} · Customer Account Statement</span>
                <span>Generated: {fmtDateTime(new Date())}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
