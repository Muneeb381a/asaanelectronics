function toIntlPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('92')) return digits;
  if (digits.startsWith('0'))  return '92' + digits.slice(1);
  return digits;
}

export function openWhatsApp(phone: string, message: string) {
  const url = `https://wa.me/${toIntlPhone(phone)}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank', 'noopener');
}

export function reminderMessage(opts: {
  shopName: string;
  customerName: string;
  productName: string;
  monthly: string | number;
  remaining: string | number;
}) {
  const monthly   = 'PKR ' + Number(opts.monthly).toLocaleString('en-PK',   { maximumFractionDigits: 0 });
  const remaining = 'PKR ' + Number(opts.remaining).toLocaleString('en-PK', { maximumFractionDigits: 0 });
  return (
    `Dear ${opts.customerName},\n\n` +
    `This is a payment reminder from *${opts.shopName}*.\n\n` +
    `📦 *Product:* ${opts.productName}\n` +
    `💰 *Monthly Installment:* ${monthly}\n` +
    `⏳ *Remaining Balance:* ${remaining}\n\n` +
    `Please arrange your payment at your earliest convenience.\n\n` +
    `— ${opts.shopName}`
  );
}

export function billMessage(opts: {
  shopName: string;
  customerName: string;
  productName: string;
  totalAmount: string | number;
  downPayment: string | number;
  monthly: string | number;
  months: number;
  remaining: string | number;
  status: string;
}) {
  const fmt    = (v: string | number) => 'PKR ' + Number(v).toLocaleString('en-PK', { maximumFractionDigits: 0 });
  const paid   = Number(opts.totalAmount) - Number(opts.remaining);
  return (
    `Dear ${opts.customerName},\n\n` +
    `Here is your installment summary from *${opts.shopName}*:\n\n` +
    `📦 *Product:* ${opts.productName}\n` +
    `💵 *Total Amount:* ${fmt(opts.totalAmount)}\n` +
    `⬇️ *Down Payment:* ${fmt(opts.downPayment)}\n` +
    `📅 *Monthly × ${opts.months}:* ${fmt(opts.monthly)}\n` +
    `✅ *Total Paid:* ${fmt(paid)}\n` +
    `⏳ *Remaining:* ${fmt(opts.remaining)}\n` +
    `📊 *Status:* ${opts.status}\n\n` +
    `For any queries, please contact us.\n\n` +
    `— ${opts.shopName}`
  );
}
