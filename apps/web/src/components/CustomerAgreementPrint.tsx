import { useEffect } from 'react';
import type { Customer } from '../api/customers.api.ts';
import { fmtDate, fmtDateTime } from '../utils/dateFormat.ts';

interface Props {
  customer: Customer;
  shopName: string;
  shopAddress: string | null;
  shopPhone: string;
  onClose: () => void;
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
      <div style={{ fontSize: 7.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 }}>
        {label}
      </div>
      <div style={{
        fontSize: 10, color: value ? '#0f172a' : '#cbd5e1', fontWeight: value ? 500 : 400,
        borderBottom: '1px solid #e2e8f0', paddingBottom: 3, minHeight: 18,
      }}>
        {value || '—'}
      </div>
    </div>
  );
}

function SectionHeader({ children, accent }: { children: React.ReactNode; accent: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, marginTop: 4 }}>
      <div style={{ width: 3, height: 16, borderRadius: 2, background: accent, flexShrink: 0 }} />
      <div style={{ fontSize: 9, fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: 1.1 }}>
        {children}
      </div>
      <div style={{ flex: 1, height: 1, background: '#f1f5f9' }} />
    </div>
  );
}

function SigBlock({ label, sub }: { label: string; sub?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        width: 44, height: 44, borderRadius: '50%', border: '1.5px dashed #cbd5e1',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 5, background: '#f8fafc',
      }}>
        <div style={{ fontSize: 6.5, color: '#cbd5e1', textAlign: 'center', lineHeight: 1.4 }}>THUMB<br />PRINT</div>
      </div>
      <div style={{ borderBottom: '1.5px solid #334155', marginBottom: 4, height: 28 }} />
      <div style={{ fontSize: 9, fontWeight: 700, color: '#334155' }}>{label}</div>
      {sub && <div style={{ fontSize: 7.5, color: '#64748b', marginTop: 1 }}>{sub}</div>}
      <div style={{ fontSize: 7.5, color: '#94a3b8', marginTop: 3 }}>Date: ________________</div>
    </div>
  );
}

function DocImage({ src, label, wide }: { src: string; label: string; wide?: boolean }) {
  return (
    /* agr-no-print hides this section when printing — images take too much space */
    <div className="agr-no-print" style={{ textAlign: 'center' }}>
      <img src={src} alt={label} style={{
        width: '100%', height: wide ? 180 : 130, objectFit: 'contain',
        background: '#f8fafc',
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
        @page { size: A4 portrait; margin: 8mm 10mm; }
        body * { visibility: hidden !important; }
        #agreement-print-root, #agreement-print-root * { visibility: visible !important; }
        #agreement-print-root {
          /* static — NOT absolute — so content paginates correctly to next page */
          position: static !important;
          width: 100% !important;
          background: white !important;
          overflow: visible !important;
          box-shadow: none !important;
          border-radius: 0 !important;
          padding: 0 !important;
        }
        #agreement-action-bar { display: none !important; }
        /* Hide document images so everything fits on one page */
        .agr-no-print { display: none !important; }
        /* Never split the signature section across pages */
        .agr-sig-section { page-break-inside: avoid !important; break-inside: avoid !important; }
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
            <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)', padding: '20px 32px 0', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -30, right: -30, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: 'white', letterSpacing: 0.5, lineHeight: 1 }}>{shopName}</div>
                  {shopAddress && <div style={{ fontSize: 9.5, color: '#93c5fd', marginTop: 4 }}>{shopAddress}</div>}
                  <div style={{ fontSize: 9.5, color: '#93c5fd', marginTop: 2 }}>Tel: {shopPhone}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ display: 'inline-block', background: '#2563eb', color: 'white', fontSize: 9.5, fontWeight: 800, padding: '4px 14px', borderRadius: 20, letterSpacing: 1, textTransform: 'uppercase' }}>
                    Installment Agreement · اقساط نامہ
                  </div>
                  <div style={{ fontSize: 8.5, color: '#64748b', marginTop: 6 }}>Ref No: <span style={{ color: '#93c5fd', fontWeight: 600 }}>{REF}</span></div>
                  {customer.fileNumber && (
                    <div style={{ fontSize: 8.5, color: '#64748b', marginTop: 2 }}>File No: <span style={{ color: '#fbbf24', fontWeight: 700, fontFamily: 'monospace' }}>#{customer.fileNumber}</span></div>
                  )}
                  <div style={{ fontSize: 8.5, color: '#64748b', marginTop: 2 }}>Date: <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{fmtDate(new Date())}</span></div>
                </div>
              </div>
              <div style={{ height: 4, background: 'linear-gradient(90deg, #f59e0b, #3b82f6, #f59e0b)', marginTop: 16, marginLeft: -32, marginRight: -32 }} />
            </div>

            {/* ══ BODY ══ */}
            <div style={{ padding: '20px 32px', fontFamily: "'Segoe UI', Arial, sans-serif" }}>

              {/* ── Customer Info ── */}
              <div style={{ marginBottom: 16 }}>
                <SectionHeader accent="#2563eb">Customer Information · گاہک کی معلومات</SectionHeader>
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  {customer.photoUrl && (
                    <div className="agr-no-print" style={{ flexShrink: 0, textAlign: 'center' }}>
                      <img src={customer.photoUrl} alt="Customer" style={{ width: 75, height: 90, objectFit: 'cover', border: '2px solid #e2e8f0', borderRadius: 8 }} />
                      <div style={{ fontSize: 7, color: '#94a3b8', marginTop: 3, fontWeight: 600, textTransform: 'uppercase' }}>Photo</div>
                    </div>
                  )}
                  <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px 14px' }}>
                    <Field label="Full Name · پورا نام"        value={customer.name} />
                    <Field label="File No · فائل نمبر"         value={customer.fileNumber ? `#${customer.fileNumber}` : null} />
                    <Field label="Mobile · موبائل"              value={customer.phone} />
                    <Field label="CNIC Number · شناختی کارڈ"   value={customer.cnicMasked} />
                    <Field label="Father / Husband · والد / شوہر" value={customer.fatherName} />
                    <Field label="CNIC Expiry · میعاد"          value={customer.cnicExpiry} />
                    <Field label="Occupation · پیشہ"            value={customer.occupation} />
                    <Field label="Home Address · گھر کا پتہ"    value={customer.address}       wide />
                    <Field label="Office / Work · دفتر"         value={customer.officeAddress} wide />
                    <Field label="Employer · ادارہ"             value={customer.employer} />
                    <Field label="Monthly Salary · تنخواہ"      value={customer.salary ? `PKR ${Number(customer.salary).toLocaleString('en-PK')}` : null} />
                  </div>
                </div>
              </div>

              {/* ── CNIC Documents (screen only) ── */}
              {hasCnic && (
                <div className="agr-no-print" style={{ marginBottom: 16 }}>
                  <SectionHeader accent="#0891b2">Identity Documents (CNIC)</SectionHeader>
                  <div style={{ display: 'grid', gridTemplateColumns: customer.cnicFrontUrl && customer.cnicBackUrl ? '1fr 1fr' : '1fr', gap: 12 }}>
                    {customer.cnicFrontUrl && <DocImage src={customer.cnicFrontUrl} label="CNIC — Front Side" />}
                    {customer.cnicBackUrl  && <DocImage src={customer.cnicBackUrl}  label="CNIC — Back Side" />}
                  </div>
                </div>
              )}

              {/* ── Blank Cheque (screen only) ── */}
              {hasCheque && (
                <div className="agr-no-print" style={{ marginBottom: 16 }}>
                  <SectionHeader accent="#b45309">Security Cheque</SectionHeader>
                  <DocImage src={customer.blankChequeUrl!} label="Blank Cheque — Security" wide />
                  {(customer.chequeBank || customer.chequeAccountNo || customer.chequeNo) && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px 14px', marginTop: 10 }}>
                      <Field label="Bank Name"   value={customer.chequeBank} />
                      <Field label="Account No." value={customer.chequeAccountNo} />
                      <Field label="Cheque No."  value={customer.chequeNo} />
                    </div>
                  )}
                </div>
              )}

              {/* ── Cheque details in print (text only) ── */}
              {hasCheque && (customer.chequeBank || customer.chequeAccountNo || customer.chequeNo) && (
                <div style={{ marginBottom: 14 }}>
                  <SectionHeader accent="#b45309">Security Cheque · ضمانتی چیک</SectionHeader>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px 14px' }}>
                    <Field label="Bank Name · بینک" value={customer.chequeBank} />
                    <Field label="Account No."       value={customer.chequeAccountNo} />
                    <Field label="Cheque No."        value={customer.chequeNo} />
                  </div>
                </div>
              )}

              {/* ── Guarantor 1 ── */}
              {hasGuarantor1 && (
                <div style={{ marginBottom: 14 }}>
                  <SectionHeader accent="#7c3aed">
                    Guarantor 1 · ضامن ۱{customer.guarantorRelation ? ` — ${customer.guarantorRelation}` : ''}
                  </SectionHeader>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px 14px', marginBottom: 10 }}>
                    <Field label="Full Name · نام"        value={customer.guarantorName} />
                    <Field label="CNIC · شناختی کارڈ"     value={customer.guarantorCnic} />
                    <Field label="Mobile · موبائل"         value={customer.guarantorPhone} />
                    <Field label="Address · پتہ"           value={customer.guarantorAddress} wide />
                  </div>
                  {(customer.guarantorCnicFrontUrl || customer.guarantorCnicBackUrl) && (
                    <div className="agr-no-print" style={{ display: 'grid', gridTemplateColumns: customer.guarantorCnicFrontUrl && customer.guarantorCnicBackUrl ? '1fr 1fr' : '1fr', gap: 10 }}>
                      {customer.guarantorCnicFrontUrl && <DocImage src={customer.guarantorCnicFrontUrl} label="Guarantor 1 CNIC — Front" />}
                      {customer.guarantorCnicBackUrl  && <DocImage src={customer.guarantorCnicBackUrl}  label="Guarantor 1 CNIC — Back" />}
                    </div>
                  )}
                </div>
              )}

              {/* ── Guarantor 2 ── */}
              {hasGuarantor2 && (
                <div style={{ marginBottom: 14 }}>
                  <SectionHeader accent="#db2777">
                    Guarantor 2 · ضامن ۲{customer.guarantor2Relation ? ` — ${customer.guarantor2Relation}` : ''}
                  </SectionHeader>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px 14px', marginBottom: 10 }}>
                    <Field label="Full Name · نام"        value={customer.guarantor2Name} />
                    <Field label="CNIC · شناختی کارڈ"     value={customer.guarantor2Cnic} />
                    <Field label="Mobile · موبائل"         value={customer.guarantor2Phone} />
                    <Field label="Address · پتہ"           value={customer.guarantor2Address} wide />
                  </div>
                  {(customer.guarantor2CnicFrontUrl || customer.guarantor2CnicBackUrl) && (
                    <div className="agr-no-print" style={{ display: 'grid', gridTemplateColumns: customer.guarantor2CnicFrontUrl && customer.guarantor2CnicBackUrl ? '1fr 1fr' : '1fr', gap: 10 }}>
                      {customer.guarantor2CnicFrontUrl && <DocImage src={customer.guarantor2CnicFrontUrl} label="Guarantor 2 CNIC — Front" />}
                      {customer.guarantor2CnicBackUrl  && <DocImage src={customer.guarantor2CnicBackUrl}  label="Guarantor 2 CNIC — Back" />}
                    </div>
                  )}
                </div>
              )}

              {/* ── Terms ── */}
              <div style={{ marginBottom: 18, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 8.5, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 7 }}>
                  Terms &amp; Conditions · شرائط و ضوابط
                </div>
                <ol style={{ margin: 0, paddingLeft: 14, fontSize: 9, color: '#64748b', lineHeight: 1.85 }}>
                  <li>The customer agrees to pay installments on time on the due dates as agreed. &nbsp;·&nbsp; گاہک مقررہ تاریخ پر قسط ادا کرنے کا پابند ہے۔</li>
                  <li>Default exceeding 30 days makes guarantors jointly liable for all outstanding dues. &nbsp;·&nbsp; 30 دن تاخیر پر ضامن بھی ذمہ دار ہوں گے۔</li>
                  <li>The product remains property of <strong style={{ color: '#334155' }}>{shopName}</strong> until full payment is received. &nbsp;·&nbsp; مکمل ادائیگی تک سامان دکاندار کی ملکیت ہے۔</li>
                  <li>Any damage or loss of the product is the buyer's sole responsibility. &nbsp;·&nbsp; سامان کا نقصان گاہک کی ذمہ داری ہے۔</li>
                  <li>The blank cheque provided may be presented to the bank upon default without notice. &nbsp;·&nbsp; ڈیفالٹ پر چیک بینک میں جمع کرایا جا سکتا ہے۔</li>
                  <li>Early settlement is permitted; markup adjustment at {shopName}'s discretion. &nbsp;·&nbsp; قبل از وقت ادائیگی کی اجازت ہے۔</li>
                  <li>By signing, all parties confirm they have read and agreed to these terms. &nbsp;·&nbsp; دستخط سے تمام فریق شرائط سے متفق ہوتے ہیں۔</li>
                </ol>
              </div>

              {/* ── Signatures ── */}
              <div className="agr-sig-section">
                <SectionHeader accent="#059669">Authorized Signatures · دستخط</SectionHeader>
                <div style={{ display: 'flex', gap: 18, marginBottom: 20 }}>
                  <SigBlock label="Customer · گاہک" sub={customer.name} />
                  {hasGuarantor1 && <SigBlock label="Guarantor 1 · ضامن ۱" sub={customer.guarantorName ?? undefined} />}
                  {hasGuarantor2 && <SigBlock label="Guarantor 2 · ضامن ۲" sub={customer.guarantor2Name ?? undefined} />}
                  <SigBlock label="Seller / Staff · عملہ" />
                  <SigBlock label="Shop Owner · مالک" sub={shopName} />
                </div>
              </div>

              {/* ── Footer ── */}
              <div style={{ borderTop: '2px solid #f1f5f9', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 11, height: 11, borderRadius: 3, border: '2px solid #3b82f6' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 8.5, fontWeight: 700, color: '#0f172a' }}>{shopName}</div>
                    <div style={{ fontSize: 7.5, color: '#94a3b8' }}>Official Installment Agreement</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 7.5, color: '#94a3b8' }}>
                  <div>Ref: {REF}</div>
                  <div>Generated: {fmtDateTime(new Date())}</div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </>
  );
}
