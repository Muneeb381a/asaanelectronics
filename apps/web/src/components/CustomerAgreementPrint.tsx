import { useEffect } from 'react';
import type { Customer } from '../api/customers.api.ts';

interface Props {
  customer: Customer;
  shopName: string;
  shopAddress: string | null;
  shopPhone: string;
  onClose: () => void;
}

function today() {
  return new Date().toLocaleDateString('en-PK', { day: '2-digit', month: 'long', year: 'numeric' });
}

function refNo() {
  const d = new Date();
  return `AGR-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

const REF = refNo();

/* ── helpers ───────────────────────────────────────────────── */

function Field({ label, value, wide }: { label: string; value?: string | null; wide?: boolean }) {
  return (
    <div style={{ gridColumn: wide ? '1 / -1' : undefined }}>
      <div style={{ fontSize: 8, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 }}>
        {label}
      </div>
      <div style={{
        fontSize: 11, color: value ? '#0f172a' : '#cbd5e1', fontWeight: value ? 500 : 400,
        borderBottom: '1px solid #e2e8f0', paddingBottom: 4, minHeight: 20,
      }}>
        {value || '—'}
      </div>
    </div>
  );
}

function SectionHeader({ children, accent }: { children: React.ReactNode; accent: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <div style={{ width: 4, height: 18, borderRadius: 2, background: accent, flexShrink: 0 }} />
      <div style={{ fontSize: 10, fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: 1.2 }}>
        {children}
      </div>
      <div style={{ flex: 1, height: 1, background: '#f1f5f9' }} />
    </div>
  );
}

function SigBlock({ label, sub }: { label: string; sub?: string }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%', border: '1.5px dashed #cbd5e1',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 6, background: '#f8fafc',
      }}>
        <div style={{ fontSize: 7, color: '#cbd5e1', textAlign: 'center', lineHeight: 1.4 }}>THUMB<br />PRINT</div>
      </div>
      <div style={{ borderBottom: '1.5px solid #334155', marginBottom: 5, height: 32 }} />
      <div style={{ fontSize: 10, fontWeight: 700, color: '#334155' }}>{label}</div>
      {sub && <div style={{ fontSize: 8, color: '#94a3b8', marginTop: 1 }}>{sub}</div>}
      <div style={{ fontSize: 8, color: '#94a3b8', marginTop: 3 }}>Date: ________________</div>
    </div>
  );
}

function DocImage({ src, label, wide }: { src: string; label: string; wide?: boolean }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <img src={src} alt={label} style={{
        width: '100%', height: wide ? 160 : 110, objectFit: 'cover',
        border: '1.5px solid #e2e8f0', borderRadius: 6, display: 'block', marginBottom: 4,
      }} />
      <div style={{ fontSize: 8, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
    </div>
  );
}

/* ── main ──────────────────────────────────────────────────── */

export default function CustomerAgreementPrint({ customer, shopName, shopAddress, shopPhone, onClose }: Props) {
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'agreement-print-override';
    style.innerHTML = `
      @media print {
        body * { visibility: hidden !important; }
        #agreement-print-root, #agreement-print-root * { visibility: visible !important; }
        #agreement-print-root {
          position: fixed !important; inset: 0 !important;
          background: white !important; overflow: visible !important;
          box-shadow: none !important; border-radius: 0 !important;
          max-width: none !important; padding: 0 !important;
        }
        #agreement-action-bar { display: none !important; }
      }
    `;
    document.head.appendChild(style);
    return () => { document.getElementById('agreement-print-override')?.remove(); };
  }, []);

  const hasGuarantor1 = !!customer.guarantorName;
  const hasGuarantor2 = !!customer.guarantor2Name;
  const hasCnic       = !!(customer.cnicFrontUrl || customer.cnicBackUrl);
  const hasCheque     = !!customer.blankChequeUrl;

  return (
    <>
      <div
        style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.75)',
          zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          overflowY: 'auto', padding: '24px 16px', backdropFilter: 'blur(4px)',
        }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div style={{ width: '100%', maxWidth: 820 }}>

          {/* Action bar */}
          <div id="agreement-action-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ color: 'white', fontWeight: 700, fontSize: 14 }}>Customer Agreement</div>
              <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>Ref: {REF}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'white', fontSize: 13, cursor: 'pointer' }}>
                Close
              </button>
              <button onClick={() => window.print()} style={{ padding: '8px 22px', borderRadius: 8, border: 'none', background: '#2563eb', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(37,99,235,0.4)' }}>
                🖨 Print / Save PDF
              </button>
            </div>
          </div>

          {/* Document */}
          <div id="agreement-print-root" style={{ background: 'white', borderRadius: 12, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>

            {/* ══ HEADER ══ */}
            <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)', padding: '24px 36px 0', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -30, right: -30, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
              <div style={{ position: 'absolute', top: 10, right: 60, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: 'white', letterSpacing: 0.5, lineHeight: 1 }}>{shopName}</div>
                  {shopAddress && <div style={{ fontSize: 10, color: '#93c5fd', marginTop: 5 }}>{shopAddress}</div>}
                  <div style={{ fontSize: 10, color: '#93c5fd', marginTop: 2 }}>Tel: {shopPhone}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ display: 'inline-block', background: '#2563eb', color: 'white', fontSize: 10, fontWeight: 800, padding: '4px 14px', borderRadius: 20, letterSpacing: 1, textTransform: 'uppercase' }}>
                    Installment Agreement
                  </div>
                  <div style={{ fontSize: 9, color: '#64748b', marginTop: 7 }}>Ref No: <span style={{ color: '#93c5fd', fontWeight: 600 }}>{REF}</span></div>
                  <div style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>Date: <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{today()}</span></div>
                </div>
              </div>
              <div style={{ height: 4, background: 'linear-gradient(90deg, #f59e0b, #3b82f6, #f59e0b)', marginTop: 18, marginLeft: -36, marginRight: -36 }} />
            </div>

            {/* ══ BODY ══ */}
            <div style={{ padding: '24px 36px', fontFamily: "'Segoe UI', Arial, sans-serif" }}>

              {/* ── Customer Info ── */}
              <div style={{ marginBottom: 20 }}>
                <SectionHeader accent="#2563eb">Customer Information</SectionHeader>
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  {/* Photo */}
                  {customer.photoUrl && (
                    <div style={{ flexShrink: 0, textAlign: 'center' }}>
                      <img src={customer.photoUrl} alt="Customer" style={{ width: 80, height: 96, objectFit: 'cover', border: '2px solid #e2e8f0', borderRadius: 8 }} />
                      <div style={{ fontSize: 7, color: '#94a3b8', marginTop: 3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Photo</div>
                    </div>
                  )}
                  <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px 16px' }}>
                    <Field label="Full Name"          value={customer.name} />
                    <Field label="CNIC Number"        value={customer.cnicMasked} />
                    <Field label="Mobile Number"      value={customer.phone} />
                    <Field label="Father / Husband"   value={customer.fatherName} />
                    <Field label="CNIC Expiry"        value={customer.cnicExpiry} />
                    <Field label="Occupation"         value={customer.occupation} />
                    <Field label="Home Address"       value={customer.address}       wide />
                    <Field label="Office / Work"      value={customer.officeAddress} wide />
                    <Field label="Employer / Company" value={customer.employer} />
                    <Field label="Monthly Salary"     value={customer.salary ? `PKR ${Number(customer.salary).toLocaleString('en-PK')}` : null} />
                  </div>
                </div>
              </div>

              {/* ── CNIC Documents ── */}
              {hasCnic && (
                <div style={{ marginBottom: 20 }}>
                  <SectionHeader accent="#0891b2">Identity Documents (CNIC)</SectionHeader>
                  <div style={{ display: 'grid', gridTemplateColumns: customer.cnicFrontUrl && customer.cnicBackUrl ? '1fr 1fr' : '1fr', gap: 12 }}>
                    {customer.cnicFrontUrl && <DocImage src={customer.cnicFrontUrl} label="CNIC — Front Side" />}
                    {customer.cnicBackUrl  && <DocImage src={customer.cnicBackUrl}  label="CNIC — Back Side" />}
                  </div>
                </div>
              )}

              {/* ── Blank Cheque ── */}
              {hasCheque && (
                <div style={{ marginBottom: 20 }}>
                  <SectionHeader accent="#b45309">Security Cheque</SectionHeader>
                  <DocImage src={customer.blankChequeUrl!} label="Blank Cheque — Security" wide />
                  {(customer.chequeBank || customer.chequeAccountNo || customer.chequeNo) && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px 16px', marginTop: 10 }}>
                      <Field label="Bank Name"   value={customer.chequeBank} />
                      <Field label="Account No." value={customer.chequeAccountNo} />
                      <Field label="Cheque No."  value={customer.chequeNo} />
                    </div>
                  )}
                </div>
              )}

              {/* ── Guarantor 1 ── */}
              {hasGuarantor1 && (
                <div style={{ marginBottom: 20 }}>
                  <SectionHeader accent="#7c3aed">
                    Guarantor 1{customer.guarantorRelation ? ` — ${customer.guarantorRelation}` : ''}
                  </SectionHeader>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px 16px', marginBottom: 10 }}>
                    <Field label="Full Name"    value={customer.guarantorName} />
                    <Field label="CNIC Number"  value={customer.guarantorCnic} />
                    <Field label="Mobile Number" value={customer.guarantorPhone} />
                    <Field label="Address" value={customer.guarantorAddress} wide />
                  </div>
                  {(customer.guarantorCnicFrontUrl || customer.guarantorCnicBackUrl) && (
                    <div style={{ display: 'grid', gridTemplateColumns: customer.guarantorCnicFrontUrl && customer.guarantorCnicBackUrl ? '1fr 1fr' : '1fr', gap: 10 }}>
                      {customer.guarantorCnicFrontUrl && <DocImage src={customer.guarantorCnicFrontUrl} label="Guarantor 1 CNIC — Front" />}
                      {customer.guarantorCnicBackUrl  && <DocImage src={customer.guarantorCnicBackUrl}  label="Guarantor 1 CNIC — Back" />}
                    </div>
                  )}
                </div>
              )}

              {/* ── Guarantor 2 ── */}
              {hasGuarantor2 && (
                <div style={{ marginBottom: 20 }}>
                  <SectionHeader accent="#db2777">
                    Guarantor 2{customer.guarantor2Relation ? ` — ${customer.guarantor2Relation}` : ''}
                  </SectionHeader>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px 16px', marginBottom: 10 }}>
                    <Field label="Full Name"    value={customer.guarantor2Name} />
                    <Field label="CNIC Number"  value={customer.guarantor2Cnic} />
                    <Field label="Mobile Number" value={customer.guarantor2Phone} />
                    <Field label="Address" value={customer.guarantor2Address} wide />
                  </div>
                  {(customer.guarantor2CnicFrontUrl || customer.guarantor2CnicBackUrl) && (
                    <div style={{ display: 'grid', gridTemplateColumns: customer.guarantor2CnicFrontUrl && customer.guarantor2CnicBackUrl ? '1fr 1fr' : '1fr', gap: 10 }}>
                      {customer.guarantor2CnicFrontUrl && <DocImage src={customer.guarantor2CnicFrontUrl} label="Guarantor 2 CNIC — Front" />}
                      {customer.guarantor2CnicBackUrl  && <DocImage src={customer.guarantor2CnicBackUrl}  label="Guarantor 2 CNIC — Back" />}
                    </div>
                  )}
                </div>
              )}

              {/* ── Terms ── */}
              <div style={{ marginBottom: 24, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 16px' }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                  Terms &amp; Conditions
                </div>
                <ol style={{ margin: 0, paddingLeft: 14, fontSize: 9.5, color: '#64748b', lineHeight: 1.9 }}>
                  <li>The customer agrees to pay monthly installments on or before the due date without delay.</li>
                  <li>In case of default exceeding 30 days, the guarantors shall be jointly and severally liable for all outstanding amounts.</li>
                  <li>The product remains the sole property of <strong style={{ color: '#334155' }}>{shopName}</strong> until full and final payment is received.</li>
                  <li>Any damage, loss, or theft of the product while installments are pending is the sole responsibility of the buyer.</li>
                  <li>The blank cheque provided as security may be presented to the bank upon default without further notice.</li>
                  <li>Early full settlement is permitted; any markup adjustment is at the sole discretion of {shopName}.</li>
                  <li>By signing below, all parties confirm they have read, understood, and agreed to these terms.</li>
                </ol>
              </div>

              {/* ── Signatures ── */}
              <SectionHeader accent="#059669">Authorized Signatures</SectionHeader>
              <div style={{ display: 'flex', gap: 20, marginBottom: 24 }}>
                <SigBlock label="Customer" sub={customer.name} />
                {hasGuarantor1 && <SigBlock label="Guarantor 1" sub={customer.guarantorName ?? undefined} />}
                {hasGuarantor2 && <SigBlock label="Guarantor 2" sub={customer.guarantor2Name ?? undefined} />}
                <SigBlock label="Seller / Staff" />
                <SigBlock label="Shop Owner" sub={shopName} />
              </div>

              {/* ── Footer ── */}
              <div style={{ borderTop: '2px solid #f1f5f9', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 6, background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 12, height: 12, borderRadius: 3, border: '2px solid #3b82f6' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#0f172a' }}>{shopName}</div>
                    <div style={{ fontSize: 8, color: '#94a3b8' }}>Official Installment Agreement</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 8, color: '#94a3b8' }}>
                  <div>Ref: {REF}</div>
                  <div>Generated: {new Date().toLocaleString('en-PK')}</div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </>
  );
}
