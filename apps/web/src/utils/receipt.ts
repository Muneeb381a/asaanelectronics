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

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-PK', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function pkr(n: number) {
  return 'PKR ' + n.toLocaleString('en-PK', { maximumFractionDigits: 0 });
}

const CSS = `
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

function html(title: string, body: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>${CSS}</style></head><body>${body}</body></html>`;
}

function openPrint(content: string) {
  const win = window.open('', '_blank', 'width=380,height=640,scrollbars=no');
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
  const body = `
    <div class="shop">${d.shopName}</div>
    ${d.shopPhone ? `<div class="sub">${d.shopPhone}</div>` : ''}
    <div class="sub">Payment Receipt</div>
    <hr/>
    <div class="row"><span class="lbl">Date</span><span class="val">${fmtDate(d.paidOn)}</span></div>
    ${d.invoiceNumber ? `<div class="row"><span class="lbl">Invoice</span><span class="val">${d.invoiceNumber}</span></div>` : ''}
    <div class="row"><span class="lbl">Customer</span><span class="val">${d.customerName}</span></div>
    ${d.customerPhone ? `<div class="row"><span class="lbl">Phone</span><span class="val">${d.customerPhone}</span></div>` : ''}
    <div class="row"><span class="lbl">Product</span><span class="val">${d.productName}</span></div>
    <hr/>
    <div class="row big"><span class="lbl">Amount Paid</span><span class="val">${pkr(d.amountPaid)}</span></div>
    <div class="row"><span class="lbl">Method</span><span class="val">${mLabel(d.method)}</span></div>
    ${d.completed ? `<div class="badge">✓ FULLY PAID</div>` : `
      <div class="row"><span class="lbl">Remaining</span><span class="val">${pkr(d.remaining)}</span></div>
      <div class="row"><span class="lbl">${freq} Inst.</span><span class="val">${pkr(d.monthly)}</span></div>
    `}
    ${d.note ? `<div class="row"><span class="lbl">Note</span><span class="val">${d.note}</span></div>` : ''}
    <hr/>
    <div class="foot">Thank you for your payment!</div>
  `;
  openPrint(html('Payment Receipt', body));
}

export function printCashSaleReceipt(d: CashSaleReceiptData) {
  const body = `
    <div class="shop">${d.shopName}</div>
    ${d.shopPhone ? `<div class="sub">${d.shopPhone}</div>` : ''}
    <div class="sub">Cash Sale Receipt</div>
    <hr/>
    <div class="row"><span class="lbl">Date</span><span class="val">${fmtDate(d.soldAt)}</span></div>
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
  openPrint(html('Cash Sale', body));
}

export function installmentWhatsappUrl(d: InstallmentReceiptData): string {
  const freq = d.paymentFrequency === 'daily' ? 'Daily' : 'Monthly';
  const lines = [
    `*Payment Receipt — ${d.shopName}*`,
    `━━━━━━━━━━━━━━━━━━━`,
    `Date: ${fmtDate(d.paidOn)}`,
    d.invoiceNumber ? `Invoice: ${d.invoiceNumber}` : '',
    `Customer: ${d.customerName}`,
    d.customerPhone ? `Phone: ${d.customerPhone}` : '',
    `Product: ${d.productName}`,
    `━━━━━━━━━━━━━━━━━━━`,
    `Amount Paid: *${pkr(d.amountPaid)}*`,
    `Method: ${mLabel(d.method)}`,
    d.completed ? `Status: ✅ FULLY PAID` : `Remaining: ${pkr(d.remaining)}`,
    !d.completed ? `${freq} Installment: ${pkr(d.monthly)}` : '',
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
    `Date: ${fmtDate(d.soldAt)}`,
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
