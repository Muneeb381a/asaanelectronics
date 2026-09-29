import { and, eq, inArray, isNull, sum } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { installments } from '../../db/schema.js';
import { StatsService } from '../stats/stats.service.js';
import { ReportsService } from '../reports/reports.service.js';
import { InstallmentsService } from '../installments/installments.service.js';
import { CustomersService } from '../customers/customers.service.js';
import { SuppliersService } from '../suppliers/suppliers.service.js';

const statsSvc = new StatsService();
const reportsSvc = new ReportsService();
const installmentsSvc = new InstallmentsService();
const customersSvc = new CustomersService();
const suppliersSvc = new SuppliersService();

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
const WEEK_RE      = /hafte|hafta|\bweek\b/;                         // hafte/hafta/week
const MONTH_RE     = /mahin|mahee|month/;                            // mahina/mahine/maheena/month
const MONEY_IN_RE  = /collection|wasool|vasool|payment|paisa|wasuli/; // collection/wasooli/payment/paisa
const INSTALLMENT_WORD_RE = /qist|installment/;
const BUSINESS_KEYWORDS_RE = /collection|wasool|vasool|payment|paisa|profit|faida|fayda|munafa|nuksan|loss|overdue|baqaya|udhar|stock|installment|qist|customer|grahak|supplier|approval|manzoori|guarantor|zamin|promise|waada|expense|kharch|naye|naya|complete|mukamal/;

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
  // Checked before "customer_balance" — "supplier ka baqaya" would otherwise be
  // mistaken for a (nonsensical) customer name search on the word "supplier".
  { id: 'supplier_balance', test: (m) => /supplier/.test(m) && /baqaya|pending|due|dena|outstanding|kitna/.test(m) },
  // Checked before the shop-wide "overdue"/"profit" intents, since "X ki baqaya"
  // (a name + balance keyword) should look up that one customer, not the whole shop.
  { id: 'customer_balance', test: (m) => BALANCE_RE.test(m) && extractName(m).length >= 2 },
  // Checked before "today_collection" — "aaj ki qist" (no money word) is about
  // who's due today, not how much cash came in.
  { id: 'due_today',       test: (m) => TODAY_RE.test(m) && INSTALLMENT_WORD_RE.test(m) && !MONEY_IN_RE.test(m) },
  { id: 'due_week',        test: (m) => WEEK_RE.test(m) && INSTALLMENT_WORD_RE.test(m) },
  { id: 'today_collection', test: (m) => TODAY_RE.test(m) && MONEY_IN_RE.test(m) },
  // These three are checked before the generic "month_collection" since they
  // share MONTH_RE but ask about a different number entirely.
  { id: 'new_customers_month', test: (m) => MONTH_RE.test(m) && /naye|naya|\bnew\b/.test(m) && /customer|grahak/.test(m) },
  { id: 'completed_month', test: (m) => MONTH_RE.test(m) && /complete|mukamal|poori/.test(m) && INSTALLMENT_WORD_RE.test(m) },
  { id: 'month_expense',   test: (m) => MONTH_RE.test(m) && /kharch|expense/.test(m) },
  { id: 'month_collection', test: (m) => MONTH_RE.test(m) && MONEY_IN_RE.test(m) },
  { id: 'completing_soon', test: (m) => /jald|jaldi|\bsoon\b/.test(m) && /complete|khatam/.test(m) && INSTALLMENT_WORD_RE.test(m) },
  { id: 'profit',          test: (m) => /profit|faida|fayda|munafa|nuksan|loss|p ?& ?l|p and l/.test(m) },
  { id: 'overdue',         test: (m) => /overdue|late payment|baqaya|udhar|due customer/.test(m) },
  { id: 'pending_approval', test: (m) => /approval|manzoori/.test(m) },
  { id: 'guarantor_risk',  test: (m) => /guarantor|zamin/.test(m) },
  { id: 'promises_due',    test: (m) => /promise|waada/.test(m) },
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
  '• "Aaj kiski qist due hai?"\n' +
  '• "Is hafte kiski qist due hai?"\n' +
  '• "Is mahine ki collection?"\n' +
  '• "Is mahine kitne naye customers aaye?"\n' +
  '• "Is mahine kitna kharcha hua?"\n' +
  '• "Overdue customers kitne hain?"\n' +
  '• "Is mahine ka profit kitna hai?"\n' +
  '• "Supplier ka kitna baqaya hai?"\n' +
  '• "Stock kam hai kis product ka?"\n' +
  '• "Kitne active installments hain?"\n' +
  '• "Kitne total customers hain?"\n' +
  '• "X ki pending amount kitni hai?"\n' +
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

      case 'due_today': {
        const { items } = await installmentsSvc.collectionSchedule(ctx.sellerId, 0, ctx.staffUserId);
        const today = items.filter((i) => i.urgency === 'today');
        if (!today.length) return { reply: 'Aaj kisi ki qist due nahi hai.' };
        const total = today.reduce((s, i) => s + i.monthly, 0);
        const list = today.slice(0, 8).map((i) => `${i.customerName} — ${fmtPkr(i.monthly)} (${i.area})`).join('\n');
        const more = today.length > 8 ? `\n...aur ${today.length - 8} customers` : '';
        return { reply: `Aaj ${today.length} customers ki qist due hai, total ${fmtPkr(total)}:\n${list}${more}` };
      }

      case 'due_week': {
        const { items, summary } = await installmentsSvc.collectionSchedule(ctx.sellerId, 7, ctx.staffUserId);
        const upcoming = items.filter((i) => i.urgency === 'upcoming');
        if (!upcoming.length) return { reply: `Agle 7 dinon mein koi nayi qist due nahi hai (aaj/overdue milakar ${fmtPkr(summary.totalDue)} baqi hai).` };
        const list = upcoming.slice(0, 8).map((i) => `${i.customerName} — ${fmtPkr(i.monthly)} (${i.nextDueDate})`).join('\n');
        return { reply: `Agle 7 dinon mein ${upcoming.length} qistein due hongi (aaj/overdue samet total ${fmtPkr(summary.totalDue)}):\n${list}` };
      }

      case 'today_collection': {
        const s = await statsSvc.getStats(ctx.sellerId, ctx.staffUserId);
        const total = s.todayCollections + s.todayCashSales;
        return { reply: `Aaj ki collection ${fmtPkr(total)} hai (installments: ${fmtPkr(s.todayCollections)}, cash sales: ${fmtPkr(s.todayCashSales)}).` };
      }

      case 'new_customers_month': {
        const s = await statsSvc.getStats(ctx.sellerId, ctx.staffUserId);
        if (!s.newThisMonthCount) return { reply: 'Is mahine abhi tak koi naya customer nahi bana.' };
        return { reply: `Is mahine ${s.newThisMonthCount} naye customers bane hain, total value ${fmtPkr(s.newThisMonthValue)}.` };
      }

      case 'completed_month': {
        const s = await statsSvc.getStats(ctx.sellerId, ctx.staffUserId);
        if (!s.completedThisMonthCount) return { reply: 'Is mahine abhi tak koi installment complete nahi hui.' };
        return { reply: `Is mahine ${s.completedThisMonthCount} installments complete hui hain, total value ${fmtPkr(s.completedThisMonthValue)}.` };
      }

      case 'month_expense': {
        if (!ctx.canViewReports) return { reply: 'Ye jaankari sirf reports dekhne ki permission wale hi dekh sakte hain.' };
        const s = await statsSvc.getStats(ctx.sellerId, ctx.staffUserId);
        return { reply: `Is mahine ka total kharcha ${fmtPkr(s.monthExpenseTotal)} hai.` };
      }

      case 'month_collection': {
        const s = await statsSvc.getStats(ctx.sellerId, ctx.staffUserId);
        const total = s.monthCollections + s.monthCashSales;
        return { reply: `Is mahine ki collection ${fmtPkr(total)} hai (installments: ${fmtPkr(s.monthCollections)}, cash sales: ${fmtPkr(s.monthCashSales)}).` };
      }

      case 'completing_soon': {
        const s = await statsSvc.getStats(ctx.sellerId, ctx.staffUserId);
        const items = s.completingSoon;
        if (!items.length) return { reply: 'Abhi koi installment complete hone k qareeb nahi hai.' };
        const list = items.slice(0, 8).map((i) => `${i.customerName} — ${i.paymentsLeft} qist baqi (${fmtPkr(i.remaining)})`).join('\n');
        return { reply: `Ye installments jald complete hone wali hain:\n${list}` };
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

      case 'supplier_balance': {
        if (!ctx.canViewReports) return { reply: 'Ye jaankari sirf reports dekhne ki permission wale hi dekh sakte hain.' };
        const all = await suppliersSvc.list(ctx.sellerId);
        const owing = all.filter((s) => s.outstanding > 0.5);
        if (!owing.length) return { reply: 'Kisi bhi supplier ka koi baqaya nahi hai.' };
        const total = owing.reduce((s, r) => s + r.outstanding, 0);
        const list = owing.slice(0, 8).map((s) => `${s.name} — ${fmtPkr(s.outstanding)} baqaya`).join('\n');
        return { reply: `Suppliers ka total baqaya ${fmtPkr(total)} hai:\n${list}` };
      }

      case 'pending_approval': {
        const s = await statsSvc.getStats(ctx.sellerId, ctx.staffUserId);
        if (!s.pendingApprovalCount) return { reply: 'Abhi koi installment approval ka wait nahi kar rahi.' };
        return { reply: `${s.pendingApprovalCount} installments abhi approval ka wait kar rahi hain.` };
      }

      case 'guarantor_risk': {
        const s = await statsSvc.getStats(ctx.sellerId, ctx.staffUserId);
        if (!s.guarantorRiskCount) return { reply: 'Abhi koi guarantor-risk wala case nahi hai.' };
        return { reply: `${s.guarantorRiskCount} customers guarantor-risk mein hain — inki details Reports mein dekh sakte hain.` };
      }

      case 'promises_due': {
        const s = await statsSvc.getStats(ctx.sellerId, ctx.staffUserId);
        if (!s.promisesDueCount) return { reply: 'Abhi koi payment promise due nahi hai.' };
        return { reply: `${s.promisesDueCount} customers ne payment ka promise kiya hua hai jo due hai.` };
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
