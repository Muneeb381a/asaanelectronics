import QRCode from 'qrcode';
import { fmtDate } from './dateFormat.ts';

export interface BillPaymentAccount {
  type: string;
  accountTitle: string;
  accountNumber: string;
  bankName?: string | null;
}

export interface BillData {
  shop: { shopName: string; phone: string; address?: string | null };
  customer: { name: string; phone: string; cnic?: string; area?: string | null; photoUrl?: string | null };
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
  paymentSummary?: { currentMonth: number; paidMonths: number; totalMonths: number };
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
  const printDate  = fmtDate(new Date());
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

  // Schedule layout:
  //  ≤ 12 installments → single column, all rows
  //  13–36              → two columns side by side (fits on one page)
  //  > 36               → two columns, first 18 + last row + "X more" note
  function buildScheduleSection() {
    function row(r: { month: number; due: string; amount: string; paid: boolean } | null, colspan = 4): string {
      if (r === null) return `<tr><td colspan="${colspan}" style="padding:1px 6px;text-align:center;color:#94a3b8;font-size:8px;border-bottom:1px solid #f3f4f6">· · ·</td></tr>`;
      return `<tr>
        <td style="padding:2px 6px;color:#374151;border-bottom:1px solid #f3f4f6;text-align:center;font-size:9px">${r.month}</td>
        <td style="padding:2px 6px;color:#374151;border-bottom:1px solid #f3f4f6;font-size:9px">${r.due}</td>
        <td style="padding:2px 6px;text-align:right;border-bottom:1px solid #f3f4f6;font-weight:600;color:#374151;font-size:9px">${r.amount}</td>
        <td style="padding:2px 6px;text-align:center;border-bottom:1px solid #f3f4f6">
          ${r.paid
            ? '<span style="background:#d1fae5;color:#065f46;padding:1px 5px;border-radius:20px;font-size:8px;font-weight:700">PAID</span>'
            : '<span style="background:#fef3c7;color:#92400e;padding:1px 5px;border-radius:20px;font-size:8px;font-weight:700">DUE</span>'
          }
        </td></tr>`;
    }
    const thead = `<thead><tr style="background:#0f172a">
      <th style="padding:4px 6px;color:#fff;font-size:8.5px;font-weight:700;text-transform:uppercase;text-align:center;width:24px">#</th>
      <th style="padding:4px 6px;color:#fff;font-size:8.5px;font-weight:700;text-transform:uppercase">Due Date</th>
      <th style="padding:4px 6px;color:#fff;font-size:8.5px;font-weight:700;text-transform:uppercase;text-align:right">Amount</th>
      <th style="padding:4px 6px;color:#fff;font-size:8.5px;font-weight:700;text-transform:uppercase;text-align:center">Status</th>
    </tr></thead>`;

    if (schedule.length <= 12) {
      return `<div style="border:1px solid #e2e8f0;border-radius:5px;overflow:hidden;margin-bottom:5px">
        <table style="width:100%;border-collapse:collapse">${thead}<tbody>${schedule.map((r) => row(r)).join('')}</tbody></table>
      </div>`;
    }

    // Two-column layout
    const MAX_PER_COL = 18;
    const MAX_TOTAL   = MAX_PER_COL * 2;
    let left: (typeof schedule[number] | null)[]  = [];
    let right: (typeof schedule[number] | null)[] = [];
    let hiddenCount = 0;

    if (schedule.length <= MAX_TOTAL) {
      const half = Math.ceil(schedule.length / 2);
      left  = schedule.slice(0, half);
      right = schedule.slice(half);
    } else {
      // show first (MAX_PER_COL - 1) + "..." + last on each side
      hiddenCount = schedule.length - MAX_TOTAL;
      left  = [...schedule.slice(0, MAX_PER_COL - 1), null, schedule[schedule.length - 2]];
      right = [...schedule.slice(MAX_PER_COL - 1, MAX_TOTAL - 2), null, schedule[schedule.length - 1]];
    }

    const colTable = (rows: (typeof schedule[number] | null)[]) => `
      <table style="width:100%;border-collapse:collapse">${thead}<tbody>${rows.map((r) => row(r)).join('')}</tbody></table>`;

    return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:5px">
      <div style="border:1px solid #e2e8f0;border-radius:5px;overflow:hidden">${colTable(left)}</div>
      <div style="border:1px solid #e2e8f0;border-radius:5px;overflow:hidden">${colTable(right)}</div>
    </div>${hiddenCount > 0 ? `<p style="font-size:8px;color:#94a3b8;text-align:center;margin-bottom:4px">${hiddenCount} more installments not shown</p>` : ''}`;
  }

  const scheduleSection = buildScheduleSection();

  const murabahaLine = isMurabaha
    ? `<span style="font-size:9px;color:${isDaily ? '#9a3412' : '#065f46'};font-weight:700;margin-left:6px">${isDaily ? 'Dukaan-Dar' : 'Murabaha'}: Cost ${pkr(data.cashPrice!)} + Markup ${pkr(markup)}${markupPct ? ` (${markupPct}%)` : ''}</span>`
    : '';

  const payAccounts = (data.paymentAccounts && data.paymentAccounts.length > 0) ? `
    <div style="margin-top:6px;padding:6px 8px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:5px;font-size:10px">
      <span style="font-weight:700;color:#0369a1;font-size:9px;text-transform:uppercase;letter-spacing:.5px">Pay Online: </span>
      ${data.paymentAccounts.map((a) => `<span style="margin-right:10px;color:#0f172a"><strong>${a.type}${a.bankName ? ` (${a.bankName})` : ''}</strong>: ${a.accountNumber} · ${a.accountTitle}</span>`).join('')}
    </div>` : '';

  // Customer avatar: photo or initials fallback
  const initials = data.customer.name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const avatarColors = ['#4f46e5','#0891b2','#059669','#d97706','#dc2626','#7c3aed'];
  const avatarBg = avatarColors[data.customer.name.charCodeAt(0) % avatarColors.length];
  const customerAvatar = data.customer.photoUrl
    ? `<img src="${data.customer.photoUrl}" alt="${data.customer.name}"
         style="width:60px;height:60px;border-radius:50%;object-fit:cover;border:3px solid rgba(255,255,255,.25);flex-shrink:0;display:block"/>`
    : `<div style="width:60px;height:60px;border-radius:50%;background:${avatarBg};border:3px solid rgba(255,255,255,.25);
         flex-shrink:0;display:flex;align-items:center;justify-content:center;
         font-size:22px;font-weight:800;color:#fff;letter-spacing:-1px">${initials}</div>`;

  const pctPaid = data.paymentSummary && data.paymentSummary.totalMonths > 0
    ? Math.round((data.paymentSummary.paidMonths / data.paymentSummary.totalMonths) * 100) : 0;
  const pendingMonths = data.paymentSummary
    ? data.paymentSummary.totalMonths - data.paymentSummary.paidMonths : 0;

  // Single invoice HTML
  function invoiceCopy(copyLabel: string) { return `
  <div class="inv">

    <!-- ═══ HEADER BAND ═══ -->
    <div class="hdr">
      <div style="flex:1;min-width:0">
        <div style="font-size:15px;font-weight:900;color:#fff;letter-spacing:-.3px;line-height:1.1">${data.shop.shopName}</div>
        <div style="font-size:9px;color:#93c5fd;margin-top:3px">${data.shop.phone}${data.shop.address ? ` · ${data.shop.address}` : ''}</div>
        <div style="display:flex;gap:5px;margin-top:5px;flex-wrap:wrap">
          ${isDaily ? '<span class="pill pill-orange">Dukaan-Dar Daily</span>' : isMurabaha ? '<span class="pill pill-green">Murabaha</span>' : ''}
          ${copyLabel ? `<span class="pill pill-gray">${copyLabel}</span>` : ''}
        </div>
      </div>
      <div style="text-align:center;flex-shrink:0;margin:0 12px">
        <div style="font-size:11px;font-weight:800;color:#60a5fa;letter-spacing:1.5px">INVOICE</div>
        <div style="font-size:13px;font-weight:900;color:#fff;margin-top:1px;font-family:monospace;letter-spacing:.5px">${invoiceNo}</div>
        <div style="font-size:8.5px;color:#94a3b8;margin-top:3px">${printDate}</div>
        <div style="font-family:'Noto Nastaliq Urdu',serif;font-size:11px;color:#7dd3fc;margin-top:2px;direction:rtl">اقساط نامہ</div>
      </div>
      <div style="flex-shrink:0">
        <img src="${qrDataUrl}" width="62" height="62"
          style="border:2px solid rgba(255,255,255,.2);border-radius:6px;display:block;background:#fff;padding:2px" alt="QR"/>
        <div style="font-size:6.5px;color:#64748b;text-align:center;margin-top:2px">Scan to verify</div>
      </div>
    </div>

    <!-- ═══ CUSTOMER CARD ═══ -->
    <div class="customer-card">
      <div style="display:flex;align-items:center;gap:12px">
        ${customerAvatar}
        <div style="min-width:0;flex:1">
          <div style="font-size:7px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,.55);margin-bottom:3px">Customer · گاہک</div>
          <div style="font-size:15px;font-weight:800;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.1">${data.customer.name}</div>
          <div style="font-size:10px;color:#93c5fd;margin-top:3px">${data.customer.phone}${data.customer.cnic ? ` · <span style="font-family:monospace">${data.customer.cnic}</span>` : ''}</div>
          ${data.customer.area ? `<div style="font-size:9px;color:#7dd3fc;margin-top:2px">📍 ${data.customer.area}</div>` : ''}
        </div>
        <div style="flex-shrink:0;text-align:right">
          <span class="status-badge-lg status-${data.status}">${data.status}</span>
          <div style="font-family:'Noto Nastaliq Urdu',serif;font-size:11px;color:rgba(255,255,255,.5);margin-top:3px;direction:rtl">${STATUS_UR[data.status] ?? ''}</div>
        </div>
      </div>
    </div>

    <!-- ═══ PRODUCT + DATES ROW ═══ -->
    <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:5px;margin-bottom:6px">
      <div class="ic">
        <span class="il">Product · مصنوعہ</span>
        <span class="iv">${data.product}</span>
        ${data.imeiNumber ? `<span class="is" style="font-family:monospace;font-size:8.5px;color:#6366f1">IMEI: ${data.imeiNumber}</span>` : ''}
        ${murabahaLine}
      </div>
      <div class="ic">
        <span class="il">Start Date · آغاز</span>
        <span class="iv">${startDate}</span>
        <span class="il" style="margin-top:4px">End Date · اختتام</span>
        <span class="iv">${endDate}</span>
      </div>
      <div class="ic">
        <span class="il">Duration · مدت</span>
        <span class="iv">${data.months} ${isDaily ? 'days · دن' : 'months · ماہ'}</span>
        <span class="il" style="margin-top:4px">${isDaily ? 'Daily · روزانہ' : 'Monthly · ماہانہ'}</span>
        <span class="iv" style="color:#1d4ed8">${pkr(data.monthly)}</span>
      </div>
    </div>

    <!-- ═══ AMOUNTS STRIP ═══ -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-bottom:6px">
      <div class="ac">
        <span class="al">Total · کل قیمت</span>
        <span class="av">${pkr(data.totalAmount)}</span>
        ${isMurabaha ? `<span style="font-size:8px;color:#94a3b8;display:block;margin-top:1px">${pkr(data.cashPrice!)}+${pkr(markup)}</span>` : ''}
      </div>
      <div class="ac">
        <span class="al">Down · پیشگی</span>
        <span class="av">${pkr(data.downPayment)}</span>
      </div>
      <div class="ac hl">
        <span class="al">${isDaily ? 'Daily · روزانہ' : 'Monthly · ماہانہ'}</span>
        <span class="av">${pkr(data.monthly)}</span>
      </div>
      <div class="ac rm">
        <span class="al">Remaining · باقی</span>
        <span class="av">${pkr(data.remaining)}</span>
      </div>
    </div>

    ${data.paymentSummary ? `
    <!-- ═══ PAYMENT PROGRESS BAND ═══ -->
    <div class="progress-band">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-bottom:8px">
        <div class="prog-card prog-blue">
          <span class="prog-label">${isDaily ? 'This Day · یہ دن' : 'This Month · یہ ماہ'}</span>
          <span class="prog-num">#${data.paymentSummary.currentMonth}</span>
          <span class="prog-sub">of ${data.paymentSummary.totalMonths} ${isDaily ? 'days' : 'months'}</span>
        </div>
        <div class="prog-card prog-green">
          <span class="prog-label">Paid · ادا شدہ</span>
          <span class="prog-num">${data.paymentSummary.paidMonths}</span>
          <span class="prog-sub">${isDaily ? 'days' : 'months'} complete</span>
        </div>
        <div class="prog-card prog-amber">
          <span class="prog-label">Pending · باقی</span>
          <span class="prog-num">${pendingMonths}</span>
          <span class="prog-sub">${isDaily ? 'days' : 'months'} left</span>
        </div>
      </div>
      <div style="background:rgba(0,0,0,.15);border-radius:20px;height:8px;overflow:hidden">
        <div style="background:linear-gradient(90deg,#34d399,#10b981);height:100%;width:${pctPaid}%;border-radius:20px;transition:width .3s"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:4px">
        <span style="font-size:8px;color:#34d399;font-weight:700">${data.paymentSummary.paidMonths} paid (${pctPaid}%)</span>
        <span style="font-size:8px;color:rgba(255,255,255,.4)">${data.paymentSummary.totalMonths} total ${isDaily ? 'days' : 'months'}</span>
      </div>
    </div>` : ''}

    <!-- ═══ SCHEDULE ═══ -->
    ${scheduleSection}

    ${payAccounts}

    <!-- ═══ TERMS ═══ -->
    <div style="background:#fafbff;border:1px solid #e2e8f0;border-left:3px solid #6366f1;border-radius:0 4px 4px 0;padding:6px 9px;margin-bottom:6px;font-size:8px;color:#475569;line-height:1.6">
      <div style="font-weight:700;color:#0f172a;font-size:8.5px;margin-bottom:3px">Terms &amp; Conditions · <span style="font-family:'Noto Nastaliq Urdu',serif;font-size:10px;font-weight:400">شرائط و ضوابط</span></div>
      1. ${isDaily ? 'Daily' : 'Monthly'} installment of <strong>${pkr(data.monthly)}</strong> is due on the dates listed. &nbsp;·&nbsp; قسط مقررہ تاریخ پر ادا کرنا لازمی ہے۔<br/>
      2. Default of 2+ installments entitles seller to repossess product without notice. &nbsp;·&nbsp; دو اقساط نہ دینے پر سامان واپس لیا جا سکتا ہے۔<br/>
      3. Product remains property of <strong>${data.shop.shopName}</strong> until full payment received.
    </div>

    <!-- ═══ SIGNATURES ═══ -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:6px">
      ${[
        { label: 'Seller / دکاندار', sub: data.shop.shopName },
        { label: 'Customer / گاہک', sub: data.customer.name },
        { label: 'Witness / گواہ', sub: 'Name & CNIC' },
      ].map(s => `
        <div style="border:1px solid #e2e8f0;border-radius:6px;padding:6px;background:#f8fafc">
          <div style="height:30px"></div>
          <div style="border-top:1px solid #94a3b8;padding-top:4px;font-size:8px;color:#475569;text-align:center">
            ${s.label}<br/><span style="font-size:7px;color:#94a3b8">${s.sub}</span>
          </div>
        </div>`).join('')}
    </div>

    <!-- ═══ FOOTER ═══ -->
    <div style="padding-top:5px;border-top:2px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:9px;font-weight:700;color:#1e3a5f">${data.shop.shopName}</div>
        <div style="font-size:8px;color:#94a3b8">${data.shop.phone}</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:7.5px;color:#c7d2fe;font-weight:700;letter-spacing:1px">ASSAAN ELECTRONICS</div>
        <div style="font-size:7px;color:#e2e8f0">آسان اقساط · Easy Installments</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:8px;color:#94a3b8">Ref: ${data.installmentId.slice(0, 8).toUpperCase()}</div>
        <div style="font-size:8px;color:#94a3b8">${fmtDate(new Date())}</div>
      </div>
    </div>

  </div>`; }

  const html = `<!DOCTYPE html>
<html lang="ur" dir="ltr">
<head>
<meta charset="UTF-8"/>
<title>${invoiceNo}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',system-ui,Arial,sans-serif;background:#e8edf5;padding:20px;display:flex;justify-content:center;align-items:flex-start;min-height:100vh}

  .inv{background:#fff;width:700px;padding:14px 16px;font-size:10.5px;color:#374151;border-radius:8px;box-shadow:0 4px 24px rgba(15,23,42,.12);overflow:hidden}

  /* ── Header ── */
  .hdr{display:flex;align-items:center;gap:10px;padding:11px 14px 9px;
    background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 55%,#1e40af 100%);
    border-radius:6px 6px 0 0;margin:-14px -16px 10px;position:relative;overflow:hidden}
  .hdr::before{content:'';position:absolute;top:-20px;right:80px;width:120px;height:120px;
    background:rgba(255,255,255,.04);border-radius:50%}
  .hdr::after{content:'';position:absolute;bottom:-30px;left:40px;width:80px;height:80px;
    background:rgba(96,165,250,.08);border-radius:50%}

  /* ── Pills ── */
  .pill{display:inline-block;padding:2px 8px;border-radius:20px;font-size:8.5px;font-weight:700;letter-spacing:.3px}
  .pill-orange{background:#fed7aa;color:#9a3412}
  .pill-green{background:#d1fae5;color:#065f46}
  .pill-gray{background:rgba(255,255,255,.12);color:rgba(255,255,255,.7);border:1px solid rgba(255,255,255,.15)}

  /* ── Customer card ── */
  .customer-card{background:linear-gradient(135deg,#1e3a5f,#1d4ed8);border-radius:7px;padding:10px 14px;margin-bottom:8px;position:relative;overflow:hidden}
  .customer-card::before{content:'';position:absolute;top:-15px;right:-15px;width:90px;height:90px;background:rgba(255,255,255,.05);border-radius:50%}

  /* ── Status badge large ── */
  .status-badge-lg{display:inline-block;padding:3px 10px;border-radius:20px;font-size:9px;font-weight:800;letter-spacing:.5px;text-transform:uppercase}
  .status-ACTIVE{background:#d1fae5;color:#065f46}
  .status-COMPLETED{background:#dbeafe;color:#1e40af}
  .status-DEFAULTED{background:#fee2e2;color:#991b1b}
  .status-CANCELLED,.status-CLOSED{background:#f1f5f9;color:#64748b}
  .status-PENDING{background:#fef3c7;color:#92400e}

  /* ── Info cells ── */
  .ic{background:#f8fafc;border:1px solid #e2e8f0;border-radius:5px;padding:5px 7px;overflow:hidden}
  .il{display:block;font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#94a3b8;margin-bottom:2px}
  .iv{display:block;font-size:10.5px;font-weight:700;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .is{display:block;font-size:8.5px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}

  /* ── Amount cards ── */
  .ac{background:#f8fafc;border:1px solid #e2e8f0;border-radius:5px;padding:6px 8px;text-align:center}
  .ac.hl{background:linear-gradient(135deg,#1d4ed8,#2563eb);border-color:#1d4ed8}
  .ac.rm{background:linear-gradient(135deg,#fffbeb,#fef3c7);border-color:#fcd34d}
  .al{display:block;font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;margin-bottom:2px}
  .ac.hl .al{color:rgba(255,255,255,.7)}
  .ac.rm .al{color:#b45309}
  .av{display:block;font-size:12px;font-weight:800;color:#0f172a}
  .ac.hl .av{color:#fff}
  .ac.rm .av{color:#92400e}

  /* ── Progress band ── */
  .progress-band{background:linear-gradient(135deg,#0f172a,#1e3a5f);border-radius:7px;padding:10px 12px;margin-bottom:7px}
  .prog-card{border-radius:6px;padding:6px 4px;text-align:center;border:1px solid rgba(255,255,255,.1)}
  .prog-blue{background:rgba(59,130,246,.2)}
  .prog-green{background:rgba(16,185,129,.2)}
  .prog-amber{background:rgba(245,158,11,.2)}
  .prog-label{display:block;font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:rgba(255,255,255,.55);margin-bottom:2px}
  .prog-num{display:block;font-size:18px;font-weight:900;line-height:1.1}
  .prog-blue .prog-num{color:#60a5fa}
  .prog-green .prog-num{color:#34d399}
  .prog-amber .prog-num{color:#fbbf24}
  .prog-sub{display:block;font-size:7.5px;color:rgba(255,255,255,.4);margin-top:1px}

  @media print{
    @page{size:A4 portrait;margin:6mm 8mm}
    body{background:#fff;padding:0;display:block}
    .inv{border-radius:0;box-shadow:none;width:100%}
    .hdr{border-radius:0}
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

export interface LegalNoticeData {
  shop: { shopName: string; phone: string; address?: string | null };
  customer: { name: string; phone: string; cnic?: string | null; address?: string | null; area?: string | null };
  product: string;
  imeiNumber?: string | null;
  totalAmount: string | number;
  downPayment: string | number;
  remaining: string | number;
  invoiceNumber?: string | null;
  startDate: string;
  daysOverdue: number;
  issuedBy?: string | null;
}

export function openLegalNotice(data: LegalNoticeData) {
  const today     = fmtDate(new Date());
  const deadline  = fmtDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  const invoiceNo = data.invoiceNumber ?? 'N/A';
  const outstandingAmt = pkr(data.remaining);
  const totalAmt       = pkr(data.totalAmount);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Legal Notice — ${data.customer.name}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;600&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Times New Roman',serif;background:#fff;padding:30px;color:#111;font-size:12px;line-height:1.7;max-width:720px;margin:auto}
  .header{text-align:center;border-bottom:3px solid #111;padding-bottom:12px;margin-bottom:18px}
  .shop-name{font-size:20px;font-weight:700;letter-spacing:1px;text-transform:uppercase}
  .shop-sub{font-size:11px;color:#333;margin-top:2px}
  .notice-title{font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:2px;margin:14px 0 4px;text-align:center;text-decoration:underline}
  .notice-title-ur{font-family:'Noto Nastaliq Urdu',serif;font-size:17px;direction:rtl;text-align:center;color:#333;margin-bottom:14px}
  .meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;margin-bottom:16px;padding:10px 12px;background:#f9f9f9;border:1px solid #ddd;border-radius:3px}
  .ml{font-size:10px;color:#555;font-weight:700;text-transform:uppercase}
  .mv{font-size:11.5px;font-weight:600;color:#111}
  p{margin-bottom:10px;text-align:justify}
  .amount{font-weight:700;font-size:13px}
  .deadline{font-weight:700;color:#b91c1c;font-size:13px}
  .ur-para{font-family:'Noto Nastaliq Urdu',serif;font-size:14px;direction:rtl;text-align:right;background:#fafafa;padding:8px 12px;border-right:3px solid #111;margin-bottom:10px;line-height:2}
  .sig-grid{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:30px}
  .sig-line{border-top:1px solid #333;padding-top:4px;font-size:10px;color:#444;text-align:center}
  .footer{margin-top:16px;font-size:9.5px;color:#666;text-align:center;border-top:1px solid #ddd;padding-top:8px}
  @media print{
    @page{size:A4 portrait;margin:15mm 18mm}
    body{padding:0;max-width:100%}
  }
</style>
</head>
<body>
  <div class="header">
    <div class="shop-name">${data.shop.shopName}</div>
    <div class="shop-sub">${data.shop.phone}${data.shop.address ? ' · ' + data.shop.address : ''}</div>
  </div>

  <div class="notice-title">Legal Notice / قانونی نوٹس</div>
  <div class="notice-title-ur">بذریعہ اطلاع قانونی تقاضا</div>

  <div class="meta-grid">
    <div><div class="ml">Date Issued</div><div class="mv">${today}</div></div>
    <div><div class="ml">Response Deadline</div><div class="mv deadline">${deadline}</div></div>
    <div><div class="ml">Invoice No.</div><div class="mv">${invoiceNo}</div></div>
    <div><div class="ml">Days Overdue</div><div class="mv" style="color:#b91c1c">${data.daysOverdue} days</div></div>
    <div><div class="ml">To (Defaulter)</div><div class="mv">${data.customer.name}</div></div>
    <div><div class="ml">Phone</div><div class="mv">${data.customer.phone}</div></div>
    ${data.customer.cnic ? `<div><div class="ml">CNIC</div><div class="mv">${data.customer.cnic}</div></div>` : ''}
    ${data.customer.address || data.customer.area ? `<div><div class="ml">Address</div><div class="mv">${data.customer.address ?? data.customer.area}</div></div>` : ''}
    <div><div class="ml">Product</div><div class="mv">${data.product}</div></div>
    ${data.imeiNumber ? `<div><div class="ml">IMEI</div><div class="mv" style="font-family:monospace">${data.imeiNumber}</div></div>` : ''}
    <div><div class="ml">Total Amount</div><div class="mv">${totalAmt}</div></div>
    <div><div class="ml">Outstanding Balance</div><div class="mv" style="color:#b91c1c">${outstandingAmt}</div></div>
  </div>

  <p>This legal notice is being served upon you, <strong>${data.customer.name}</strong>, residing at ${data.customer.address ?? data.customer.area ?? 'the address known to us'}, regarding your failure to fulfill the installment payment obligations under the agreement dated <strong>${fmtDate(new Date(data.startDate))}</strong> (Invoice: ${invoiceNo}).</p>

  <p>Under the said agreement, you had agreed to purchase <strong>${data.product}</strong>${data.imeiNumber ? ` (IMEI: ${data.imeiNumber})` : ''} on installment basis for a total amount of <span class="amount">${totalAmt}</span>. As of today, <strong>${today}</strong>, you have failed to make payment for <strong>${data.daysOverdue} days</strong> and an outstanding balance of <span class="amount">${outstandingAmt}</span> remains unpaid.</p>

  <p>You are hereby formally demanded and required to pay the outstanding amount of <span class="amount deadline">${outstandingAmt}</span> within <strong>7 (seven) days</strong> from the date of this notice — on or before <span class="deadline">${deadline}</span>.</p>

  <p>Failure to comply within the stipulated time will compel us to initiate legal proceedings against you under applicable laws, including recovery of the full outstanding amount plus legal costs. Additionally, the device (${data.product}) may be repossessed as per the agreement terms.</p>

  <div class="ur-para">
    مطلع کیا جاتا ہے کہ آپ نے اقساطی معاہدہ بمطابق انوائس نمبر ${invoiceNo} کے تحت ادائیگی میں ${data.daysOverdue} دن کی تاخیر کی ہے۔ واجب الادا رقم ${outstandingAmt} ہے۔ آپ کو ہدایت دی جاتی ہے کہ اس نوٹس کی تاریخ سے 7 دن کے اندر اندر یعنی ${deadline} تک مکمل رقم ادا کریں۔ بصورت دیگر قانونی کارروائی کی جائے گی اور سامان واپس لیا جا سکتا ہے۔
  </div>

  <p style="font-size:10.5px;color:#555">This notice is being issued without prejudice to all other rights and remedies available to ${data.shop.shopName} under law and the agreement.${data.issuedBy ? ` Issued by: ${data.issuedBy}.` : ''}</p>

  <div class="sig-grid">
    <div class="sig-line">
      Authorized Signatory · ${data.shop.shopName}<br/>
      <span style="font-family:'Noto Nastaliq Urdu',serif;font-size:11px">مجاز نمائندہ دستخط</span>
    </div>
    <div class="sig-line">
      Stamp / مہر
    </div>
  </div>

  <div class="footer">
    ${data.shop.shopName} · ${data.shop.phone}${data.shop.address ? ' · ' + data.shop.address : ''} · Issued: ${today}
  </div>
<script>window.onload=()=>window.print();</script>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=840,height=1000');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

export async function openCashSaleBill(data: CashSaleBillData) {
  const invoiceNo = `CS-${data.saleId.slice(0, 6).toUpperCase()}`;
  const saleDate  = fmtDate(data.soldAt);
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
