import QRCode from 'qrcode';

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

const STATUS_UR: Record<string, string> = {
  ACTIVE: 'فعال', COMPLETED: 'مکمل', DEFAULTED: 'ڈیفالٹ',
  CANCELLED: 'منسوخ', PENDING: 'زیر التواء', CLOSED: 'بند',
};

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

  const isMurabaha = data.murabahaMode && data.cashPrice != null && Number(data.cashPrice) > 0;
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
    errorCorrectionLevel: 'M', margin: 1, width: 120,
    color: { dark: '#0f172a', light: '#ffffff' },
  });

  const scheduleRows = schedule.map((r) => `
    <tr>
      <td style="padding:7px 12px;color:#374151;border-bottom:1px solid #f3f4f6;text-align:center">${r.month}</td>
      <td style="padding:7px 12px;color:#374151;border-bottom:1px solid #f3f4f6">${r.due}</td>
      <td style="padding:7px 12px;text-align:right;border-bottom:1px solid #f3f4f6;font-weight:600;color:#374151">${r.amount}</td>
      <td style="padding:7px 12px;text-align:center;border-bottom:1px solid #f3f4f6">
        ${r.paid
          ? '<span style="background:#d1fae5;color:#065f46;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:700">PAID · ادا</span>'
          : '<span style="background:#fef3c7;color:#92400e;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:700">PENDING · باقی</span>'
        }
      </td>
    </tr>`).join('');

  const murabahaBox = isMurabaha ? `
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 18px;margin-bottom:20px">
      <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#166534;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between">
        <span>Murabaha Breakdown</span>
        <span style="font-family:'Noto Nastaliq Urdu',serif;font-size:13px;direction:rtl;text-transform:none;letter-spacing:0">مرابحہ کی تفصیل</span>
      </div>
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <tr>
          <td style="padding:4px 0;color:#374151">Cost Price &nbsp;<span style="font-family:'Noto Nastaliq Urdu',serif;font-size:12px;color:#6b7280">لاگت</span></td>
          <td style="text-align:right;font-weight:600;color:#0f172a">${pkr(data.cashPrice!)}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#374151">Profit Markup${markupPct ? ` (${markupPct}%)` : ''} &nbsp;<span style="font-family:'Noto Nastaliq Urdu',serif;font-size:12px;color:#6b7280">منافع</span></td>
          <td style="text-align:right;font-weight:600;color:#059669">+ ${pkr(markup)}</td>
        </tr>
        <tr style="border-top:1px solid #bbf7d0">
          <td style="padding:8px 0 4px;font-weight:700;color:#0f172a">Murabaha Total &nbsp;<span style="font-family:'Noto Nastaliq Urdu',serif;font-size:12px">مرابحہ قیمت</span></td>
          <td style="padding:8px 0 4px;text-align:right;font-weight:800;color:#0f172a;font-size:14px">${pkr(data.totalAmount)}</td>
        </tr>
      </table>
    </div>` : '';

  const html = `<!DOCTYPE html>
<html lang="ur" dir="ltr">
<head>
<meta charset="UTF-8"/>
<title>${invoiceNo} — ${data.shop.shopName}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;display:flex;justify-content:center;padding:40px 20px}
  .page{background:#fff;width:740px;border-radius:6px;box-shadow:0 4px 24px rgba(0,0,0,.12);overflow:hidden}
  .ur{font-family:'Noto Nastaliq Urdu',serif;direction:rtl;line-height:2}

  .hdr{background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);padding:32px 40px 0;position:relative;overflow:hidden}
  .hdr-circle1{position:absolute;top:-40px;right:-40px;width:160px;height:160px;border-radius:50%;background:rgba(255,255,255,.04)}
  .hdr-circle2{position:absolute;top:16px;right:80px;width:90px;height:90px;border-radius:50%;background:rgba(255,255,255,.04)}
  .hdr-top{display:flex;justify-content:space-between;align-items:flex-start;position:relative}
  .shop-name{font-size:24px;font-weight:900;color:#fff;letter-spacing:.3px;line-height:1}
  .shop-meta{font-size:11px;color:#93c5fd;margin-top:6px;line-height:1.7}
  .inv-badge{text-align:right}
  .inv-badge h2{font-size:22px;font-weight:900;color:#60a5fa;letter-spacing:-0.5px;line-height:1.2}
  .inv-badge h2 .ur-title{font-size:16px;font-weight:700;display:block;margin-top:2px}
  .inv-no{font-size:13px;font-weight:700;color:#fff;margin-top:4px;letter-spacing:.5px}
  .inv-date{font-size:11px;color:#64748b;margin-top:3px}
  .accent-bar{height:4px;background:linear-gradient(90deg,#f59e0b,#3b82f6,#f59e0b);margin:20px -40px 0}
  ${isMurabaha ? '.murabaha-tag{display:inline-block;background:#d1fae5;color:#065f46;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;margin-top:6px;letter-spacing:.3px}' : ''}

  .body{padding:32px 40px;font-size:13px;color:#374151}
  .section{margin-bottom:24px}
  .section-title{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1.2px;color:#94a3b8;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between}
  .section-title::after{content:'';flex:1;height:1px;background:#f1f5f9;margin-left:8px}
  .sec-ur{font-family:'Noto Nastaliq Urdu',serif;font-size:12px;text-transform:none;letter-spacing:0;color:#94a3b8;direction:rtl;margin-left:0}

  .info-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
  .info-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px}
  .info-box label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#94a3b8;display:block;margin-bottom:2px}
  .info-box .ur-label{font-family:'Noto Nastaliq Urdu',serif;font-size:11px;color:#b0bec5;display:block;direction:rtl;text-align:right;line-height:1.8;margin-bottom:2px}
  .info-box p{font-size:13px;font-weight:600;color:#0f172a;line-height:1.3}
  .info-box small{font-size:11px;color:#64748b}

  .summary-strip{display:flex;gap:20px;align-items:flex-start;margin-bottom:24px}
  .qr-block{text-align:center;flex-shrink:0}
  .qr-block img{border:2px solid #e2e8f0;border-radius:8px;display:block}
  .qr-label{font-size:8px;color:#94a3b8;margin-top:5px;font-weight:600;text-transform:uppercase;letter-spacing:.5px}
  .totals-box{flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 18px}
  .total-row{display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#374151;border-bottom:1px solid #f1f5f9}
  .total-row:last-child{border:none}
  .total-row .ur-lbl{font-family:'Noto Nastaliq Urdu',serif;font-size:11px;color:#9ca3af;margin-right:6px;direction:rtl}
  .total-row.grand{font-size:15px;font-weight:800;color:#0f172a;border-top:2px solid #1d4ed8;margin-top:6px;padding-top:8px}
  .total-row.paid-row{color:#059669;font-weight:600}
  .total-row.rem-row{color:#b45309;font-weight:600}

  .status-badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700}
  .status-ACTIVE{background:#d1fae5;color:#065f46}
  .status-COMPLETED{background:#dbeafe;color:#1e40af}
  .status-DEFAULTED{background:#fee2e2;color:#991b1b}
  .status-CANCELLED,.status-CLOSED{background:#f1f5f9;color:#64748b}
  .status-PENDING{background:#fef3c7;color:#92400e}

  table{width:100%;border-collapse:collapse;font-size:12px}
  thead tr{background:#0f172a}
  thead th{padding:9px 12px;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;text-align:left}
  thead th.ur-th{font-family:'Noto Nastaliq Urdu',serif;text-transform:none;letter-spacing:0;font-size:12px;direction:rtl;text-align:right}
  .sched-scroll{max-height:260px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:8px}

  .legal{border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:20px}
  .legal-en{padding:14px 18px;background:#fff}
  .legal-ur{padding:14px 18px;background:#fafbff;border-top:1px solid #e2e8f0;direction:rtl;text-align:right}
  .legal-title{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:8px}
  .legal-ur-title{font-family:'Noto Nastaliq Urdu',serif;font-size:13px;font-weight:700;color:#334155;margin-bottom:8px;text-transform:none;letter-spacing:0}
  .legal ol{padding-left:16px;font-size:11px;color:#64748b;line-height:1.9}
  .legal strong{color:#334155}
  .legal-ur ol{padding-right:16px;padding-left:0;font-family:'Noto Nastaliq Urdu',serif;font-size:13px;color:#64748b;line-height:2.2}
  .legal-ur strong{color:#334155}

  .sig-row{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:20px}
  .sig-box{border-top:1px solid #94a3b8;padding-top:8px;font-size:10px;color:#94a3b8;text-align:center}
  .sig-box .ur-sig{font-family:'Noto Nastaliq Urdu',serif;font-size:12px;display:block;direction:rtl;margin-top:2px}

  .page-footer{border-top:2px solid #f1f5f9;padding:14px 40px;display:flex;justify-content:space-between;align-items:center;background:#f8fafc}
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

  <!-- HEADER -->
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
        ${isMurabaha ? '<div class="murabaha-tag">Murabaha · مرابحہ</div>' : ''}
      </div>
      <div class="inv-badge">
        <h2>INVOICE<span class="ur-title ur">اقساط نامہ</span></h2>
        <div class="inv-no">${invoiceNo}</div>
        <div class="inv-date">Printed: ${printDate}</div>
      </div>
    </div>
    <div class="accent-bar"></div>
  </div>

  <div class="body">

    <!-- CUSTOMER & PLAN -->
    <div class="section">
      <div class="section-title">
        Customer &amp; Installment Details
        <span class="sec-ur">گاہک اور قسط کی تفصیلات</span>
        <span></span>
      </div>
      <div class="info-grid">
        <div class="info-box">
          <label>Customer</label>
          <span class="ur-label">گاہک</span>
          <p>${data.customer.name}</p>
          <small>${data.customer.phone}</small>
          ${data.customer.area ? `<small style="color:#6b7280">📍 ${data.customer.area}</small>` : ''}
        </div>
        <div class="info-box">
          <label>Product</label>
          <span class="ur-label">مصنوعہ</span>
          <p>${data.product}</p>
          ${data.imeiNumber ? `<small style="font-family:monospace;font-size:10px;color:#64748b">IMEI: ${data.imeiNumber}</small>` : ''}
        </div>
        <div class="info-box">
          <label>Status</label>
          <span class="ur-label">حیثیت</span>
          <p>
            <span class="status-badge status-${data.status}">${data.status}</span>
            <span class="ur" style="font-size:11px;color:#64748b;margin-right:4px">${STATUS_UR[data.status] ?? data.status}</span>
          </p>
        </div>
        <div class="info-box">
          <label>Start Date</label>
          <span class="ur-label">آغاز تاریخ</span>
          <p>${startDate}</p>
        </div>
        <div class="info-box">
          <label>End Date</label>
          <span class="ur-label">اختتام تاریخ</span>
          <p>${endDate}</p>
        </div>
        <div class="info-box">
          <label>Duration</label>
          <span class="ur-label">مدت</span>
          <p>${data.months} months <span class="ur" style="font-size:11px;color:#64748b">${data.months} ماہ</span></p>
          <small>${pkr(data.monthly)} / month <span class="ur" style="font-size:10px">ماہانہ</span></small>
        </div>
      </div>
    </div>

    <!-- MURABAHA BREAKDOWN (if applicable) -->
    ${murabahaBox}

    <!-- QR + TOTALS -->
    <div class="summary-strip">
      <div class="qr-block">
        <img src="${qrDataUrl}" width="110" height="110" alt="QR"/>
        <div class="qr-label">Scan to verify · تصدیق</div>
      </div>
      <div class="totals-box">
        <div class="total-row">
          <span><span class="ur-lbl">کل قیمت</span>Total Price</span>
          <span>${pkr(data.totalAmount)}</span>
        </div>
        <div class="total-row">
          <span><span class="ur-lbl">پیشگی رقم</span>Down Payment</span>
          <span>${pkr(data.downPayment)}</span>
        </div>
        <div class="total-row">
          <span><span class="ur-lbl">ماہانہ × ${data.months}</span>Monthly × ${data.months}</span>
          <span>${pkr(data.monthly)} / mo</span>
        </div>
        <div class="total-row paid-row">
          <span><span class="ur-lbl">ادا شدہ</span>Total Paid</span>
          <span>${pkr(paid)}</span>
        </div>
        <div class="total-row rem-row">
          <span><span class="ur-lbl">باقی رقم</span>Remaining</span>
          <span>${pkr(data.remaining)}</span>
        </div>
        <div class="total-row grand">
          <span><span class="ur-lbl" style="font-size:12px">معاہدہ</span>Contract Value</span>
          <span>${pkr(data.totalAmount)}</span>
        </div>
      </div>
    </div>

    <!-- PAYMENT SCHEDULE -->
    <div class="section">
      <div class="section-title">
        Monthly Payment Schedule
        <span class="sec-ur">ماہانہ ادائیگی کا شیڈول</span>
        <span></span>
      </div>
      <div class="sched-scroll">
        <table>
          <thead>
            <tr>
              <th style="text-align:center"># <span class="ur-th">نمبر</span></th>
              <th>Due Date <span class="ur-th">تاریخ</span></th>
              <th style="text-align:right">Amount <span class="ur-th">رقم</span></th>
              <th style="text-align:center">Status <span class="ur-th">صورتحال</span></th>
            </tr>
          </thead>
          <tbody>${scheduleRows}</tbody>
        </table>
      </div>
    </div>

    <!-- TERMS & CONDITIONS — bilingual -->
    <div class="legal">
      <div class="legal-en">
        <div class="legal-title">Terms &amp; Conditions</div>
        <ol>
          <li>The customer <strong>${data.customer.name}</strong> agrees to pay <strong>${pkr(data.monthly)}</strong> on or before the due date each month without delay.</li>
          <li>The product <strong>"${data.product}"</strong> remains the sole property of <strong>${data.shop.shopName}</strong> until all installments are fully paid.</li>
          ${data.imeiNumber ? `<li>IMEI <strong>${data.imeiNumber}</strong> is registered against this agreement. The product cannot be sold or transferred while installments are outstanding.</li>` : ''}
          <li>Default exceeding 30 days may trigger legal recovery. All guarantors are jointly liable for the outstanding balance of <strong>${pkr(data.remaining)}</strong>.</li>
          <li>Any damage, loss, or theft of the product while installments are pending is the sole responsibility of the buyer.</li>
          ${isMurabaha
            ? `<li>This agreement is structured as <strong>Murabaha</strong> — the seller purchased the product at <strong>${pkr(data.cashPrice!)}</strong> and disclosed a profit of <strong>${pkr(markup)}</strong>, making the total price <strong>${pkr(data.totalAmount)}</strong>. No hidden interest is charged.</li>`
            : '<li>Early settlement is permitted at any time; any markup adjustment is at the discretion of <strong>' + data.shop.shopName + '</strong>.</li>'}
          <li>This invoice (<strong>${invoiceNo}</strong>) is a legally binding document. Scan the QR code to verify authenticity.</li>
        </ol>
      </div>
      <div class="legal-ur">
        <div class="legal-ur-title">قواعد و شرائط</div>
        <ol>
          <li>گاہک <strong>${data.customer.name}</strong> اس بات کے پابند ہیں کہ وہ ہر ماہ مقررہ تاریخ پر <strong>${pkr(data.monthly)}</strong> ادا کریں گے۔</li>
          <li>مصنوعہ "<strong>${data.product}</strong>" <strong>${data.shop.shopName}</strong> کی ملکیت رہے گا جب تک تمام اقساط ادا نہ ہو جائیں۔</li>
          ${data.imeiNumber ? `<li>آئی ایم ای آئی <strong>${data.imeiNumber}</strong> اس معاہدے سے منسلک ہے۔ اقساط کی ادائیگی مکمل ہونے سے پہلے مصنوعہ فروخت یا منتقل نہیں کیا جا سکتا۔</li>` : ''}
          <li>30 دن کی تاخیر کی صورت میں قانونی کارروائی کی جا سکتی ہے۔ تمام ضامن باقی رقم <strong>${pkr(data.remaining)}</strong> کے مشترکہ طور پر ذمہ دار ہوں گے۔</li>
          <li>اقساط کی ادائیگی کے دوران مصنوعہ کا نقصان، ٹوٹ پھوٹ یا چوری خریدار کی ذمہ داری ہے۔</li>
          ${isMurabaha
            ? `<li>یہ معاہدہ <strong>مرابحہ</strong> کی بنیاد پر ہے — بیچنے والے نے مصنوعہ <strong>${pkr(data.cashPrice!)}</strong> میں خریدا اور <strong>${pkr(markup)}</strong> منافع ظاہر کر کے کل قیمت <strong>${pkr(data.totalAmount)}</strong> مقرر کی۔ کوئی چھپا ہوا سود نہیں لیا جاتا۔</li>`
            : `<li>وقت سے پہلے مکمل ادائیگی جائز ہے۔ منافع کی واپسی <strong>${data.shop.shopName}</strong> کی صوابدید پر ہے۔</li>`}
          <li>یہ دستاویز (<strong>${invoiceNo}</strong>) ایک قانونی مالیاتی معاہدہ ہے۔ صداقت کی تصدیق کے لیے QR کوڈ اسکین کریں۔</li>
        </ol>
      </div>
    </div>

    <!-- SIGNATURE ROW -->
    <div class="sig-row">
      <div class="sig-box">
        Seller Signature &amp; Stamp
        <span class="ur-sig">دستخط و مہر بائع</span>
      </div>
      <div class="sig-box">
        Customer Signature
        <span class="ur-sig">دستخط گاہک</span>
      </div>
    </div>

  </div>

  <!-- PAGE FOOTER -->
  <div class="page-footer">
    <div>
      <div class="pf-brand">${data.shop.shopName}</div>
      <div style="font-size:10px;color:#94a3b8">
        Thank you for your business · ${data.shop.phone}
        <span class="ur" style="margin-right:8px;font-size:11px">شکریہ</span>
      </div>
    </div>
    <div class="pf-meta">
      <div>Invoice: <strong style="color:#0f172a">${invoiceNo}</strong></div>
      <div>Generated: ${new Date().toLocaleString('en-PK')}</div>
      <div>Ref: ${data.installmentId.slice(0, 8).toUpperCase()}</div>
    </div>
  </div>

</div>
<script>window.onload = () => window.print();</script>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=840,height=980');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
