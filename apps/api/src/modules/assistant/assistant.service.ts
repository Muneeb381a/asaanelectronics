import { and, eq, inArray, isNull, sum } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { installments } from '../../db/schema.js';
import { StatsService } from '../stats/stats.service.js';
import { ReportsService } from '../reports/reports.service.js';
import { InstallmentsService } from '../installments/installments.service.js';
import { CustomersService } from '../customers/customers.service.js';

const statsSvc = new StatsService();
const reportsSvc = new ReportsService();
const installmentsSvc = new InstallmentsService();
const customersSvc = new CustomersService();

function fmtPkr(n: number): string {
  return `Rs ${Math.round(n).toLocaleString('en-PK')}`;
}

// Roman Urdu / Urdu / English keyword patterns. Order matters — first match wins,
// so more specific intents (e.g. a CNIC number) are checked before generic ones.
type Intent = {
  id: string;
  test: (msg: string) => boolean;
};

const CNIC_RE = /\d{5}-?\d{7}-?\d\b/;

// Roman Urdu has no fixed spelling ("aaj" vs "aj", "wasooli" vs "wasuli" vs "vasooli")
// — these are intentionally loose substring/word-boundary matches, not exact words.
const TODAY_RE     = /\ba+j\b/;                                     // aj, aaj, aaaj
const MONTH_RE     = /mahin|mahee|month/;                            // mahina/mahine/maheena/month
const MONEY_IN_RE  = /collection|wasool|vasool|payment|paisa|wasuli/; // collection/wasooli/payment/paisa
const BUSINESS_KEYWORDS_RE = /collection|wasool|vasool|payment|paisa|profit|faida|fayda|munafa|nuksan|loss|overdue|baqaya|udhar|stock|installment|qist|customer|grahak/;

// "Muneeb ki pending amount" — a balance keyword PLUS a leftover word (the name)
// after stripping the generic connector/keyword words below.
const BALANCE_RE = /pending|baqaya|remaining|kitn[ai]?\s*(?:dena|lena)|due amount/;
const BALANCE_STOPWORDS_RE = /\b(ki|ka|ke|pending|amount|baqaya|remaining|kitna|kitni|hai|hain|dena|lena|due|installment|qist|balance|customer|grahak|kitne|paas)\b/gi;

function extractName(raw: string): string {
  return raw.replace(BALANCE_STOPWORDS_RE, ' ').replace(/\s+/g, ' ').trim();
}

const INTENTS: Intent[] = [
  { id: 'greeting',        test: (m) => /^(hi|hello|salam|assalam|asalam|hey)\b/.test(m) },
  { id: 'help',            test: (m) => /help|madad|kya poochh|kya pooch|what can you/.test(m) },
  { id: 'cnic_lookup',     test: (m) => CNIC_RE.test(m) },
  // Checked before the shop-wide "overdue"/"profit" intents, since "X ki baqaya"
  // (a name + balance keyword) should look up that one customer, not the whole shop.
  { id: 'customer_balance', test: (m) => BALANCE_RE.test(m) && extractName(m).length >= 2 },
  { id: 'today_collection', test: (m) => TODAY_RE.test(m) && MONEY_IN_RE.test(m) },
  { id: 'month_collection', test: (m) => MONTH_RE.test(m) && MONEY_IN_RE.test(m) },
  { id: 'profit',          test: (m) => /profit|faida|fayda|munafa|nuksan|loss|p ?& ?l|p and l/.test(m) },
  { id: 'overdue',         test: (m) => /overdue|late payment|baqaya|udhar|due customer/.test(m) },
  { id: 'low_stock',       test: (m) => /(stock)/.test(m) && /kam|low|khatam|khatm/.test(m) },
  { id: 'active_count',    test: (m) => /(kitn|how many|total).*(installment|qist)/.test(m) },
  { id: 'customer_count',  test: (m) => /(kitn|how many|total).*(customer|grahak)/.test(m) },
  // Only treat short plain text as a name search when it doesn't look like a
  // business question that just failed to match above (misspelled "aj"/"mahina"/
  // etc.) — those should fall through to "didn't understand", not a fake name search.
  { id: 'customer_search', test: (m) => !BUSINESS_KEYWORDS_RE.test(m) && /^(?:search |dhoond |find )?[a-z][a-z .]{2,40}$/.test(m) && m.split(' ').length <= 5 },
];

function normalize(raw: string): string {
  return raw.toLowerCase().trim().replace(/\s+/g, ' ');
}

export interface AssistantContext {
  sellerId: string;
  staffUserId?: string;   // set when the caller is SELLER_STAFF
  canViewReports: boolean;
}

const HELP_TEXT =
  'Ye cheezein poochh sakte hain:\n' +
  '• "Aaj ki collection kitni hai?"\n' +
  '• "Is mahine ki collection?"\n' +
  '• "Overdue customers kitne hain?"\n' +
  '• "Is mahine ka profit kitna hai?"\n' +
  '• "Stock kam hai kis product ka?"\n' +
  '• "Kitne active installments hain?"\n' +
  '• "Kitne total customers hain?"\n' +
  '• Kisi customer ka CNIC ya naam type karen';

export class AssistantService {
  async ask(ctx: AssistantContext, rawMessage: string): Promise<{ reply: string }> {
    const message = normalize(rawMessage);
    if (!message) return { reply: HELP_TEXT };

    const intent = INTENTS.find((i) => i.test(message));
    if (!intent) {
      return { reply: `Samajh nahi aaya. ${HELP_TEXT}` };
    }

    switch (intent.id) {
      case 'greeting':
        return { reply: `Assalam-o-Alaikum! ${HELP_TEXT}` };

      case 'help':
        return { reply: HELP_TEXT };

      case 'customer_balance': {
        const term = extractName(rawMessage);
        const result = await customersSvc.list(ctx.sellerId, 1, 5, term, undefined, undefined, ctx.staffUserId);
        const items = (result as { data: { id: string; name: string }[] }).data ?? [];
        if (!items.length) return { reply: `"${term}" naam se koi customer nahi mila.` };

        const ids = items.map((c) => c.id);
        const balRows = await db.select({ customerId: installments.customerId, total: sum(installments.remaining) })
          .from(installments)
          .where(and(inArray(installments.customerId, ids), eq(installments.status, 'ACTIVE'), isNull(installments.deletedAt)))
          .groupBy(installments.customerId);
        const byId = new Map(balRows.map((r) => [r.customerId, Number(r.total ?? 0)]));

        const list = items.map((c) => `${c.name} — ${fmtPkr(byId.get(c.id) ?? 0)} pending`).join('\n');
        return { reply: list };
      }

      case 'today_collection': {
        const s = await statsSvc.getStats(ctx.sellerId, ctx.staffUserId);
        const total = s.todayCollections + s.todayCashSales;
        return { reply: `Aaj ki collection ${fmtPkr(total)} hai (installments: ${fmtPkr(s.todayCollections)}, cash sales: ${fmtPkr(s.todayCashSales)}).` };
      }

      case 'month_collection': {
        const s = await statsSvc.getStats(ctx.sellerId, ctx.staffUserId);
        const total = s.monthCollections + s.monthCashSales;
        return { reply: `Is mahine ki collection ${fmtPkr(total)} hai (installments: ${fmtPkr(s.monthCollections)}, cash sales: ${fmtPkr(s.monthCashSales)}).` };
      }

      case 'profit': {
        if (!ctx.canViewReports) return { reply: 'Ye jaankari sirf reports dekhne ki permission wale hi dekh sakte hain.' };
        const now = new Date();
        const pnl = await reportsSvc.getPnL(ctx.sellerId, now.getFullYear(), now.getMonth() + 1);
        const sign = pnl.netProfit >= 0 ? 'profit' : 'nuksan';
        return { reply: `Is mahine ka ${sign} ${fmtPkr(Math.abs(pnl.netProfit))} hai (total revenue ${fmtPkr(pnl.totalRevenue)}, expenses ${fmtPkr(pnl.totalExpenses)}).` };
      }

      case 'overdue': {
        const s = await statsSvc.getStats(ctx.sellerId, ctx.staffUserId);
        if (!s.overdueCount) return { reply: 'Abhi koi overdue customer nahi hai — sab theek hai!' };
        const rows = await installmentsSvc.overdueWithStage(ctx.sellerId, undefined, ctx.staffUserId);
        const top = (rows as { customer_name: string; days_overdue: number; remaining: string }[]).slice(0, 5);
        const list = top.map((r) => `${r.customer_name} — ${r.days_overdue} din, ${fmtPkr(Number(r.remaining))} baqaya`).join('\n');
        return { reply: `${s.overdueCount} customers overdue hain, total ${fmtPkr(s.overdueAmount)}. Sab se zyada overdue:\n${list}` };
      }

      case 'low_stock': {
        const s = await statsSvc.getStats(ctx.sellerId, ctx.staffUserId);
        const items = s.lowStockItems as { name: string; stock: number; minStock: number }[];
        if (!items.length) return { reply: 'Stock theek hai, koi product low stock mein nahi hai.' };
        const list = items.slice(0, 8).map((p) => `${p.name} — ${p.stock} bache hain (minimum ${p.minStock})`).join('\n');
        return { reply: `Ye products low stock mein hain:\n${list}` };
      }

      case 'active_count': {
        const s = await statsSvc.getStats(ctx.sellerId, ctx.staffUserId);
        return { reply: `${s.activeCount} active/pending installments chal rahi hain.` };
      }

      case 'customer_count': {
        const s = await statsSvc.getStats(ctx.sellerId, ctx.staffUserId);
        return { reply: `Total ${s.totalCustomers} customers hain.` };
      }

      case 'cnic_lookup': {
        const cnic = message.match(CNIC_RE)![0];
        const res = await customersSvc.checkCnicExists(ctx.sellerId, cnic.replace(/-/g, ''));
        if (!res.customer) return { reply: 'Ye CNIC kisi customer ke record mein nahi mili.' };
        return { reply: `Mil gaya: ${res.customer.name} (${res.customer.cnicMasked}), phone: ${res.customer.phone}.` };
      }

      case 'customer_search': {
        const term = rawMessage.replace(/^(search|dhoond|find)\s+/i, '').trim();
        const result = await customersSvc.list(ctx.sellerId, 1, 5, term, undefined, undefined, ctx.staffUserId);
        const items = (result as { data: { name: string; phone: string; cnicMasked: string | null }[] }).data ?? [];
        if (!items.length) return { reply: `"${term}" naam se koi customer nahi mila.` };
        const list = items.map((c) => `${c.name} — ${c.phone}${c.cnicMasked ? ` (${c.cnicMasked})` : ''}`).join('\n');
        return { reply: `Mile customers:\n${list}` };
      }

      default:
        return { reply: HELP_TEXT };
    }
  }
}
