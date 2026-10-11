import QRCode from 'qrcode';
import { fmtDate } from './dateFormat.ts';
import { getPrintPalette } from './printTheme.ts';

export interface DeliveryChallanData {
  shop: { shopName: string; phone: string; address?: string | null; logoUrl?: string | null; theme?: string | null };
  slipNumber: string;
  saleType: 'CASH' | 'INSTALLMENT';
  customerName: string;
  customerPhone?: string | null;
  deliveryAddress: string;
  productName: string;
  quantity: number;
  serialSnapshot?: string | null;
  driverName: string;
  driverPhone?: string | null;
  scheduledDate?: string | null;
  createdAt: string;
  signatureUrl?: string | null;
  conditionNote?: string | null;
}

export async function openDeliveryChallan(data: DeliveryChallanData) {
  const palette = getPrintPalette(data.shop.theme);
  const date    = fmtDate(data.createdAt);

  const qrPayload = [
    `SLIP:${data.slipNumber}`,
    `SHOP:${data.shop.shopName}`,
    `CUST:${data.customerName}`,
    `PROD:${data.productName} x${data.quantity}`,
    ...(data.serialSnapshot ? [`SERIAL:${data.serialSnapshot}`] : []),
    `DRIVER:${data.driverName}`,
  ].join('\n');

  const qrDataUrl = await QRCode.toDataURL(qrPayload, {
    errorCorrectionLevel: 'M', margin: 1, width: 100,
    color: { dark: '#171C28', light: '#ffffff' },
  });

  const css = `
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;padding:20px;display:flex;justify-content:center}
    .inv{background:#fff;width:680px;padding:13px 16px;font-size:10.5px;color:#374151;border:1px solid #e2e8f0}
    .hdr{display:flex;align-items:center;gap:8px;padding:9px 11px 7px;background:linear-gradient(135deg,${palette.navy900},${palette.navy800});border-radius:4px 4px 0 0;margin:-13px -16px 9px}
    .ic{background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:4px 6px;overflow:hidden}
    .il{display:block;font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;margin-bottom:1px}
    .iv{display:block;font-size:10.5px;font-weight:600;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .is{display:block;font-size:9px;color:#64748b}
    @media print{
      @page{size:A5 landscape;margin:5mm 7mm}
      body{background:#fff;padding:0}
      .inv{border:none;width:100%}
    }
  `;

  const saleTypeLabel = data.saleType === 'CASH' ? 'Cash Sale · نقد فروخت' : 'Installment · اقساط';

  const signatureBlock = data.signatureUrl
    ? `<div style="text-align:center">
         <img src="${data.signatureUrl}" style="max-height:48px;max-width:220px;object-fit:contain" alt="signature"/>
         <div style="border-top:1px solid #94a3b8;padding-top:3px;font-size:9px;color:#94a3b8">Customer Signature · دستخط گاہک (received)</div>
       </div>`
    : `<div style="border-top:1px solid #94a3b8;padding-top:30px;font-size:9px;color:#94a3b8;text-align:center">
         Customer Signature · <span style="font-family:'Noto Nastaliq Urdu',serif;font-size:10px">دستخط گاہک</span>
       </div>`;

  const htmlContent = `<!DOCTYPE html>
<html lang="ur" dir="ltr">
<head>
<meta charset="UTF-8"/>
<title>${data.slipNumber}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;600&display=swap" rel="stylesheet">
<style>${css}</style>
</head>
<body>
<div class="inv">
  <div class="hdr">
    <div style="flex:1;min-width:0;display:flex;align-items:center;gap:8px">
      ${data.shop.logoUrl ? `<img src="${data.shop.logoUrl}" style="width:30px;height:30px;object-fit:contain;border-radius:6px;background:#fff;padding:2px;flex-shrink:0" alt="logo"/>` : ''}
      <div style="min-width:0">
        <div style="font-size:14px;font-weight:900;color:#fff;line-height:1">${data.shop.shopName}</div>
        <div style="font-size:9.5px;color:${palette.blue300};margin-top:2px">${data.shop.phone}${data.shop.address ? ` · ${data.shop.address}` : ''}</div>
        <span style="font-size:9px;font-weight:700;background:#fef3c7;color:#92400e;padding:1px 7px;border-radius:20px;margin-top:4px;display:inline-block">${saleTypeLabel}</span>
      </div>
    </div>
    <div style="text-align:right;flex-shrink:0;margin:0 10px">
      <div style="font-size:13px;font-weight:900;color:${palette.blue400}">DELIVERY SLIP <span style="font-family:'Noto Nastaliq Urdu',serif;font-size:11px">ترسیل پرچی</span></div>
      <div style="font-size:11px;font-weight:700;color:#fff;margin-top:1px">${data.slipNumber}</div>
      <div style="font-size:9px;color:#94a3b8;margin-top:1px">${date}</div>
    </div>
    <div style="flex-shrink:0">
      <img src="${qrDataUrl}" width="58" height="58" style="border:1px solid rgba(255,255,255,.2);border-radius:4px;display:block" alt="QR"/>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:6px">
    <div class="ic">
      <span class="il">Customer · گاہک</span>
      <span class="iv">${data.customerName}</span>
      ${data.customerPhone ? `<span class="is">${data.customerPhone}</span>` : ''}
      <span class="is">${data.deliveryAddress}</span>
    </div>
    <div class="ic">
      <span class="il">Item · سامان</span>
      <span class="iv">${data.productName}${data.quantity > 1 ? ` ×${data.quantity}` : ''}</span>
      ${data.serialSnapshot ? `<span class="is" style="font-family:monospace;font-size:9px;color:${palette.indigo500}">Serial/IMEI: ${data.serialSnapshot}</span>` : ''}
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:6px">
    <div class="ic">
      <span class="il">Driver / Loader · ڈرائیور</span>
      <span class="iv">${data.driverName}</span>
      ${data.driverPhone ? `<span class="is">${data.driverPhone}</span>` : ''}
    </div>
    <div class="ic">
      <span class="il">Scheduled · مقررہ تاریخ</span>
      <span class="iv">${data.scheduledDate ? fmtDate(data.scheduledDate) : 'ASAP'}</span>
    </div>
  </div>

  ${data.conditionNote ? `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:4px 8px;margin-bottom:6px;font-size:9.5px;color:#374151"><strong>Note:</strong> ${data.conditionNote}</div>` : ''}

  <div style="background:#eff6ff;border:1px solid ${palette.skyBorder};border-radius:4px;padding:5px 8px;margin-bottom:8px;font-size:9px;color:${palette.skyText}">
    Customer ko guzarish hai k samaan check kar k receive karein, phir neeche dastkhat karein. Please inspect the item before signing below.
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:10px">
    <div style="border-top:1px solid #94a3b8;padding-top:4px;font-size:9px;color:#94a3b8;text-align:center">
      Driver Signature · <span style="font-family:'Noto Nastaliq Urdu',serif;font-size:10px">دستخط ڈرائیور</span>
    </div>
    ${signatureBlock}
  </div>

  <div style="margin-top:6px;padding-top:5px;border-top:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center">
    <div style="font-size:9px;color:#94a3b8">${data.shop.shopName} · ${data.shop.phone}</div>
    <div style="font-size:9px;color:#94a3b8">Slip: ${data.slipNumber} · ${date}</div>
  </div>
</div>
<script>window.onload=()=>window.print();</script>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=840,height=600');
  if (!w) return;
  w.document.write(htmlContent);
  w.document.close();
}
