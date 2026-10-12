import QRCode from 'qrcode';
import { fmtDate } from './dateFormat.ts';
import { getPrintPalette } from './printTheme.ts';
import { getDocumentSkin, skinVars, headerColors } from './printSkin.ts';
import { shareHtmlAsImage } from './shareReceipt.ts';

export interface DeliveryChallanData {
  shop: { shopName: string; phone: string; address?: string | null; logoUrl?: string | null; theme?: string | null; receiptStyle?: string | null };
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

async function buildDeliveryChallanHtml(data: DeliveryChallanData): Promise<string> {
  const palette = getPrintPalette(data.shop.theme);
  const skin    = getDocumentSkin(data.shop.receiptStyle);
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

  const { isRule, hdrBg, hdrFg, hdrFgMuted, hdrRadius, hdrBorder } = headerColors(skin, palette);
  const hdrMargin = isRule ? '0 0 9px' : '-13px -16px 9px';

  const css = `
    *{margin:0;padding:0;box-sizing:border-box}
    ${skinVars(skin, palette)}
    body{font-family:var(--font-body);background:var(--body-bg, #f1f5f9);padding:20px;display:flex;justify-content:center}
    .inv{background:#fff;width:680px;padding:13px 16px;font-size:10.5px;color:#374151;border:var(--card-border);box-shadow:var(--shadow);border-radius:var(--radius-lg)}
    .hdr{display:flex;align-items:center;gap:8px;padding:9px 11px 7px;background:${hdrBg};border-radius:${hdrRadius};margin:${hdrMargin};${hdrBorder}font-family:var(--font-heading)}
    .ic{background:#f8fafc;border:1px solid #e2e8f0;border-radius:var(--radius-sm);padding:4px 6px;overflow:hidden}
    .il{display:block;font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;margin-bottom:1px}
    .iv{display:block;font-size:10.5px;font-weight:600;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .is{display:block;font-size:9px;color:#64748b}
    .pill{font-size:9px;font-weight:700;padding:1px 7px;border-radius:var(--pill-radius);border:var(--pill-border);margin-top:4px;display:inline-block}
    @media print{
      @page{size:A5 landscape;margin:5mm 7mm}
      body{background:#fff;padding:0}
      .inv{border:none;box-shadow:none;width:100%}
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
${skin.googleFontLink ? `<link href="${skin.googleFontLink}" rel="stylesheet">` : ''}
<style>${css}</style>
</head>
<body>
<div class="inv">
  <div class="hdr">
    <div style="flex:1;min-width:0;display:flex;align-items:center;gap:8px">
      ${data.shop.logoUrl ? `<img src="${data.shop.logoUrl}" style="width:30px;height:30px;object-fit:contain;border-radius:6px;background:#fff;padding:2px;flex-shrink:0" alt="logo"/>` : ''}
      <div style="min-width:0">
        <div style="font-size:14px;font-weight:900;color:${hdrFg};line-height:1">${data.shop.shopName}</div>
        <div style="font-size:9.5px;color:${hdrFgMuted};margin-top:2px">${data.shop.phone}${data.shop.address ? ` · ${data.shop.address}` : ''}</div>
        <span class="pill" style="background:${skin.pillBg === 'transparent' ? 'transparent' : '#fef3c7'};color:${skin.pillBg === 'transparent' ? hdrFg : '#92400e'}">${saleTypeLabel}</span>
      </div>
    </div>
    <div style="text-align:right;flex-shrink:0;margin:0 10px">
      <div style="font-size:13px;font-weight:900;color:${isRule ? palette.blue700 : hdrFg}">DELIVERY SLIP <span style="font-family:'Noto Nastaliq Urdu',serif;font-size:11px">ترسیل پرچی</span></div>
      <div style="font-size:11px;font-weight:700;color:${hdrFg};margin-top:1px">${data.slipNumber}</div>
      <div style="font-size:9px;color:${hdrFgMuted};margin-top:1px">${date}</div>
    </div>
    <div style="flex-shrink:0">
      <img src="${qrDataUrl}" width="58" height="58" style="${skin.qrFrame};display:block" alt="QR"/>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:6px;margin-top:var(--sp-sm)">
    <div class="ic">
      <span class="il">Customer · گاہک</span>
      <span class="iv">${data.customerName}</span>
      ${data.customerPhone ? `<span class="is">${data.customerPhone}</span>` : ''}
      <span class="is">${data.deliveryAddress}</span>
    </div>
    <div class="ic">
      <span class="il">Item · سامان</span>
      <span class="iv">${data.productName}${data.quantity > 1 ? ` ×${data.quantity}` : ''}</span>
      ${data.serialSnapshot ? `<span class="is" style="font-family:'Courier New',monospace;font-size:9px;color:${palette.indigo500}">Serial/IMEI: ${data.serialSnapshot}</span>` : ''}
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

  ${data.conditionNote ? `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:var(--radius-sm);padding:4px 8px;margin-bottom:6px;font-size:9.5px;color:#374151"><strong>Note:</strong> ${data.conditionNote}</div>` : ''}

  <div style="background:${skin.colorUsage === 'fill' ? '#eff6ff' : '#fff'};border:1px solid ${palette.skyBorder};border-radius:var(--radius-sm);padding:5px 8px;margin-bottom:8px;font-size:9px;color:${palette.skyText}">
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
</body>
</html>`;

  return htmlContent;
}

export async function openDeliveryChallan(data: DeliveryChallanData) {
  const html = await buildDeliveryChallanHtml(data);
  const w = window.open('', '_blank', 'width=840,height=600');
  if (!w) return;
  w.document.write(html.replace('</body>', '<script>window.onload=()=>window.print();</script></body>'));
  w.document.close();
}

export async function shareDeliveryChallan(data: DeliveryChallanData) {
  const html = await buildDeliveryChallanHtml(data);
  await shareHtmlAsImage(html, `delivery-slip-${data.slipNumber}.png`);
}
