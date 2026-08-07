// Vehicle payment receipt + sale deed print utilities

function openPrint(html: string, w = 620, h = 800) {
  const win = window.open('', '_blank', `width=${w},height=${h},scrollbars=yes`);
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

const pkr = (n: number) =>
  'PKR ' + n.toLocaleString('en-PK', { maximumFractionDigits: 0 });

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  BIKE: 'Motorcycle', RICKSHAW: 'Auto Rickshaw', LOADER_RICKSHAW: 'Loader Rickshaw',
  ELECTRIC_BIKE: 'Electric Bike', ELECTRIC_RICKSHAW: 'Electric Rickshaw',
};
const VEHICLE_TYPE_ICONS: Record<string, string> = {
  BIKE: '🏍️', RICKSHAW: '🛺', LOADER_RICKSHAW: '🚛',
  ELECTRIC_BIKE: '⚡🏍️', ELECTRIC_RICKSHAW: '⚡🛺',
};

export interface VehiclePaymentReceiptData {
  shopName:         string;
  shopPhone?:       string | null;
  customerName:     string;
  customerPhone?:   string | null;
  customerPhotoUrl?: string | null;
  vehicleLabel:     string;
  vehicleType:      string;
  engineNumber:     string;
  chassisNumber:    string;
  invoiceNumber?:   string | null;
  receiptNumber?:   string | null;
  amountPaid:       number;
  method:           string;
  paidOn:           string;
  note?:            string | null;
  collectorName?:   string | null;
  daysLate?:        number;
  totalAmount?:     number;
  remaining?:       number;
  monthly?:         number;
}

export function openVehiclePaymentReceipt(d: VehiclePaymentReceiptData) {
  const paidOnDate = new Date(d.paidOn);
  const dateStr = paidOnDate.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = paidOnDate.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true });
  const isLate  = (d.daysLate ?? 0) > 0;

  const initials  = d.customerName.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const avatarColors = ['#4f46e5','#0891b2','#059669','#d97706','#dc2626','#7c3aed'];
  const avatarBg  = avatarColors[d.customerName.charCodeAt(0) % avatarColors.length];
  const avatar    = d.customerPhotoUrl
    ? `<img src="${d.customerPhotoUrl}" alt="${d.customerName}" style="width:52px;height:52px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,.25);flex-shrink:0"/>`
    : `<div style="width:52px;height:52px;border-radius:50%;background:${avatarBg};border:2px solid rgba(255,255,255,.25);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:19px;font-weight:800;color:#fff">${initials}</div>`;

  const METHOD_ICONS: Record<string,string> = { CASH:'💵', BANK:'🏦', JAZZCASH:'📱', EASYPAISA:'💚', OTHER:'💳' };
  const methodIcon = METHOD_ICONS[d.method] ?? '💳';
  const typeIcon   = VEHICLE_TYPE_ICONS[d.vehicleType] ?? '🚗';
  const typeLabel  = VEHICLE_TYPE_LABELS[d.vehicleType] ?? d.vehicleType;

  const lateHtml = isLate
    ? `<span style="display:inline-flex;align-items:center;gap:4px;background:#fee2e2;border:1px solid #fca5a5;border-radius:20px;padding:3px 10px;font-size:9px;font-weight:700;color:#991b1b">⚠️ ${d.daysLate} din late</span>`
    : `<span style="display:inline-flex;align-items:center;gap:4px;background:#d1fae5;border:1px solid #6ee7b7;border-radius:20px;padding:3px 10px;font-size:9px;font-weight:700;color:#065f46">✓ On time</span>`;

  const css = `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',system-ui,Arial,sans-serif;background:#e8edf5;padding:20px;display:flex;justify-content:center;min-height:100vh}
.card{background:#fff;width:480px;border-radius:10px;box-shadow:0 4px 24px rgba(15,23,42,.14);overflow:hidden;font-size:10.5px;color:#374151}
.hdr{display:flex;align-items:center;gap:10px;padding:11px 14px 9px;background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 55%,#1e40af 100%);position:relative;overflow:hidden}
.hdr::before{content:'';position:absolute;top:-18px;right:60px;width:100px;height:100px;background:rgba(255,255,255,.04);border-radius:50%}
.cust{background:linear-gradient(135deg,#1e3a5f,#1d4ed8);padding:10px 14px;position:relative;overflow:hidden}
.cust::before{content:'';position:absolute;top:-12px;right:-12px;width:75px;height:75px;background:rgba(255,255,255,.05);border-radius:50%}
.amt-band{background:linear-gradient(135deg,#0f172a,#1e3a5f);padding:12px 16px;text-align:center}
.veh-band{background:#f8fafc;border:1px solid #e2e8f0;margin:10px 14px;border-radius:8px;padding:8px 12px}
.ig{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:10px 14px}
.ic{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:6px 9px}
.il{display:block;font-size:6.5px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#94a3b8;margin-bottom:2px}
.iv{display:block;font-size:10.5px;font-weight:700;color:#0f172a}
.is{display:block;font-size:8.5px;color:#64748b;margin-top:1px}
.foot{padding:8px 14px 10px;border-top:2px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;background:#fafbff}
@media print{
  @page{size:A5 portrait;margin:5mm 7mm}
  body{background:#fff;padding:0;display:block}
  .card{border-radius:0;box-shadow:none;width:100%}
}`;

  const html = `<!DOCTYPE html>
<html lang="ur" dir="ltr">
<head><meta charset="utf-8"/><title>Vehicle Payment Receipt</title><style>${css}</style></head>
<body>
<div class="card">

  <!-- HEADER -->
  <div class="hdr">
    <div style="flex:1;min-width:0">
      <div style="font-size:13px;font-weight:900;color:#fff;line-height:1.1">${d.shopName}</div>
      ${d.shopPhone ? `<div style="font-size:8.5px;color:#93c5fd;margin-top:2px">${d.shopPhone}</div>` : ''}
      <div style="margin-top:4px">
        <span style="display:inline-block;padding:2px 8px;border-radius:20px;font-size:8px;font-weight:700;background:rgba(255,255,255,.12);color:rgba(255,255,255,.75);border:1px solid rgba(255,255,255,.15)">${typeIcon} Vehicle Finance Receipt · قبض</span>
      </div>
    </div>
    <div style="text-align:right;flex-shrink:0">
      <div style="font-size:10px;font-weight:800;color:#60a5fa;letter-spacing:1px">RECEIPT</div>
      ${d.receiptNumber ? `<div style="font-size:11px;font-weight:700;color:#fff;font-family:monospace;margin-top:1px">${d.receiptNumber}</div>` : ''}
      <div style="font-size:8px;color:#94a3b8;margin-top:3px">${dateStr}</div>
      <div style="font-size:7.5px;color:#64748b;margin-top:1px">${timeStr}</div>
    </div>
  </div>

  <!-- CUSTOMER -->
  <div class="cust">
    <div style="display:flex;align-items:center;gap:10px;position:relative;z-index:1">
      ${avatar}
      <div style="min-width:0;flex:1">
        <div style="font-size:7px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:rgba(255,255,255,.5);margin-bottom:2px">Customer · گاہک</div>
        <div style="font-size:14px;font-weight:800;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.1">${d.customerName}</div>
        ${d.customerPhone ? `<div style="font-size:9.5px;color:#93c5fd;margin-top:3px">${d.customerPhone}</div>` : ''}
      </div>
    </div>
  </div>

  <!-- AMOUNT BAND -->
  <div class="amt-band">
    <div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,.45);margin-bottom:4px">Amount Paid · ادا کردہ رقم</div>
    <div style="font-size:30px;font-weight:900;color:#fff;letter-spacing:-1px;line-height:1">${pkr(d.amountPaid)}</div>
    <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:6px">
      <span style="font-size:10px;color:#93c5fd;font-weight:600">${methodIcon} ${d.method}</span>
      ${lateHtml}
    </div>
  </div>

  <!-- VEHICLE INFO BAND -->
  <div class="veh-band">
    <div style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#94a3b8;margin-bottom:5px">${typeIcon} Vehicle · گاڑی</div>
    <div style="font-size:12px;font-weight:800;color:#0f172a">${d.vehicleLabel}</div>
    <div style="font-size:8.5px;color:#64748b;margin-top:3px">${typeLabel}</div>
    <div style="display:flex;gap:12px;margin-top:6px;flex-wrap:wrap">
      <div><span style="font-size:7px;color:#94a3b8;font-weight:700;text-transform:uppercase">Engine #</span><br/><span style="font-family:monospace;font-size:9px;font-weight:700;color:#1e3a5f">${d.engineNumber}</span></div>
      <div><span style="font-size:7px;color:#94a3b8;font-weight:700;text-transform:uppercase">Chassis #</span><br/><span style="font-family:monospace;font-size:9px;font-weight:700;color:#1e3a5f">${d.chassisNumber}</span></div>
      ${d.invoiceNumber ? `<div><span style="font-size:7px;color:#94a3b8;font-weight:700;text-transform:uppercase">Invoice</span><br/><span style="font-family:monospace;font-size:9px;font-weight:700;color:#7c3aed">${d.invoiceNumber}</span></div>` : ''}
    </div>
  </div>

  <!-- INFO GRID -->
  <div class="ig">
    <div class="ic">
      <span class="il">Payment Date · تاریخ</span>
      <span class="iv">${dateStr}</span>
      <span class="is">${timeStr}</span>
    </div>
    ${d.monthly ? `
    <div class="ic">
      <span class="il">Monthly Qist</span>
      <span class="iv" style="color:#1d4ed8">${pkr(d.monthly)}</span>
    </div>` : ''}
    ${d.totalAmount ? `
    <div class="ic">
      <span class="il">Total Amount · کل رقم</span>
      <span class="iv" style="color:#059669">${pkr(d.totalAmount)}</span>
    </div>` : ''}
    ${d.remaining !== undefined ? `
    <div class="ic">
      <span class="il">Pending · باقی رقم</span>
      <span class="iv" style="color:${(d.remaining ?? 0) <= 0 ? '#059669' : '#d97706'}">${pkr(d.remaining ?? 0)}</span>
      ${(d.remaining ?? 0) <= 0 ? `<span class="is" style="color:#059669">✓ Paid off</span>` : ''}
    </div>` : ''}
    ${d.collectorName ? `
    <div class="ic">
      <span class="il">Collected By</span>
      <span class="iv" style="color:#7c3aed">${d.collectorName}</span>
    </div>` : ''}
    ${d.note ? `
    <div class="ic" style="grid-column:1/-1">
      <span class="il">Note</span>
      <span class="iv" style="font-size:9.5px;font-weight:600;white-space:normal">${d.note}</span>
    </div>` : ''}
  </div>

  <!-- FOOTER -->
  <div class="foot">
    <div>
      <div style="font-size:9px;font-weight:700;color:#1e3a5f">${d.shopName}</div>
      ${d.shopPhone ? `<div style="font-size:8px;color:#94a3b8">${d.shopPhone}</div>` : ''}
    </div>
    <div style="font-size:7px;color:#c7d2fe;font-weight:700;letter-spacing:1px">شکریہ · THANK YOU</div>
    <div style="text-align:right;font-size:7.5px;color:#94a3b8">${dateStr}</div>
  </div>

</div>
<script>window.onload=()=>window.print();</script>
</body>
</html>`;

  openPrint(html, 620, 800);
}
