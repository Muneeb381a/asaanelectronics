import { fmtDate, fmtDateTime } from './dateFormat.ts';

export interface InstallmentReceiptData {
  shopName: string;
  shopPhone?: string | null;
  customerName: string;
  customerPhone?: string | null;
  productName: string;
  invoiceNumber?: string | null;
  amountPaid: number;
  remaining: number;
  monthly: number;
  method: string;
  paidOn: string;
  note?: string | null;
  paymentFrequency?: string | null;
  completed?: boolean;
  // Installment progress
  paidInstallments?: number;
  totalInstallments?: number;
  currentMonth?: number;
  periodDueDate?: string;
  periodEndDate?: string; // for daily: last period covered by this payment (range end)
  daysLate?: number;
  daysAdvance?: number; // set when payment is made before the first period's due date
}

export interface CashSaleReceiptData {
  shopName: string;
  shopPhone?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  productName: string;
  quantity: number;
  amount: number;
  method: string;
  imeiNumber?: string | null;
  note?: string | null;
  soldAt: string;
}

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash', BANK: 'Bank Transfer', JAZZCASH: 'JazzCash', EASYPAISA: 'EasyPaisa', OTHER: 'Other',
};

function mLabel(m: string) { return METHOD_LABELS[m] ?? m; }

function pkr(n: number) {
  return 'PKR ' + n.toLocaleString('en-PK', { maximumFractionDigits: 0 });
}

// Bill-style CSS matching bill.ts visual design
const BILL_CSS = `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;padding:20px;display:flex;justify-content:center}
.inv{background:#fff;width:560px;padding:13px 16px;font-size:10.5px;color:#374151;border:1px solid #e2e8f0}
.hdr{display:flex;align-items:center;gap:8px;padding:9px 11px 7px;background:linear-gradient(135deg,#0f172a,#1e3a5f);border-radius:4px 4px 0 0;margin:-13px -16px 9px}
.ic{background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:4px 6px;overflow:hidden}
.il{display:block;font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;margin-bottom:1px}
.iv{display:block;font-size:10.5px;font-weight:600;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.is{display:block;font-size:9px;color:#64748b}
.ac{background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:5px 7px;text-align:center}
.ac.hl{background:#1d4ed8;border-color:#1d4ed8}
.ac.rm{background:#fffbeb;border-color:#fcd34d}
.al{display:block;font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:#94a3b8;margin-bottom:1px}
.av{display:block;font-size:11.5px;font-weight:800;color:#0f172a}
.ac.hl .al{color:rgba(255,255,255,.65)}
.ac.hl .av{color:#fff}
.ac.rm .al{color:#b45309}
.ac.rm .av{color:#92400e}
@media print{
  @page{size:A5 portrait;margin:5mm 7mm}
  body{background:#fff;padding:0}
  .inv{border:none;width:100%}
}
`;

// Thermal-style CSS for cash sale (small receipt)
const THERMAL_CSS = `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Courier New',monospace;font-size:13px;color:#000;padding:16px;max-width:320px;margin:0 auto}
.shop{font-size:17px;font-weight:bold;text-align:center;margin-bottom:2px}
.sub{font-size:11px;text-align:center;color:#555;margin-bottom:4px}
hr{border:none;border-top:1px dashed #000;margin:8px 0}
.row{display:flex;justify-content:space-between;padding:2px 0;gap:8px}
.lbl{color:#555;white-space:nowrap}
.val{font-weight:bold;text-align:right;overflow-wrap:anywhere}
.big .val{font-size:15px}
.badge{text-align:center;background:#000;color:#fff;font-size:11px;letter-spacing:1px;padding:3px 8px;margin:6px 0}
.foot{text-align:center;font-size:11px;color:#555;margin-top:10px}
@media print{body{padding:4px}}
`;

function openPrint(content: string, width = 380, height = 700) {
  const win = window.open('', '_blank', `width=${width},height=${height},scrollbars=no`);
  if (!win) { alert('Popups blocked — please allow popups to print.'); return; }
  win.document.write(content);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
    win.onafterprint = () => win.close();
  }, 300);
}

export function printInstallmentReceipt(d: InstallmentReceiptData) {
  const isDaily = d.paymentFrequency === 'daily';
  const freq = isDaily ? 'Daily' : 'Monthly';
  const periodLabel = isDaily ? 'days' : 'months';
  const invoiceNo = d.invoiceNumber ?? '';
  const printDate = fmtDate(d.paidOn);

  const hasProg = d.paidInstallments !== undefined && d.totalInstallments !== undefined;
  const paidInst = d.paidInstallments ?? 0;
  const totalInst = d.totalInstallments ?? 0;
  const pendingInst = totalInst - paidInst;
  const curMonth = d.currentMonth ?? paidInst;
  const pct = totalInst > 0 ? Math.round((paidInst / totalInst) * 100) : 0;

  const isMultiPeriod = isDaily && d.periodEndDate && d.periodEndDate !== d.periodDueDate;
  const periodRangeLabel = isMultiPeriod
    ? `${fmtDate(d.periodDueDate!)} – ${fmtDate(d.periodEndDate!)}`
    : d.periodDueDate ? fmtDate(d.periodDueDate) : '';
  const statusBadge = (d.daysLate ?? 0) > 0
    ? `<div style="font-size:7px;color:#dc2626;font-weight:700">${d.daysLate}d late</div>`
    : (d.daysAdvance ?? 0) > 0
      ? `<div style="font-size:6.5px;color:#7c3aed;font-weight:700">📌 ${d.daysAdvance}d advance</div>`
      : `<div style="font-size:6.5px;color:#059669;font-weight:600">✓ on time</div>`;
  const periodDueInfo = d.periodDueDate
    ? `<div style="font-size:${isMultiPeriod ? '6' : '7'}px;color:#3b82f6;font-weight:600">Qist: ${periodRangeLabel}</div>` +
      statusBadge
    : `<div style="font-size:7.5px;color:#3b82f6">installment</div>`;

  const progressSection = hasProg ? `
    <div style="border:1px solid #e2e8f0;border-radius:5px;padding:8px 10px;margin-bottom:6px">
      <div style="font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;margin-bottom:6px">
        Installment Progress · اقساط کی تفصیل
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-bottom:8px">
        <div style="text-align:center;background:#d1fae5;border:1px solid #6ee7b7;border-radius:5px;padding:5px 3px">
          <div style="font-size:7px;color:#065f46;font-weight:700;letter-spacing:.3px">PAID · ادا شدہ</div>
          <div style="font-size:18px;font-weight:800;color:#065f46;line-height:1.2">${paidInst}</div>
          <div style="font-size:7.5px;color:#059669">of ${totalInst}</div>
        </div>
        <div style="text-align:center;background:#fef3c7;border:1px solid #fcd34d;border-radius:5px;padding:5px 3px">
          <div style="font-size:7px;color:#92400e;font-weight:700;letter-spacing:.3px">PENDING · باقی</div>
          <div style="font-size:18px;font-weight:800;color:#92400e;line-height:1.2">${pendingInst}</div>
          <div style="font-size:7.5px;color:#b45309">${periodLabel} left</div>
        </div>
        <div style="text-align:center;background:#dbeafe;border:1px solid #93c5fd;border-radius:5px;padding:5px 3px">
          <div style="font-size:7px;color:#1e40af;font-weight:700;letter-spacing:.3px">${isDaily ? 'DAY' : 'MONTH'} #</div>
          <div style="font-size:18px;font-weight:800;color:#1e40af;line-height:1.2">${curMonth}</div>
          ${periodDueInfo}
        </div>
      </div>
      <div style="background:#f1f5f9;border-radius:20px;height:7px;overflow:hidden">
        <div style="background:linear-gradient(90deg,#10b981,#059669);height:100%;width:${pct}%;border-radius:20px"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:3px">
        <span style="font-size:8px;color:#059669;font-weight:600">${paidInst} paid (${pct}%)</span>
        <span style="font-size:8px;color:#94a3b8">${totalInst} total ${periodLabel}</span>
      </div>
      ${d.periodDueDate ? `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:7px;border-top:1px dashed #e2e8f0;padding-top:6px">
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:4px;padding:4px 6px">
          <div style="font-size:6.5px;font-weight:700;text-transform:uppercase;letter-spacing:.3px;color:#1e40af;margin-bottom:1px">📅 Qist ki tarikh</div>
          <div style="font-size:${isMultiPeriod ? '8' : '9'}px;font-weight:700;color:#1e3a8a">${periodRangeLabel}</div>
          ${(d.daysLate ?? 0) > 0
            ? `<div style="font-size:7px;color:#dc2626;font-weight:700">⚠️ ${d.daysLate} din late</div>`
            : (d.daysAdvance ?? 0) > 0
              ? `<div style="font-size:7px;color:#7c3aed;font-weight:700">📌 ${d.daysAdvance} din advance</div>`
              : `<div style="font-size:7px;color:#059669;font-weight:600">✓ On time</div>`}
        </div>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:4px;padding:4px 6px">
          <div style="font-size:6.5px;font-weight:700;text-transform:uppercase;letter-spacing:.3px;color:#065f46;margin-bottom:1px">📆 Payment ki tarikh</div>
          <div style="font-size:9px;font-weight:700;color:#064e3b">${printDate}</div>
        </div>
      </div>` : ''}
    </div>` : '';

  const completedBadge = d.completed ? `
    <div style="text-align:center;background:#d1fae5;border:1px solid #6ee7b7;border-radius:5px;padding:8px;margin-bottom:6px;color:#065f46;font-weight:700;font-size:11px;letter-spacing:.5px">
      ✓ INSTALLMENT FULLY PAID · مکمل ادا
    </div>` : '';

  const noteLine = d.note ? `
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:4px 8px;margin-bottom:6px;font-size:9.5px;color:#374151">
      <strong>Note:</strong> ${d.note}
    </div>` : '';

  const html = `<!DOCTYPE html>
<html lang="ur" dir="ltr">
<head>
<meta charset="UTF-8"/>
<title>Payment Receipt</title>
<style>${BILL_CSS}</style>
</head>
<body>
<div class="inv">
  <!-- HEADER -->
  <div class="hdr">
    <div style="flex:1;min-width:0">
      <div style="font-size:14px;font-weight:900;color:#fff;line-height:1">${d.shopName}</div>
      ${d.shopPhone ? `<div style="font-size:9.5px;color:#93c5fd;margin-top:2px">${d.shopPhone}</div>` : ''}
    </div>
    <div style="text-align:right;flex-shrink:0">
      <div style="font-size:12px;font-weight:900;color:#60a5fa;letter-spacing:.3px">PAYMENT RECEIPT</div>
      ${invoiceNo ? `<div style="font-size:11px;font-weight:700;color:#fff;margin-top:1px">${invoiceNo}</div>` : ''}
      <div style="font-size:9px;color:#94a3b8;margin-top:2px">${printDate}</div>
    </div>
  </div>

  <!-- CUSTOMER / PRODUCT -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:6px">
    <div class="ic">
      <span class="il">Customer · گاہک</span>
      <span class="iv">${d.customerName}</span>
      ${d.customerPhone ? `<span class="is">${d.customerPhone}</span>` : ''}
    </div>
    <div class="ic">
      <span class="il">Product · مصنوعہ</span>
      <span class="iv">${d.productName}</span>
      <span class="is">${freq} · ${pkr(d.monthly)}</span>
    </div>
  </div>

  <!-- AMOUNTS STRIP -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-bottom:6px">
    <div class="ac hl">
      <span class="al">Amount Paid · ادا کی</span>
      <span class="av">${pkr(d.amountPaid)}</span>
    </div>
    <div class="ac">
      <span class="al">Method · طریقہ</span>
      <span class="av" style="font-size:10px">${mLabel(d.method)}</span>
    </div>
    <div class="ac rm">
      <span class="al">Remaining · باقی</span>
      <span class="av">${pkr(d.remaining)}</span>
    </div>
  </div>

  ${progressSection}
  ${completedBadge}
  ${noteLine}

  <!-- FOOTER -->
  <div style="margin-top:6px;padding-top:5px;border-top:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center">
    <div style="font-size:9px;color:#94a3b8">${d.shopName}${d.shopPhone ? ` · ${d.shopPhone}` : ''}</div>
    <div style="font-size:9px;color:#94a3b8">شکریہ · Thank you</div>
  </div>
</div>
<script>window.onload = () => window.print();</script>
</body>
</html>`;

  openPrint(html, 760, 700);
}

export function printCashSaleReceipt(d: CashSaleReceiptData) {
  const body = `
    <div class="shop">${d.shopName}</div>
    ${d.shopPhone ? `<div class="sub">${d.shopPhone}</div>` : ''}
    <div class="sub">Cash Sale Receipt</div>
    <hr/>
    <div class="row"><span class="lbl">Date</span><span class="val">${fmtDateTime(d.soldAt)}</span></div>
    <div class="row"><span class="lbl">Customer</span><span class="val">${d.customerName ?? 'Walk-in'}</span></div>
    ${d.customerPhone ? `<div class="row"><span class="lbl">Phone</span><span class="val">${d.customerPhone}</span></div>` : ''}
    <div class="row"><span class="lbl">Product</span><span class="val">${d.productName}</span></div>
    ${(d.quantity ?? 1) > 1 ? `<div class="row"><span class="lbl">Quantity</span><span class="val">${d.quantity}</span></div>` : ''}
    ${d.imeiNumber ? `<div class="row"><span class="lbl">IMEI</span><span class="val">${d.imeiNumber}</span></div>` : ''}
    <hr/>
    <div class="row big"><span class="lbl">Amount</span><span class="val">${pkr(d.amount)}</span></div>
    <div class="row"><span class="lbl">Method</span><span class="val">${mLabel(d.method)}</span></div>
    ${d.note ? `<div class="row"><span class="lbl">Note</span><span class="val">${d.note}</span></div>` : ''}
    <hr/>
    <div class="foot">Thank you for your purchase!</div>
  `;
  const content = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Cash Sale</title><style>${THERMAL_CSS}</style></head><body>${body}</body></html>`;
  openPrint(content);
}

export function installmentWhatsappUrl(d: InstallmentReceiptData): string {
  const isDaily = d.paymentFrequency === 'daily';
  const hasProg = d.paidInstallments !== undefined && d.totalInstallments !== undefined;
  const pendingInst = (d.totalInstallments ?? 0) - (d.paidInstallments ?? 0);

  // For daily installments a single payment may cover multiple periods (late payment)
  const isMultiPeriod = isDaily && d.periodEndDate && d.periodEndDate !== d.periodDueDate;
  const qistDateLabel = d.periodDueDate
    ? isMultiPeriod
      ? `${fmtDate(d.periodDueDate)} – ${fmtDate(d.periodEndDate!)}`
      : fmtDate(d.periodDueDate)
    : '';

  // e.g. "18 – 21 / 30" for multi-period, "18 / 30" for single
  const dinLabel = hasProg
    ? isMultiPeriod
      ? `${d.currentMonth} – ${d.paidInstallments} / ${d.totalInstallments}`
      : `${d.currentMonth ?? d.paidInstallments} / ${d.totalInstallments}`
    : '';

  // Build the late / on-time / advance status line
  let lateStatus = '';
  if (hasProg && d.periodDueDate) {
    lateStatus = (d.daysLate ?? 0) > 0
      ? `⚠️ ${d.daysLate} din late`
      : (d.daysAdvance ?? 0) > 0
        ? `📌 ${d.daysAdvance} din advance`
        : `✅ On time`;
  }

  const lines = [
    `*Payment Receipt — ${d.shopName}*`,
    `━━━━━━━━━━━━━━━━━━━`,
    d.invoiceNumber ? `Invoice: ${d.invoiceNumber}` : '',
    `Customer: ${d.customerName}`,
    d.customerPhone ? `Phone: ${d.customerPhone}` : '',
    `Product: ${d.productName}`,
    `━━━━━━━━━━━━━━━━━━━`,
    `Amount Paid: *${pkr(d.amountPaid)}*`,
    `Method: ${mLabel(d.method)}`,
    hasProg ? `${isDaily ? 'Din' : 'Month'} #: *${dinLabel}*` : '',
    `━━━━━━━━━━━━━━━━━━━`,
    hasProg && qistDateLabel
      ? `📅 Qist ki tarikh:   ${qistDateLabel}`
      : '',
    `📆 Payment ki tarikh: ${fmtDate(d.paidOn)}`,
    lateStatus,
    `━━━━━━━━━━━━━━━━━━━`,
    hasProg ? `✅ Ada: ${d.paidInstallments}  |  ⏳ Baqi: ${pendingInst}` : '',
    d.completed
      ? `🎉 Mubarak! Tamam qisten ada ho gayin.`
      : `Remaining: ${pkr(d.remaining)}`,
    d.note ? `Note: ${d.note}` : '',
    `━━━━━━━━━━━━━━━━━━━`,
    `Shukriya! 🙏`,
  ].filter(Boolean).join('\n');
  return `https://wa.me/?text=${encodeURIComponent(lines)}`;
}

export interface SinglePaymentReceiptData {
  shopName: string;
  shopPhone?: string | null;
  customerName: string;
  customerPhone?: string | null;
  customerPhotoUrl?: string | null;
  productName: string;
  invoiceNumber?: string | null;
  receiptNumber?: string | null;
  amountPaid: number;
  method: string;
  paidOn: string;
  note?: string | null;
  collectorName?: string | null;
  periodNum?: number;
  paymentFrequency?: string | null;
  periodDueDate?: Date | null;
  daysLate?: number;
  monthly?: number;
  totalAmount?: number;
  remaining?: number;
  totalInstallments?: number;
  paidInstallments?: number;
}

export function openSinglePaymentReceipt(d: SinglePaymentReceiptData) {
  const isDaily   = d.paymentFrequency === 'daily';
  const freq      = isDaily ? 'Day' : 'Month';
  const paidOnDate = new Date(d.paidOn);
  const dateStr   = paidOnDate.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr   = paidOnDate.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true });
  const isLate    = (d.daysLate ?? 0) > 0;

  const hasProg    = (d.totalInstallments ?? 0) > 0;
  const totalInst  = d.totalInstallments ?? 0;
  const paidInst   = d.paidInstallments ?? d.periodNum ?? 0;
  const pendingInst = Math.max(0, totalInst - paidInst);
  const pct        = totalInst > 0 ? Math.round((paidInst / totalInst) * 100) : 0;

  function numFmt(n: number) { return n.toLocaleString('en-PK', { maximumFractionDigits: 0 }); }

  const initials  = d.customerName.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const avatarPalette = ['#2563eb','#0891b2','#059669','#d97706','#dc2626','#7c3aed','#0f766e'];
  const avatarBg  = avatarPalette[d.customerName.charCodeAt(0) % avatarPalette.length];

  const METHOD_ICONS: Record<string,string> = { CASH:'💵', BANK:'🏦', JAZZCASH:'📱', EASYPAISA:'💚', OTHER:'💳' };
  const methodIcon = METHOD_ICONS[d.method] ?? '💳';

  const statusChip = isLate
    ? `<span style="display:inline-flex;align-items:center;gap:3px;padding:3px 10px;border-radius:20px;background:#fee2e2;border:1px solid #fca5a5;color:#991b1b;font-size:9px;font-weight:700">⚠ ${d.daysLate}d Late</span>`
    : `<span style="display:inline-flex;align-items:center;gap:3px;padding:3px 10px;border-radius:20px;background:#dcfce7;border:1px solid #86efac;color:#166534;font-size:9px;font-weight:700">✓ On Time</span>`;

  const progressSection = hasProg ? `
  <div style="margin:0 18px;border-top:1px solid #f1f5f9;padding:7px 0">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
      <div style="display:flex;align-items:baseline;gap:4px">
        <span style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#94a3b8">${freq}</span>
        <span style="font-size:18px;font-weight:900;color:#1d4ed8;line-height:1">${paidInst}</span>
        <span style="font-size:10px;color:#cbd5e1;font-weight:600">/ ${totalInst}</span>
        ${d.periodDueDate ? `<span style="font-size:8px;color:#64748b">· Due ${fmtDate(d.periodDueDate)}</span>` : ''}
      </div>
      <div style="text-align:right">
        <span style="font-size:8px;font-weight:700;color:#2563eb">${pct}% · ${paidInst} paid · ${pendingInst} left</span>
      </div>
    </div>
    <div style="background:#e2e8f0;border-radius:6px;height:5px;overflow:hidden">
      <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#3b82f6,#1d4ed8);border-radius:6px"></div>
    </div>
  </div>` : '';

  const extraRow = (d.collectorName || d.note || d.monthly) ? `
  <div style="margin:0 18px;border-top:1px solid #f1f5f9;padding:6px 0;display:flex;gap:12px;flex-wrap:wrap">
    ${d.monthly ? `<div style="font-size:8.5px;color:#374151"><span style="color:#94a3b8">${isDaily ? 'Daily' : 'Monthly'} Qist: </span><span style="font-weight:700">${pkr(d.monthly)}</span></div>` : ''}
    ${d.collectorName ? `<div style="font-size:8.5px;color:#374151"><span style="color:#94a3b8">Collected by: </span><span style="font-weight:700;color:#7c3aed">${d.collectorName}</span></div>` : ''}
    ${d.note ? `<div style="font-size:8.5px;color:#374151;width:100%"><span style="color:#94a3b8">Note: </span><span style="font-weight:600">${d.note}</span></div>` : ''}
  </div>` : '';

  const css = `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',system-ui,Arial,sans-serif;background:#dde3f0;padding:20px;display:flex;justify-content:center;align-items:flex-start}
.card{background:#fff;width:520px;border-radius:12px;overflow:hidden;box-shadow:0 4px 28px rgba(0,0,0,.13)}
@media print{
  @page{size:210mm 148mm;margin:4mm 6mm}
  body{background:#fff;padding:0;display:block}
  .card{border-radius:0;box-shadow:none;width:100%;font-size:90%}
}`;

  const html = `<!DOCTYPE html>
<html lang="ur" dir="ltr">
<head><meta charset="utf-8"/><title>Payment Receipt</title><style>${css}</style></head>
<body>
<div class="card">

  <!-- TOP ACCENT -->
  <div style="height:4px;background:linear-gradient(90deg,#1e3a8a 0%,#2563eb 55%,#60a5fa 100%)"></div>

  <!-- HEADER -->
  <div style="padding:9px 18px 8px;display:flex;justify-content:space-between;align-items:flex-start">
    <div>
      <div style="font-size:14px;font-weight:900;color:#0f172a;letter-spacing:-.3px;line-height:1">${d.shopName}</div>
      ${d.shopPhone ? `<div style="font-size:8.5px;color:#64748b;margin-top:2px">${d.shopPhone}</div>` : ''}
    </div>
    <div style="text-align:right">
      <div style="font-size:7px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#2563eb">Payment Receipt</div>
      ${d.receiptNumber ? `<div style="font-size:8px;font-family:monospace;color:#94a3b8;margin-top:2px">${d.receiptNumber}</div>` : ''}
      <div style="font-size:8.5px;font-weight:600;color:#475569;margin-top:2px">${dateStr}</div>
      <div style="font-size:7.5px;color:#94a3b8;margin-top:1px">${timeStr}</div>
    </div>
  </div>

  <!-- CUSTOMER -->
  <div style="margin:0 18px;border-top:1px solid #f1f5f9;padding:7px 0;display:flex;align-items:center;gap:10px">
    <div style="width:36px;height:36px;border-radius:50%;background:${avatarBg};flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#fff;letter-spacing:-.5px">${initials}</div>
    <div style="min-width:0;flex:1">
      <div style="font-size:6.5px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#94a3b8;margin-bottom:1px">Customer · گاہک</div>
      <div style="font-size:13px;font-weight:800;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.2">${d.customerName}</div>
      ${d.customerPhone ? `<div style="font-size:8.5px;color:#64748b;margin-top:1px">${d.customerPhone}</div>` : ''}
    </div>
    ${(d.remaining ?? 0) <= 0 ? `<div style="flex-shrink:0;background:#dcfce7;border:1px solid #86efac;border-radius:7px;padding:3px 9px;text-align:center"><div style="font-size:6.5px;font-weight:700;color:#166534;letter-spacing:.5px;line-height:1.4">FULLY PAID ✓</div></div>` : ''}
  </div>

  <!-- AMOUNT HERO -->
  <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a8a 100%);padding:11px 18px 10px;text-align:center">
    <div style="font-size:6.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,.35);margin-bottom:4px">Amount Paid · ادا کردہ رقم</div>
    <div style="line-height:1;margin-bottom:8px">
      <span style="font-size:12px;font-weight:600;color:rgba(255,255,255,.5);vertical-align:top;margin-top:4px;display:inline-block;margin-right:2px">PKR</span>
      <span style="font-size:36px;font-weight:900;color:#fff;letter-spacing:-1.5px">${numFmt(d.amountPaid)}</span>
    </div>
    <div style="display:flex;justify-content:center;align-items:center;gap:7px">
      <span style="display:inline-flex;align-items:center;gap:4px;padding:3px 11px;border-radius:20px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.18);color:rgba(255,255,255,.9);font-size:9px;font-weight:600">${methodIcon} ${mLabel(d.method)}</span>
      ${d.periodDueDate !== undefined || isLate ? statusChip : ''}
    </div>
  </div>

  <!-- INFO ROW: product + balance -->
  <div style="margin:0 18px;border-top:1px solid #f1f5f9;padding:7px 0;display:grid;grid-template-columns:1fr 1fr;gap:4px">
    <div>
      <div style="font-size:6.5px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:#94a3b8;margin-bottom:2px">Product · مصنوعہ</div>
      <div style="font-size:10px;font-weight:700;color:#0f172a;line-height:1.3">${d.productName}</div>
      ${d.invoiceNumber ? `<div style="font-size:7.5px;font-family:monospace;color:#94a3b8;margin-top:1px">${d.invoiceNumber}</div>` : ''}
    </div>
    <div style="text-align:right">
      <div style="font-size:6.5px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:#94a3b8;margin-bottom:2px">Balance · باقی رقم</div>
      <div style="font-size:12px;font-weight:800;color:${(d.remaining ?? 0) <= 0 ? '#16a34a' : '#d97706'}">${pkr(d.remaining ?? 0)}</div>
      ${d.totalAmount ? `<div style="font-size:7.5px;color:#94a3b8;margin-top:1px">of ${pkr(d.totalAmount)}</div>` : ''}
    </div>
  </div>

  <!-- INSTALLMENT PROGRESS -->
  ${progressSection}

  <!-- EXTRA INFO (qist/collector/note) -->
  ${extraRow}

  <!-- FOOTER -->
  <div style="margin:0;border-top:2px dashed #e2e8f0;padding:7px 18px;display:flex;justify-content:space-between;align-items:center;background:#fafbff">
    <div>
      <div style="font-size:9.5px;font-weight:800;color:#1e3a8a">${d.shopName}</div>
      ${d.shopPhone ? `<div style="font-size:7.5px;color:#94a3b8;margin-top:1px">${d.shopPhone}</div>` : ''}
    </div>
    <div style="font-size:8.5px;font-weight:600;color:#64748b;letter-spacing:.3px">شکریہ · Thank You 🙏</div>
  </div>

</div>
<script>window.onload=()=>window.print();</script>
</body>
</html>`;

  openPrint(html, 600, 560);
}

// A4 CSS for full-page reports
const A4_CSS = `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',Arial,sans-serif;font-size:11px;color:#1a202c;padding:24px}
.page{max-width:860px;margin:0 auto}
.hdr{display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:12px;border-bottom:3px solid #1e3a5f;margin-bottom:16px}
.shop-name{font-size:22px;font-weight:900;color:#1e3a5f;line-height:1}
.shop-sub{font-size:10px;color:#64748b;margin-top:3px}
.rpt-title{text-align:right}
.rpt-title h1{font-size:15px;font-weight:700;color:#1e3a5f}
.rpt-title p{font-size:9px;color:#94a3b8;margin-top:3px}
.sec-title{font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#94a3b8;margin-bottom:7px;padding-bottom:3px;border-bottom:1px solid #e2e8f0}
.profile-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px}
.info-row{display:flex;gap:8px;padding:3px 0;border-bottom:1px solid #f8fafc}
.info-lbl{font-size:9px;color:#94a3b8;min-width:92px;flex-shrink:0}
.info-val{font-size:10px;font-weight:600;color:#1a202c;word-break:break-word}
.stats-bar{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px}
.sc{border-radius:7px;padding:9px 11px;text-align:center;border:1px solid #e2e8f0;background:#f8fafc}
.sc.blue{background:#dbeafe;border-color:#93c5fd}
.sc.green{background:#d1fae5;border-color:#6ee7b7}
.sc.amber{background:#fef3c7;border-color:#fcd34d}
.sc.red{background:#fee2e2;border-color:#fca5a5}
.sl{font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#64748b;margin-bottom:3px}
.sc.blue .sl{color:#1e40af}.sc.green .sl{color:#065f46}.sc.amber .sl{color:#92400e}.sc.red .sl{color:#991b1b}
.sv{font-size:17px;font-weight:900;color:#1e3a5f}
.sc.blue .sv{color:#1d4ed8}.sc.green .sv{color:#059669}.sc.amber .sv{color:#b45309}.sc.red .sv{color:#dc2626}
.ss{font-size:8.5px;color:#94a3b8;margin-top:1px}
table{width:100%;border-collapse:collapse;font-size:9.5px;margin-bottom:16px}
thead{background:#1e3a5f}
thead th{color:#fff;padding:5px 8px;text-align:left;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:.5px}
thead th.r{text-align:right}
tbody tr{border-bottom:1px solid #f1f5f9}
tbody tr:nth-child(even){background:#f8fafc}
td{padding:5px 8px;vertical-align:middle}
td.r{text-align:right}
.badge{display:inline-block;padding:1px 6px;border-radius:10px;font-size:7.5px;font-weight:700;letter-spacing:.3px;text-transform:uppercase}
.st-ACTIVE{background:#dbeafe;color:#1d4ed8}
.st-COMPLETED{background:#d1fae5;color:#065f46}
.st-DEFAULTED{background:#fee2e2;color:#991b1b}
.st-CANCELLED{background:#f1f5f9;color:#64748b}
.st-PENDING{background:#fef3c7;color:#92400e}
.st-CLOSED{background:#e0e7ff;color:#3730a3}
.foot{margin-top:12px;padding-top:8px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:9px;color:#94a3b8}
@media print{
  @page{size:A4 portrait;margin:10mm 12mm}
  body{padding:0}
}
`;

export interface CustomerHistoryReportData {
  shopName: string;
  shopPhone?: string | null;
  customer: {
    name: string;
    phone: string;
    cnicMasked?: string | null;
    address?: string | null;
    area?: string | null;
    occupation?: string | null;
    employer?: string | null;
    guarantorName?: string | null;
    guarantorPhone?: string | null;
    guarantorRelation?: string | null;
    guarantor2Name?: string | null;
    guarantor2Phone?: string | null;
    createdAt: string;
  };
  installments: Array<{
    invoiceNumber?: string | null;
    productName: string;
    imeiNumber?: string | null;
    totalAmount: string | number;
    downPayment: string | number;
    remaining: string | number;
    monthly: string | number;
    months: number;
    startDate: string;
    status: string;
    paymentFrequency?: string | null;
  }>;
  printedAt: string;
}

export function openCustomerHistoryReport(d: CustomerHistoryReportData) {
  const insts = d.installments;
  const totalBusiness = insts.reduce((s, i) => s + Number(i.totalAmount), 0);
  const totalPaid     = insts.reduce((s, i) => s + (Number(i.totalAmount) - Number(i.downPayment) - Number(i.remaining)), 0);
  const totalRemaining = insts.reduce((s, i) => s + Number(i.remaining), 0);
  const activeCount    = insts.filter((i) => i.status === 'ACTIVE').length;
  const completedCount = insts.filter((i) => i.status === 'COMPLETED' || i.status === 'CLOSED').length;
  const defaultedCount = insts.filter((i) => i.status === 'DEFAULTED').length;

  const profileLeft = [
    { l: 'Name', v: d.customer.name },
    { l: 'Phone', v: d.customer.phone },
    { l: 'CNIC', v: d.customer.cnicMasked ?? '—' },
    { l: 'Address', v: [d.customer.address, d.customer.area].filter(Boolean).join(', ') || '—' },
  ];
  const profileRight = [
    { l: 'Occupation', v: d.customer.occupation ?? '—' },
    { l: 'Employer', v: d.customer.employer ?? '—' },
    { l: 'Guarantor', v: d.customer.guarantorName ? `${d.customer.guarantorName}${d.customer.guarantorRelation ? ` (${d.customer.guarantorRelation})` : ''}` : '—' },
    { l: 'Guar. Phone', v: d.customer.guarantorPhone ?? '—' },
    { l: 'Member Since', v: fmtDate(d.customer.createdAt) },
  ];

  function infoRows(rows: { l: string; v: string }[]) {
    return rows.map((r) => `<div class="info-row"><span class="info-lbl">${r.l}</span><span class="info-val">${r.v}</span></div>`).join('');
  }

  const tableRows = insts.length === 0
    ? `<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:18px">Koi installment nahi mila</td></tr>`
    : insts.map((i, idx) => {
        const paid = Number(i.totalAmount) - Number(i.downPayment) - Number(i.remaining);
        const freq = i.paymentFrequency === 'daily' ? 'Daily' : 'Monthly';
        return `<tr>
          <td style="color:#94a3b8;text-align:center">${idx + 1}</td>
          <td style="font-family:monospace;font-size:8.5px;color:#64748b">${i.invoiceNumber ?? '—'}</td>
          <td style="font-weight:600">${i.productName}${i.imeiNumber ? `<br><span style="font-size:8px;color:#94a3b8;font-family:monospace">${i.imeiNumber}</span>` : ''}</td>
          <td style="color:#64748b">${fmtDate(i.startDate)}<br><span style="font-size:8px">${freq} · ${i.months} mo</span></td>
          <td class="r">${pkr(Number(i.totalAmount))}</td>
          <td class="r" style="color:#059669">${pkr(paid)}</td>
          <td class="r" style="color:${Number(i.remaining) > 0 ? '#b45309' : '#059669'}">${pkr(Number(i.remaining))}</td>
          <td><span class="badge st-${i.status}">${i.status}</span></td>
        </tr>`;
      }).join('');

  const printedDate = new Date(d.printedAt).toLocaleString('en-PK', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>Customer History — ${d.customer.name}</title><style>${A4_CSS}</style></head>
<body>
<div class="page">
  <!-- HEADER -->
  <div class="hdr">
    <div>
      <div class="shop-name">${d.shopName}</div>
      ${d.shopPhone ? `<div class="shop-sub">${d.shopPhone}</div>` : ''}
    </div>
    <div class="rpt-title">
      <h1>Customer Full History Report</h1>
      <p>Printed: ${printedDate}</p>
    </div>
  </div>

  <!-- CUSTOMER PROFILE -->
  <div class="sec-title">Customer Profile · گاہک کی تفصیل</div>
  <div class="profile-grid" style="margin-bottom:16px">
    <div>${infoRows(profileLeft)}</div>
    <div>${infoRows(profileRight)}</div>
  </div>

  <!-- SUMMARY STATS -->
  <div class="sec-title">Account Summary · حساب کتاب</div>
  <div class="stats-bar" style="margin-bottom:16px">
    <div class="sc blue">
      <div class="sl">Total Business</div>
      <div class="sv">${pkr(totalBusiness)}</div>
      <div class="ss">${insts.length} installment${insts.length !== 1 ? 's' : ''}</div>
    </div>
    <div class="sc green">
      <div class="sl">Total Paid</div>
      <div class="sv">${pkr(totalPaid)}</div>
      <div class="ss">${completedCount} completed</div>
    </div>
    <div class="sc amber">
      <div class="sl">Outstanding</div>
      <div class="sv">${pkr(totalRemaining)}</div>
      <div class="ss">${activeCount} active</div>
    </div>
    <div class="sc ${defaultedCount > 0 ? 'red' : 'green'}">
      <div class="sl">Defaulted</div>
      <div class="sv">${defaultedCount}</div>
      <div class="ss">${defaultedCount > 0 ? 'high risk' : 'clean record'}</div>
    </div>
  </div>

  <!-- INSTALLMENTS TABLE -->
  <div class="sec-title">Installment History · قسطوں کی تاریخ</div>
  <table>
    <thead>
      <tr>
        <th style="width:28px">#</th>
        <th>Invoice</th>
        <th>Product / IMEI</th>
        <th>Start Date</th>
        <th class="r">Total</th>
        <th class="r">Paid</th>
        <th class="r">Remaining</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>

  <!-- FOOTER -->
  <div class="foot">
    <span>${d.shopName}${d.shopPhone ? ` · ${d.shopPhone}` : ''}</span>
    <span>Confidential · ${printedDate}</span>
  </div>
</div>
<script>window.onload = () => window.print();</script>
</body>
</html>`;

  openPrint(html, 1000, 900);
}

export function cashSaleWhatsappUrl(d: CashSaleReceiptData): string {
  const lines = [
    `*Cash Sale — ${d.shopName}*`,
    `━━━━━━━━━━━━━━━━━━━`,
    `Date: ${fmtDateTime(d.soldAt)}`,
    `Customer: ${d.customerName ?? 'Walk-in'}`,
    d.customerPhone ? `Phone: ${d.customerPhone}` : '',
    `Product: ${d.productName}`,
    (d.quantity ?? 1) > 1 ? `Quantity: ${d.quantity}` : '',
    d.imeiNumber ? `IMEI: ${d.imeiNumber}` : '',
    `━━━━━━━━━━━━━━━━━━━`,
    `Amount: *${pkr(d.amount)}*`,
    `Method: ${mLabel(d.method)}`,
    d.note ? `Note: ${d.note}` : '',
    `━━━━━━━━━━━━━━━━━━━`,
    `Thank you for your purchase! 🙏`,
  ].filter(Boolean).join('\n');
  return `https://wa.me/?text=${encodeURIComponent(lines)}`;
}
