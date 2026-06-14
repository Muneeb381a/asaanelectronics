import { fmtDateTime } from './dateFormat.ts';

export interface ReportConfig {
  title: string;
  subtitle?: string;
  shopName: string;
  shopPhone?: string | null;
  columns: string[];
  rows: (string | number)[][];
  summary?: string[];
}

const CSS = `
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 24px; }
.header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #111; padding-bottom: 14px; }
.header h1 { font-size: 20px; margin-bottom: 2px; }
.header h2 { font-size: 15px; font-weight: normal; color: #444; }
.meta { font-size: 11px; color: #666; margin-top: 6px; }
table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
thead tr { background: #111; color: #fff; }
thead th { padding: 8px 10px; text-align: left; font-size: 11px; font-weight: bold; letter-spacing: 0.3px; }
tbody tr:nth-child(even) { background: #f5f5f5; }
tbody td { padding: 7px 10px; border-bottom: 1px solid #e0e0e0; vertical-align: top; }
.summary-box { border: 1px solid #ccc; border-radius: 4px; padding: 10px 14px; background: #fafafa; margin-top: 8px; }
.summary-box p { margin: 2px 0; font-size: 12px; }
.summary-box strong { color: #111; }
.empty { text-align: center; padding: 30px; color: #888; font-style: italic; }
.foot { text-align: center; font-size: 10px; color: #aaa; margin-top: 20px; border-top: 1px solid #eee; padding-top: 10px; }
@media print {
  body { padding: 10px; }
  @page { size: A4; margin: 15mm 12mm; }
}
`;

function buildHtml(cfg: ReportConfig): string {
  const now = fmtDateTime(new Date());

  const thCells = cfg.columns.map((c) => `<th>${c}</th>`).join('');
  const bodyRows = cfg.rows.length === 0
    ? `<tr><td colspan="${cfg.columns.length}" class="empty">No records found</td></tr>`
    : cfg.rows.map((row) =>
        `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`
      ).join('');

  const summaryHtml = cfg.summary?.length
    ? `<div class="summary-box">${cfg.summary.map((s) => `<p>${s}</p>`).join('')}</div>`
    : '';

  return `<!DOCTYPE html><html><head>
<meta charset="utf-8">
<title>${cfg.title} — ${cfg.shopName}</title>
<style>${CSS}</style>
</head><body>
<div class="header">
  <h1>${cfg.shopName}</h1>
  ${cfg.shopPhone ? `<div class="meta">${cfg.shopPhone}</div>` : ''}
  <h2>${cfg.title}</h2>
  ${cfg.subtitle ? `<div class="meta">${cfg.subtitle}</div>` : ''}
  <div class="meta">Generated: ${now} &nbsp;|&nbsp; Total records: ${cfg.rows.length}</div>
</div>
<table>
  <thead><tr>${thCells}</tr></thead>
  <tbody>${bodyRows}</tbody>
</table>
${summaryHtml}
<div class="foot">Assaan Electronics — ${now}</div>
</body></html>`;
}

export function printReport(cfg: ReportConfig) {
  const html = buildHtml(cfg);
  const win = window.open('', '_blank', 'width=1050,height=750,scrollbars=yes');
  if (!win) { alert('Popups are blocked. Please allow popups to download reports.'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
    win.onafterprint = () => win.close();
  }, 400);
}
