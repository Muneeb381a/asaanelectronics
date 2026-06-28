import { api } from './client.ts';

export interface WhatsappTemplate {
  id: string;
  sellerId: string;
  name: string;
  body: string;
  createdAt: string;
}

const unwrap = <T>(res: { data: { data: T } }) => res.data.data;

export const whatsappTemplatesApi = {
  list: (): Promise<WhatsappTemplate[]> =>
    api.get('/whatsapp-templates').then(unwrap<WhatsappTemplate[]>),

  create: (data: { name: string; body: string }): Promise<WhatsappTemplate> =>
    api.post('/whatsapp-templates', data).then(unwrap<WhatsappTemplate>),

  update: (id: string, data: { name: string; body: string }): Promise<WhatsappTemplate> =>
    api.patch(`/whatsapp-templates/${id}`, data).then(unwrap<WhatsappTemplate>),

  remove: (id: string): Promise<void> =>
    api.delete(`/whatsapp-templates/${id}`).then(() => undefined),
};

// Fill {{variables}} with actual values
export function applyTemplate(body: string, vars: {
  customer_name?: string;
  shop_name?: string;
  product_name?: string;
  amount_due?: string | number;
  remaining_balance?: string | number;
  days_overdue?: number;
  phone?: string;
}): string {
  const fmt = (v: string | number) => 'PKR ' + Number(v).toLocaleString('en-PK', { maximumFractionDigits: 0 });
  return body
    .replace(/\{\{customer_name\}\}/g,      vars.customer_name      ?? '')
    .replace(/\{\{shop_name\}\}/g,          vars.shop_name          ?? '')
    .replace(/\{\{product_name\}\}/g,       vars.product_name       ?? '')
    .replace(/\{\{amount_due\}\}/g,         vars.amount_due != null ? fmt(vars.amount_due) : '')
    .replace(/\{\{remaining_balance\}\}/g,  vars.remaining_balance != null ? fmt(vars.remaining_balance) : '')
    .replace(/\{\{days_overdue\}\}/g,       String(vars.days_overdue ?? ''))
    .replace(/\{\{phone\}\}/g,              vars.phone ?? '');
}

export const TEMPLATE_VARS = [
  { key: '{{customer_name}}',     label: 'Customer Name' },
  { key: '{{shop_name}}',         label: 'Shop Name' },
  { key: '{{product_name}}',      label: 'Product Name' },
  { key: '{{amount_due}}',        label: 'Amount Due (PKR)' },
  { key: '{{remaining_balance}}', label: 'Remaining Balance (PKR)' },
  { key: '{{days_overdue}}',      label: 'Days Overdue' },
  { key: '{{phone}}',             label: 'Phone Number' },
];
