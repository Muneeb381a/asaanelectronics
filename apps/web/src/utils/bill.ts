import QRCode from 'qrcode';

export interface BillData {
  shop: { shopName: string; phone: string; address?: string | null };
  customer: { name: string; phone: string; cnic?: string };
  product: string;
  totalAmount: string | number;
  downPayment: string | number;
  monthly: string | number;
  months: number;
  remaining: string | number;
  status: string;
  startDate: string;
  installmentId: string;
  invoiceNumber?: string | null;
}

function pkr(v: string | number) {
  return 'PKR ' + Number(v).toLocaleString('en-PK', { maximumFractionDigits: 0 });
}

function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
}

function buildSchedule(data: BillData): { month: number; due: string; amount: string; paid: boolean }[] {
  const start    = new Date(data.startDate);
  const monthly  = Number(data.monthly);
  const total    = Number(data.totalAmount);
  const remaining = Number(data.remaining);
  const paid     = total - remaining;
  const downPmt  = Number(data.downPayment);
  const installsPaid = downPmt >= remaining ? data.months : Math.floor((paid - downPmt) / monthly);

  return Array.from({ length: data.months }, (_, i) => ({
    month:  i + 1,
    due:    fmtDate(addMonths(start, i + 1)),
    amount: pkr(monthly),
    paid:   i < installsPaid,
  }));
}

export async function openBill(data: BillData) {
  const invoiceNo  = data.invoiceNumber ?? `INV-${new Date().getFullYear()}-${data.installmentId.slice(0, 6).toUpperCase()}`;
  const printDate  = new Date().toLocaleDateString('en-PK', { day: '2-digit', month: 'long', year: 'numeric' });
  const startDate  = fmtDate(new Date(data.startDate));
  const endDate    = fmtDate(addMonths(new Date(data.startDate), data.months));
  const paid       = Number(data.totalAmount) - Number(data.remaining);
  const schedule   = buildSchedule(data);

  const qrPayload  = [
    `INV:${invoiceNo}`,
    `SHOP:${data.shop.shopName}`,
    `CUST:${data.customer.name}`,
    `PROD:${data.product}`,
    `AMT:${Number(data.totalAmount).toFixed(0)}`,
    `REM:${Number(data.remaining).toFixed(0)}`,
    `ID:${data.installmentId.slice(0, 8).toUpperCase()}`,
  ].join('\n');

  const qrDataUrl = await QRCode.toDataURL(qrPayload, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 120,
    color: { dark: '#0f172a', light: '#ffffff' },
  });

  const scheduleRows = schedule.map((r) => `
    <tr>
      <td style="padding:7px 12px;color:#374151;border-bottom:1px solid #f3f4f6">${r.month}</td>
      <td style="padding:7px 12px;color:#374151;border-bottom:1px solid #f3f4f6">${r.due}</td>
      <td style="padding:7px 12px;text-align:right;border-bottom:1px solid #f3f4f6;font-weight:600;color:#374151">${r.amount}</td>
      <td style="padding:7px 12px;text-align:center;border-bottom:1px solid #f3f4f6">
        ${r.paid
          ? '<span style="background:#d1fae5;color:#065f46;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:700">PAID</span>'
          : '<span style="background:#fef3c7;color:#92400e;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:700">PENDING</span>'
        }
      </td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>${invoiceNo} — ${data.shop.shopName}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;display:flex;justify-content:center;padding:40px 20px}
  .page{background:#fff;width:720px;border-radius:6px;box-shadow:0 4px 24px rgba(0,0,0,.12);overflow:hidden}

  /* ── Header ── */
  .hdr{background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);padding:32px 40px 0;position:relative;overflow:hidden}
  .hdr-circle1{position:absolute;top:-40px;right:-40px;width:160px;height:160px;border-radius:50%;background:rgba(255,255,255,.04)}
  .hdr-circle2{position:absolute;top:16px;right:80px;width:90px;height:90px;border-radius:50%;background:rgba(255,255,255,.04)}
  .hdr-top{display:flex;justify-content:space-between;align-items:flex-start;position:relative}
  .shop-name{font-size:24px;font-weight:900;color:#fff;letter-spacing:.3px;line-height:1}
  .shop-meta{font-size:11px;color:#93c5fd;margin-top:6px;line-height:1.7}
  .inv-badge{text-align:right}
  .inv-badge h2{font-size:28px;font-weight:900;color:#60a5fa;letter-spacing:-1px}
  .inv-no{font-size:13px;font-weight:700;color:#fff;margin-top:4px;letter-spacing:.5px}
  .inv-date{font-size:11px;color:#64748b;margin-top:3px}
  .accent-bar{height:4px;background:linear-gradient(90deg,#f59e0b,#3b82f6,#f59e0b);margin:20px -40px 0}

  /* ── Body ── */
  .body{padding:32px 40px;font-size:13px;color:#374151}
  .section{margin-bottom:28px}
  .section-title{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1.2px;color:#94a3b8;margin-bottom:12px;display:flex;align-items:center;gap:8px}
  .section-title::after{content:'';flex:1;height:1px;background:#f1f5f9}

  /* ── Info grid ── */
  .info-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
  .info-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px}
  .info-box label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#94a3b8;display:block;margin-bottom:4px}
  .info-box p{font-size:13px;font-weight:600;color:#0f172a;line-height:1.3}
  .info-box small{font-size:11px;color:#64748b}

  /* ── QR + Totals strip ── */
  .summary-strip{display:flex;gap:24px;align-items:flex-start;margin-bottom:28px}
  .qr-block{text-align:center;flex-shrink:0}
  .qr-block img{border:2px solid #e2e8f0;border-radius:8px;display:block}
  .qr-label{font-size:8px;color:#94a3b8;margin-top:5px;font-weight:600;text-transform:uppercase;letter-spacing:.5px}
  .totals-box{flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px}
  .total-row{display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#374151;border-bottom:1px solid #f1f5f9}
  .total-row:last-child{border:none}
  .total-row.grand{font-size:16px;font-weight:800;color:#0f172a;border-top:2px solid #1d4ed8;margin-top:6px;padding-top:10px}
  .total-row.paid-row{color:#059669;font-weight:600}
  .total-row.rem-row{color:#b45309;font-weight:600}

  /* ── Status badge ── */
  .status-badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:.3px}
  .status-ACTIVE{background:#d1fae5;color:#065f46}
  .status-COMPLETED{background:#dbeafe;color:#1e40af}
  .status-DEFAULTED{background:#fee2e2;color:#991b1b}
  .status-CANCELLED,.status-CLOSED{background:#f1f5f9;color:#64748b}
  .status-PENDING{background:#fef3c7;color:#92400e}

  /* ── Schedule table ── */
  table{width:100%;border-collapse:collapse;font-size:12px}
  thead tr{background:#0f172a}
  thead th{padding:9px 12px;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;text-align:left}
  .sched-scroll{max-height:240px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:8px}

  /* ── Legal footer ── */
  .legal{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 18px;margin-bottom:24px}
  .legal-title{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:8px}
  .legal ol{padding-left:16px;font-size:10px;color:#64748b;line-height:1.9}
  .legal strong{color:#334155}

  /* ── Page footer ── */
  .page-footer{border-top:2px solid #f1f5f9;padding:16px 40px;display:flex;justify-content:space-between;align-items:center;background:#f8fafc}
  .pf-brand{font-size:12px;font-weight:700;color:#0f172a}
  .pf-meta{font-size:10px;color:#94a3b8;text-align:right;line-height:1.7}

  @media print{
    body{background:#fff;padding:0}
    .page{box-shadow:none;border-radius:0;width:100%}
    .sched-scroll{max-height:none;overflow:visible}
  }
</style>
</head>
<body>
<div class="page">

  <!-- ══ HEADER ══ -->
  <div class="hdr">
    <div class="hdr-circle1"></div>
    <div class="hdr-circle2"></div>
    <div class="hdr-top">
      <div>
        <div class="shop-name">${data.shop.shopName}</div>
        <div class="shop-meta">
          ${data.shop.phone}<br/>
          ${data.shop.address ?? ''}
        </div>
      </div>
      <div class="inv-badge">
        <h2>INVOICE</h2>
        <div class="inv-no">${invoiceNo}</div>
        <div class="inv-date">Printed: ${printDate}</div>
      </div>
    </div>
    <div class="accent-bar"></div>
  </div>

  <div class="body">

    <!-- ══ CUSTOMER & PLAN ══ -->
    <div class="section">
      <div class="section-title">Customer &amp; Installment Details</div>
      <div class="info-grid">
        <div class="info-box">
          <label>Customer</label>
          <p>${data.customer.name}</p>
          <small>${data.customer.phone}</small>
        </div>
        <div class="info-box">
          <label>Product</label>
          <p>${data.product}</p>
        </div>
        <div class="info-box">
          <label>Status</label>
          <p><span class="status-badge status-${data.status}">${data.status}</span></p>
        </div>
        <div class="info-box">
          <label>Start Date</label>
          <p>${startDate}</p>
        </div>
        <div class="info-box">
          <label>End Date</label>
          <p>${endDate}</p>
        </div>
        <div class="info-box">
          <label>Duration</label>
          <p>${data.months} months</p>
          <small>${pkr(data.monthly)} / month</small>
        </div>
      </div>
    </div>

    <!-- ══ QR + TOTALS ══ -->
    <div class="summary-strip">
      <div class="qr-block">
        <img src="${qrDataUrl}" width="110" height="110" alt="QR"/>
        <div class="qr-label">Scan to verify</div>
      </div>
      <div class="totals-box">
        <div class="total-row">
          <span>Total Product Price</span>
          <span>${pkr(data.totalAmount)}</span>
        </div>
        <div class="total-row">
          <span>Down Payment</span>
          <span>${pkr(data.downPayment)}</span>
        </div>
        <div class="total-row">
          <span>Monthly × ${data.months} months</span>
          <span>${pkr(data.monthly)} / mo</span>
        </div>
        <div class="total-row paid-row">
          <span>Total Paid</span>
          <span>${pkr(paid)}</span>
        </div>
        <div class="total-row rem-row">
          <span>Remaining Balance</span>
          <span>${pkr(data.remaining)}</span>
        </div>
        <div class="total-row grand">
          <span>Total Contract Value</span>
          <span>${pkr(data.totalAmount)}</span>
        </div>
      </div>
    </div>

    <!-- ══ PAYMENT SCHEDULE ══ -->
    <div class="section">
      <div class="section-title">Monthly Payment Schedule</div>
      <div class="sched-scroll">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Due Date</th>
              <th style="text-align:right">Amount</th>
              <th style="text-align:center">Status</th>
            </tr>
          </thead>
          <tbody>${scheduleRows}</tbody>
        </table>
      </div>
    </div>

    <!-- ══ LEGAL FOOTER ══ -->
    <div class="legal">
      <div class="legal-title">Terms &amp; Conditions / قواعد و شرائط</div>
      <ol>
        <li>The customer <strong>${data.customer.name}</strong> agrees to pay <strong>${pkr(data.monthly)}</strong> on or before the due date each month without delay.</li>
        <li>The product <strong>"${data.product}"</strong> remains the sole property of <strong>${data.shop.shopName}</strong> until all installments are fully paid.</li>
        <li>In case of default exceeding 30 days, legal recovery proceedings may be initiated and all guarantors shall be jointly liable for the outstanding amount of <strong>${pkr(data.remaining)}</strong>.</li>
        <li>Any damage, loss, or theft of the product while installments are pending is the sole responsibility of the buyer.</li>
        <li>Early settlement is permitted at any time; markup adjustment is at the discretion of <strong>${data.shop.shopName}</strong>.</li>
        <li>This invoice (<strong>${invoiceNo}</strong>) is a legally binding financial document. Scan the QR code to verify authenticity.</li>
      </ol>
    </div>

  </div>

  <!-- ══ PAGE FOOTER ══ -->
  <div class="page-footer">
    <div>
      <div class="pf-brand">${data.shop.shopName}</div>
      <div style="font-size:10px;color:#94a3b8">Thank you for your business · ${data.shop.phone}</div>
    </div>
    <div class="pf-meta">
      <div>Invoice: <strong style="color:#0f172a">${invoiceNo}</strong></div>
      <div>Generated: ${new Date().toLocaleString('en-PK')}</div>
      <div>Ref ID: ${data.installmentId.slice(0, 8).toUpperCase()}</div>
    </div>
  </div>

</div>
<script>window.onload = () => window.print();</script>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=820,height=960');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
