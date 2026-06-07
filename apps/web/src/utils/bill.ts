import QRCode from 'qrcode';

export interface BillPaymentAccount {
  type: string;
  accountTitle: string;
  accountNumber: string;
  bankName?: string | null;
}

export interface BillData {
  shop: { shopName: string; phone: string; address?: string | null };
  customer: { name: string; phone: string; cnic?: string; area?: string | null };
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
  imeiNumber?: string | null;
  cashPrice?: string | number | null;
  profitMarkup?: string | number | null;
  murabahaMode?: boolean;
  paymentFrequency?: string | null;
  paymentAccounts?: BillPaymentAccount[];
}

export interface CashSaleBillData {
  shop: { shopName: string; phone: string; address?: string | null };
  customer: { name?: string | null; phone?: string | null };
  product: string;
  quantity: number;
  amount: string | number;
  method: string;
  imeiNumber?: string | null;
  note?: string | null;
  soldAt: string;
  saleId: string;
}

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash', BANK: 'Bank Transfer', JAZZCASH: 'JazzCash', EASYPAISA: 'EasyPaisa', OTHER: 'Other',
};

function pkr(v: string | number) {
  return 'PKR ' + Number(v).toLocaleString('en-PK', { maximumFractionDigits: 0 });
}

function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_UR: Record<string, string> = {
  ACTIVE: 'فعال', COMPLETED: 'مکمل', DEFAULTED: 'ڈیفالٹ',
  CANCELLED: 'منسوخ', PENDING: 'زیر التواء', CLOSED: 'بند',
};

function buildSchedule(data: BillData): { month: number; due: string; amount: string; paid: boolean }[] {
  const start     = new Date(data.startDate);
  const monthly   = Number(data.monthly);
  const total     = Number(data.totalAmount);
  const remaining = Number(data.remaining);
  const paid      = total - remaining;
  const downPmt   = Number(data.downPayment);
  const isDaily   = data.paymentFrequency === 'daily';
  const installsPaid = downPmt >= remaining ? data.months : Math.floor((paid - downPmt) / monthly);

  return Array.from({ length: data.months }, (_, i) => ({
    month:  i + 1,
    due:    fmtDate(isDaily ? addDays(start, i + 1) : addMonths(start, i + 1)),
    amount: pkr(monthly),
    paid:   i < installsPaid,
  }));
}

export async function openBill(data: BillData) {
  const invoiceNo  = data.invoiceNumber ?? `INV-${new Date().getFullYear()}-${data.installmentId.slice(0, 6).toUpperCase()}`;
  const printDate  = new Date().toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
  const isDaily    = data.paymentFrequency === 'daily';
  const startDate  = fmtDate(new Date(data.startDate));
  const endDate    = fmtDate(isDaily
    ? addDays(new Date(data.startDate), data.months)
    : addMonths(new Date(data.startDate), data.months));

  const schedule   = buildSchedule(data);
  const isMurabaha = (data.murabahaMode || isDaily) && data.cashPrice != null && Number(data.cashPrice) > 0;
  const markup     = isMurabaha ? Number(data.profitMarkup ?? 0) : 0;
  const markupPct  = isMurabaha && Number(data.cashPrice) > 0
    ? ((markup / Number(data.cashPrice)) * 100).toFixed(1) : null;

  const qrPayload  = [
    `INV:${invoiceNo}`,
    `SHOP:${data.shop.shopName}`,
    `CUST:${data.customer.name}`,
    `PROD:${data.product}`,
    `AMT:${Number(data.totalAmount).toFixed(0)}`,
    `REM:${Number(data.remaining).toFixed(0)}`,
    `ID:${data.installmentId.slice(0, 8).toUpperCase()}`,
    ...(data.imeiNumber ? [`IMEI:${data.imeiNumber}`] : []),
  ].join('\n');

  const qrDataUrl = await QRCode.toDataURL(qrPayload, {
    errorCorrectionLevel: 'M', margin: 1, width: 100,
    color: { dark: '#0f172a', light: '#ffffff' },
  });

  // Receipt: show max 6 rows — first 4 + ellipsis + last (keeps height within half-A4)
  const MAX_ROWS = 6;
  const visibleSchedule = schedule.length <= MAX_ROWS
    ? schedule
    : [...schedule.slice(0, 4), null, schedule[schedule.length - 1]];

  const scheduleRows = visibleSchedule.map((r) => r === null ? `
    <tr>
      <td colspan="4" style="padding:2px 8px;text-align:center;color:#94a3b8;font-size:8.5px;border-bottom:1px solid #f3f4f6">
        · · · ${schedule.length - 5} more installments · · ·
      </td>
    </tr>` : `
    <tr>
      <td style="padding:2px 8px;color:#374151;border-bottom:1px solid #f3f4f6;text-align:center">${r.month}</td>
      <td style="padding:2px 8px;color:#374151;border-bottom:1px solid #f3f4f6">${r.due}</td>
      <td style="padding:2px 8px;text-align:right;border-bottom:1px solid #f3f4f6;font-weight:600;color:#374151">${r.amount}</td>
      <td style="padding:2px 8px;text-align:center;border-bottom:1px solid #f3f4f6">
        ${r.paid
          ? '<span style="background:#d1fae5;color:#065f46;padding:1px 6px;border-radius:20px;font-size:8.5px;font-weight:700">PAID</span>'
          : '<span style="background:#fef3c7;color:#92400e;padding:1px 6px;border-radius:20px;font-size:8.5px;font-weight:700">DUE</span>'
        }
      </td>
    </tr>`).join('');

  const murabahaLine = isMurabaha
    ? `<span style="font-size:9px;color:${isDaily ? '#9a3412' : '#065f46'};font-weight:700;margin-left:6px">${isDaily ? 'Dukaan-Dar' : 'Murabaha'}: Cost ${pkr(data.cashPrice!)} + Markup ${pkr(markup)}${markupPct ? ` (${markupPct}%)` : ''}</span>`
    : '';

  const payAccounts = (data.paymentAccounts && data.paymentAccounts.length > 0) ? `
    <div style="margin-top:6px;padding:6px 8px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:5px;font-size:10px">
      <span style="font-weight:700;color:#0369a1;font-size:9px;text-transform:uppercase;letter-spacing:.5px">Pay Online: </span>
      ${data.paymentAccounts.map((a) => `<span style="margin-right:10px;color:#0f172a"><strong>${a.type}${a.bankName ? ` (${a.bankName})` : ''}</strong>: ${a.accountNumber} · ${a.accountTitle}</span>`).join('')}
    </div>` : '';

  // Single invoice HTML — used twice (customer copy + shop copy)
  function invoiceCopy(copyLabel: string) { return `
  <div class="inv">
    <!-- HEADER -->
    <div class="hdr">
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:900;color:#fff;line-height:1">${data.shop.shopName}</div>
        <div style="font-size:9.5px;color:#93c5fd;margin-top:2px">${data.shop.phone}${data.shop.address ? ` · ${data.shop.address}` : ''}</div>
        ${isDaily ? '<span style="font-size:9px;font-weight:700;background:#fed7aa;color:#9a3412;padding:1px 7px;border-radius:20px;margin-top:4px;display:inline-block">Dukaan-Dar Daily</span>'
          : isMurabaha ? '<span style="font-size:9px;font-weight:700;background:#d1fae5;color:#065f46;padding:1px 7px;border-radius:20px;margin-top:4px;display:inline-block">Murabaha</span>' : ''}
      </div>
      <div style="text-align:right;flex-shrink:0;margin:0 10px">
        <div style="font-size:13px;font-weight:900;color:#60a5fa">INVOICE <span style="font-family:'Noto Nastaliq Urdu',serif;font-size:11px">اقساط نامہ</span></div>
        <div style="font-size:11px;font-weight:700;color:#fff;margin-top:1px">${invoiceNo}</div>
        <div style="font-size:9px;color:#475569;margin-top:1px">${printDate}</div>
        <div style="font-size:9px;color:#64748b;margin-top:1px">${copyLabel}</div>
      </div>
      <div style="flex-shrink:0">
        <img src="${qrDataUrl}" width="58" height="58" style="border:1px solid rgba(255,255,255,.2);border-radius:4px;display:block" alt="QR"/>
      </div>
    </div>

    <!-- INFO GRID: customer | product | dates | duration -->
    <div style="display:grid;grid-template-columns:2fr 2fr 1.5fr 1.5fr;gap:5px;margin-bottom:6px">
      <div class="ic">
        <span class="il">Customer · گاہک</span>
        <span class="iv">${data.customer.name}</span>
        <span class="is">${data.customer.phone}${data.customer.cnic ? ` · ${data.customer.cnic}` : ''}</span>
        ${data.customer.area ? `<span class="is">📍 ${data.customer.area}</span>` : ''}
      </div>
      <div class="ic">
        <span class="il">Product · مصنوعہ</span>
        <span class="iv">${data.product}</span>
        ${data.imeiNumber ? `<span class="is" style="font-family:monospace;font-size:9px">IMEI: ${data.imeiNumber}</span>` : ''}
        <span class="is"><span class="status-badge status-${data.status}">${data.status}</span> <span style="font-family:'Noto Nastaliq Urdu',serif;font-size:10px;color:#64748b">${STATUS_UR[data.status] ?? ''}</span></span>
      </div>
      <div class="ic">
        <span class="il">Start Date</span>
        <span class="iv">${startDate}</span>
        <span class="il" style="margin-top:4px">End Date</span>
        <span class="iv">${endDate}</span>
      </div>
      <div class="ic">
        <span class="il">Duration · مدت</span>
        <span class="iv">${data.months} ${isDaily ? 'days · دن' : 'months · ماہ'}</span>
        <span class="il" style="margin-top:4px">${isDaily ? 'Daily · روزانہ' : 'Monthly · ماہانہ'}</span>
        <span class="iv">${pkr(data.monthly)}</span>
      </div>
    </div>

    <!-- AMOUNTS STRIP -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-bottom:6px">
      <div class="ac">
        <span class="al">Total · کل قیمت</span>
        <span class="av">${pkr(data.totalAmount)}</span>
        ${murabahaLine ? `<span style="font-size:8.5px;color:#64748b;margin-top:1px;display:block">${pkr(data.cashPrice!)}+${pkr(markup)}</span>` : ''}
      </div>
      <div class="ac">
        <span class="al">Down · پیشگی</span>
        <span class="av">${pkr(data.downPayment)}</span>
      </div>
      <div class="ac hl">
        <span class="al" style="color:rgba(255,255,255,.7)">${isDaily ? 'Daily · روزانہ' : 'Monthly · ماہانہ'}</span>
        <span class="av" style="color:#fff">${pkr(data.monthly)}</span>
      </div>
      <div class="ac rm">
        <span class="al" style="color:#b45309">Remaining · باقی</span>
        <span class="av" style="color:#92400e">${pkr(data.remaining)}</span>
      </div>
    </div>

    <!-- SCHEDULE -->
    <div style="border:1px solid #e2e8f0;border-radius:5px;overflow:hidden;margin-bottom:6px">
      <table style="width:100%;border-collapse:collapse;font-size:10px">
        <thead>
          <tr style="background:#0f172a">
            <th style="padding:5px 8px;color:#fff;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;text-align:center;width:28px">#</th>
            <th style="padding:5px 8px;color:#fff;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.4px">Due Date <span style="font-family:'Noto Nastaliq Urdu',serif;font-size:10px;text-transform:none;letter-spacing:0">تاریخ</span></th>
            <th style="padding:5px 8px;color:#fff;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;text-align:right">Amount <span style="font-family:'Noto Nastaliq Urdu',serif;font-size:10px;text-transform:none;letter-spacing:0">رقم</span></th>
            <th style="padding:5px 8px;color:#fff;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;text-align:center">Status</th>
          </tr>
        </thead>
        <tbody>${scheduleRows}</tbody>
      </table>
    </div>

    ${payAccounts}

    <!-- SIGNATURES -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:8px">
      <div style="border-top:1px solid #94a3b8;padding-top:4px;font-size:9px;color:#94a3b8;text-align:center">
        Seller Signature &amp; Stamp · <span style="font-family:'Noto Nastaliq Urdu',serif;font-size:10px">دستخط و مہر بائع</span>
      </div>
      <div style="border-top:1px solid #94a3b8;padding-top:4px;font-size:9px;color:#94a3b8;text-align:center">
        Customer Signature · <span style="font-family:'Noto Nastaliq Urdu',serif;font-size:10px">دستخط گاہک</span>
      </div>
    </div>

    <!-- FOOTER -->
    <div style="margin-top:6px;padding-top:5px;border-top:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:9px;color:#94a3b8">${data.shop.shopName} · ${data.shop.phone}</div>
      <div style="font-size:9px;color:#94a3b8">Ref: ${data.installmentId.slice(0, 8).toUpperCase()} · ${new Date().toLocaleDateString('en-PK')}</div>
    </div>
  </div>`; }

  const html = `<!DOCTYPE html>
<html lang="ur" dir="ltr">
<head>
<meta charset="UTF-8"/>
<title>${invoiceNo}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;600&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;padding:20px;display:flex;justify-content:center}

  .inv{background:#fff;width:680px;padding:13px 16px;font-size:10.5px;color:#374151;border:1px solid #e2e8f0}

  .hdr{display:flex;align-items:center;gap:8px;padding:9px 11px 7px;background:linear-gradient(135deg,#0f172a,#1e3a5f);border-radius:4px 4px 0 0;margin:-13px -16px 9px}
  .ur{font-family:'Noto Nastaliq Urdu',serif;direction:rtl}

  .ic{background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:4px 6px;overflow:hidden}
  .il{display:block;font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;margin-bottom:1px}
  .iv{display:block;font-size:10.5px;font-weight:600;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .is{display:block;font-size:9px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

  .ac{background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:5px 7px;text-align:center}
  .ac.hl{background:#1d4ed8;border-color:#1d4ed8}
  .ac.rm{background:#fffbeb;border-color:#fcd34d}
  .al{display:block;font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:#94a3b8;margin-bottom:1px}
  .ac.hl .al{color:rgba(255,255,255,.65)}
  .ac.rm .al{color:#b45309}
  .av{display:block;font-size:11.5px;font-weight:800;color:#0f172a}
  .ac.hl .av{color:#fff}
  .ac.rm .av{color:#92400e}

  .status-badge{display:inline-block;padding:1px 5px;border-radius:20px;font-size:8.5px;font-weight:700}
  .status-ACTIVE{background:#d1fae5;color:#065f46}
  .status-COMPLETED{background:#dbeafe;color:#1e40af}
  .status-DEFAULTED{background:#fee2e2;color:#991b1b}
  .status-CANCELLED,.status-CLOSED{background:#f1f5f9;color:#64748b}
  .status-PENDING{background:#fef3c7;color:#92400e}

  @media print{
    @page{size:A4 portrait;margin:5mm 7mm}
    body{background:#fff;padding:0}
    .inv{border:none;width:100%;max-height:135mm;overflow:hidden}
  }
</style>
</head>
<body>
  ${invoiceCopy('')}
<script>window.onload=()=>window.print();</script>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=840,height=980');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

export async function openCashSaleBill(data: CashSaleBillData) {
  const invoiceNo = `CS-${data.saleId.slice(0, 6).toUpperCase()}`;
  const saleDate  = new Date(data.soldAt).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
  const method    = METHOD_LABELS[data.method] ?? data.method;

  const qrPayload = [
    `SALE:${invoiceNo}`,
    `SHOP:${data.shop.shopName}`,
    `CUST:${data.customer.name ?? 'Walk-in'}`,
    `PROD:${data.product}`,
    `AMT:${Number(data.amount).toFixed(0)}`,
    `MTH:${data.method}`,
    ...(data.imeiNumber ? [`IMEI:${data.imeiNumber}`] : []),
  ].join('\n');

  const qrDataUrl = await QRCode.toDataURL(qrPayload, {
    errorCorrectionLevel: 'M', margin: 1, width: 100,
    color: { dark: '#0f172a', light: '#ffffff' },
  });

  const css = `
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;padding:20px;display:flex;justify-content:center}
    .inv{background:#fff;width:680px;padding:13px 16px;font-size:10.5px;color:#374151;border:1px solid #e2e8f0}
    .hdr{display:flex;align-items:center;gap:8px;padding:9px 11px 7px;background:linear-gradient(135deg,#0f172a,#1e3a5f);border-radius:4px 4px 0 0;margin:-13px -16px 9px}
    .ic{background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:4px 6px;overflow:hidden}
    .il{display:block;font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;margin-bottom:1px}
    .iv{display:block;font-size:10.5px;font-weight:600;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .is{display:block;font-size:9px;color:#64748b}
    .ac{background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:5px 7px;text-align:center}
    .ac.hl{background:#1d4ed8;border-color:#1d4ed8}
    .ac.gn{background:#d1fae5;border-color:#6ee7b7}
    .al{display:block;font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:#94a3b8;margin-bottom:1px}
    .ac.hl .al{color:rgba(255,255,255,.65)}
    .ac.gn .al{color:#065f46}
    .av{display:block;font-size:11.5px;font-weight:800;color:#0f172a}
    .ac.hl .av{color:#fff}
    .ac.gn .av{color:#065f46;font-size:13px}
    @media print{
      @page{size:A5 landscape;margin:5mm 7mm}
      body{background:#fff;padding:0}
      .inv{border:none;width:100%}
    }
  `;

  const htmlContent = `<!DOCTYPE html>
<html lang="ur" dir="ltr">
<head>
<meta charset="UTF-8"/>
<title>${invoiceNo}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;600&display=swap" rel="stylesheet">
<style>${css}</style>
</head>
<body>
<div class="inv">
  <div class="hdr">
    <div style="flex:1;min-width:0">
      <div style="font-size:14px;font-weight:900;color:#fff;line-height:1">${data.shop.shopName}</div>
      <div style="font-size:9.5px;color:#93c5fd;margin-top:2px">${data.shop.phone}${data.shop.address ? ` · ${data.shop.address}` : ''}</div>
      <span style="font-size:9px;font-weight:700;background:#d1fae5;color:#065f46;padding:1px 7px;border-radius:20px;margin-top:4px;display:inline-block">Cash Sale · نقد فروخت</span>
    </div>
    <div style="text-align:right;flex-shrink:0;margin:0 10px">
      <div style="font-size:13px;font-weight:900;color:#60a5fa">RECEIPT <span style="font-family:'Noto Nastaliq Urdu',serif;font-size:11px">رسید</span></div>
      <div style="font-size:11px;font-weight:700;color:#fff;margin-top:1px">${invoiceNo}</div>
      <div style="font-size:9px;color:#94a3b8;margin-top:1px">${saleDate}</div>
    </div>
    <div style="flex-shrink:0">
      <img src="${qrDataUrl}" width="58" height="58" style="border:1px solid rgba(255,255,255,.2);border-radius:4px;display:block" alt="QR"/>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:6px">
    <div class="ic">
      <span class="il">Customer · گاہک</span>
      <span class="iv">${data.customer.name ?? 'Walk-in Customer'}</span>
      ${data.customer.phone ? `<span class="is">${data.customer.phone}</span>` : ''}
    </div>
    <div class="ic">
      <span class="il">Product · مصنوعہ</span>
      <span class="iv">${data.product}</span>
      ${data.imeiNumber ? `<span class="is" style="font-family:monospace;font-size:9px">IMEI: ${data.imeiNumber}</span>` : ''}
      ${data.quantity > 1 ? `<span class="is">Qty · تعداد: ${data.quantity}</span>` : ''}
    </div>
  </div>

  <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:5px;margin-bottom:6px">
    <div class="ac hl">
      <span class="al">Amount Paid · ادا کی رقم</span>
      <span class="av">${pkr(data.amount)}</span>
    </div>
    <div class="ac">
      <span class="al">Method · طریقہ</span>
      <span class="av" style="font-size:10px">${method}</span>
    </div>
    <div class="ac gn">
      <span class="al">Status · حیثیت</span>
      <span class="av">✓ PAID</span>
    </div>
  </div>

  ${data.note ? `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:4px 8px;margin-bottom:6px;font-size:9.5px;color:#374151"><strong>Note:</strong> ${data.note}</div>` : ''}

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:10px">
    <div style="border-top:1px solid #94a3b8;padding-top:4px;font-size:9px;color:#94a3b8;text-align:center">
      Seller Signature &amp; Stamp · <span style="font-family:'Noto Nastaliq Urdu',serif;font-size:10px">دستخط و مہر بائع</span>
    </div>
    <div style="border-top:1px solid #94a3b8;padding-top:4px;font-size:9px;color:#94a3b8;text-align:center">
      Customer Signature · <span style="font-family:'Noto Nastaliq Urdu',serif;font-size:10px">دستخط گاہک</span>
    </div>
  </div>

  <div style="margin-top:6px;padding-top:5px;border-top:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center">
    <div style="font-size:9px;color:#94a3b8">${data.shop.shopName} · ${data.shop.phone}</div>
    <div style="font-size:9px;color:#94a3b8">Ref: ${data.saleId.slice(0, 8).toUpperCase()} · ${saleDate}</div>
  </div>
</div>
<script>window.onload=()=>window.print();</script>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=840,height=700');
  if (!w) return;
  w.document.write(htmlContent);
  w.document.close();
}
