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
  const freq = d.paymentFrequency === 'daily' ? 'Daily' : 'Monthly';
  const invoiceNo = d.invoiceNumber ?? '';
  const printDate = fmtDate(d.paidOn);

  const hasProg = d.paidInstallments !== undefined && d.totalInstallments !== undefined;
  const paidInst = d.paidInstallments ?? 0;
  const totalInst = d.totalInstallments ?? 0;
  const pendingInst = totalInst - paidInst;
  const curMonth = d.currentMonth ?? paidInst;
  const pct = totalInst > 0 ? Math.round((paidInst / totalInst) * 100) : 0;

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
          <div style="font-size:7.5px;color:#b45309">${freq.toLowerCase()}s left</div>
        </div>
        <div style="text-align:center;background:#dbeafe;border:1px solid #93c5fd;border-radius:5px;padding:5px 3px">
          <div style="font-size:7px;color:#1e40af;font-weight:700;letter-spacing:.3px">THIS ${freq.toUpperCase()}</div>
          <div style="font-size:18px;font-weight:800;color:#1e40af;line-height:1.2">#${curMonth}</div>
          <div style="font-size:7.5px;color:#3b82f6">installment</div>
        </div>
      </div>
      <div style="background:#f1f5f9;border-radius:20px;height:7px;overflow:hidden">
        <div style="background:linear-gradient(90deg,#10b981,#059669);height:100%;width:${pct}%;border-radius:20px"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:3px">
        <span style="font-size:8px;color:#059669;font-weight:600">${paidInst} paid (${pct}%)</span>
        <span style="font-size:8px;color:#94a3b8">${totalInst} total ${freq.toLowerCase()}s</span>
      </div>
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
  const freq = d.paymentFrequency === 'daily' ? 'Daily' : 'Monthly';
  const hasProg = d.paidInstallments !== undefined && d.totalInstallments !== undefined;
  const pendingInst = (d.totalInstallments ?? 0) - (d.paidInstallments ?? 0);
  const lines = [
    `*Payment Receipt — ${d.shopName}*`,
    `━━━━━━━━━━━━━━━━━━━`,
    `Date: ${fmtDateTime(d.paidOn)}`,
    d.invoiceNumber ? `Invoice: ${d.invoiceNumber}` : '',
    `Customer: ${d.customerName}`,
    d.customerPhone ? `Phone: ${d.customerPhone}` : '',
    `Product: ${d.productName}`,
    `━━━━━━━━━━━━━━━━━━━`,
    `Amount Paid: *${pkr(d.amountPaid)}*`,
    `Method: ${mLabel(d.method)}`,
    hasProg ? `Installment: *#${d.currentMonth ?? d.paidInstallments} of ${d.totalInstallments}*` : '',
    hasProg ? `✅ Paid: ${d.paidInstallments}  |  ⏳ Pending: ${pendingInst}` : '',
    d.completed ? `Status: ✅ FULLY PAID — Congratulations!` : `Remaining Amount: ${pkr(d.remaining)}`,
    !d.completed && !hasProg ? `${freq} Installment: ${pkr(d.monthly)}` : '',
    d.note ? `Note: ${d.note}` : '',
    `━━━━━━━━━━━━━━━━━━━`,
    `Thank you for your payment! 🙏`,
  ].filter(Boolean).join('\n');
  return `https://wa.me/?text=${encodeURIComponent(lines)}`;
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
