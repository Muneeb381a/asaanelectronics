import { and, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { categoryTemplates } from '../../db/schema.js';
import type { FieldDefinition } from '../../db/schema.js';
import type { CreateCategoryTemplateInput } from '@assaan/shared';

const V: (value: string, label: string) => { value: string; label: string } = (value, label) => ({ value, label });

const VEHICLE_FIELDS: FieldDefinition[] = [
  { key: 'engineNumber',       column: 'engineNumber',       label: 'Engine Number',         type: 'text',   placeholder: 'e.g. JC85E-1234567' },
  { key: 'chassisNumber',      column: 'chassisNumber',      label: 'Chassis Number',         type: 'text',   placeholder: 'e.g. JS1GX71A1Y2100001' },
  { key: 'registrationNumber', column: 'registrationNumber', label: 'Registration Number',    type: 'text',   placeholder: 'e.g. LHR-1234' },
  { key: 'modelYear',          column: 'modelYear',          label: 'Model Year',             type: 'number', placeholder: 'e.g. 2024' },
  {
    key: 'vehicleCondition', column: 'vehicleCondition', label: 'Condition', type: 'select',
    options: [V('NEW', 'New'), V('USED', 'Used')],
  },
  {
    key: 'vehicleFileLocation', column: 'vehicleFileLocation', label: 'File / Document Location', type: 'select',
    options: [
      V('WITH_SHOP',     'دکان میں — Shop k paas hai'),
      V('WITH_CUSTOMER', 'گاہک کے پاس — Customer k paas hai'),
      V('WITH_RTO',      'RTO / Excise Office mein'),
      V('WITH_NADRA',    'NADRA Office mein'),
      V('IN_TRANSFER',   'Transfer process mein'),
      V('WITH_COURT',    'عدالت میں — Court mein'),
      V('WITH_POLICE',   'Police Station mein'),
    ],
  },
  {
    key: 'biometricStatus', column: 'biometricStatus', label: 'Biometric Transfer', type: 'select',
    options: [
      V('PENDING',      'Pending (باقی)'),
      V('SELLER_DONE',  'Seller Done (دکاندار نے کیا)'),
      V('BUYER_DONE',   'Buyer Done (خریدار نے کیا)'),
      V('COMPLETED',    'Completed (مکمل)'),
      V('NOT_REQUIRED', 'Not Required'),
    ],
  },
  {
    key: 'letterStatus', column: 'letterStatus', label: 'Notice / Letter Status', type: 'select',
    options: [
      V('NONE',          'None (کوئی نہیں)'),
      V('FIRST_NOTICE',  '1st Notice'),
      V('SECOND_NOTICE', '2nd Notice'),
      V('LEGAL_NOTICE',  'Legal Notice'),
      V('FILED',         'Case Filed'),
    ],
  },
];

const SYSTEM_TEMPLATES: Record<string, FieldDefinition[]> = {
  'Bike':              VEHICLE_FIELDS,
  'Rickshaw':          VEHICLE_FIELDS,
  'Loader Rickshaw':   VEHICLE_FIELDS,
  'Electric Bike':     VEHICLE_FIELDS,
  'Electric Rickshaw': VEHICLE_FIELDS,
  'Mobile': [
    { key: 'imei',      label: 'IMEI Number',  type: 'text',   placeholder: '15-digit IMEI number' },
    { key: 'imei2',     label: 'IMEI 2 (Dual SIM)', type: 'text', placeholder: 'Second IMEI (optional)' },
    { key: 'storage',   label: 'Storage',       type: 'select', options: ['32GB','64GB','128GB','256GB','512GB'].map(s => V(s, s)) },
    { key: 'ram',       label: 'RAM',           type: 'select', options: ['2GB','3GB','4GB','6GB','8GB','12GB','16GB'].map(r => V(r, r)) },
    { key: 'ptaStatus', label: 'PTA Status',    type: 'select', options: [V('approved','PTA Approved'), V('non_pta','Non-PTA'), V('unknown','Unknown')] },
  ],
  'Laptop': [
    { key: 'processor', label: 'Processor',   type: 'text',   placeholder: 'e.g. Intel Core i5-12th Gen' },
    { key: 'ram',       label: 'RAM',          type: 'select', options: ['4GB','8GB','16GB','32GB'].map(r => V(r, r)) },
    { key: 'storage',   label: 'Storage',      type: 'select', options: ['256GB SSD','512GB SSD','1TB SSD','1TB HDD','2TB HDD'].map(s => V(s, s)) },
    { key: 'screenSize',label: 'Screen Size',  type: 'text',   placeholder: 'e.g. 15.6 inch' },
    { key: 'condition', label: 'Condition',    type: 'select', options: [V('new','New'), V('refurbished','Refurbished'), V('used','Used')] },
  ],
  'Refrigerator': [
    { key: 'capacity',      label: 'Capacity (Liters)', type: 'number', placeholder: 'e.g. 280' },
    { key: 'compressorType',label: 'Compressor',        type: 'select', options: [V('inverter','Inverter'), V('conventional','Conventional')] },
    { key: 'energyRating',  label: 'Energy Rating',     type: 'text',   placeholder: 'e.g. 4 Star' },
  ],
  'AC': [
    { key: 'capacity',      label: 'Capacity (Ton)',    type: 'select', options: ['0.75','1','1.5','2','2.5'].map(t => V(t, `${t} Ton`)) },
    { key: 'compressorType',label: 'Compressor',        type: 'select', options: [V('inverter','Inverter'), V('conventional','Conventional')] },
    { key: 'energyRating',  label: 'Energy Rating',     type: 'text',   placeholder: 'e.g. 5 Star' },
  ],
  'Washing Machine': [
    { key: 'capacity',     label: 'Capacity (Kg)', type: 'number', placeholder: 'e.g. 8' },
    { key: 'machineType',  label: 'Type',          type: 'select', options: [V('fully_auto','Fully Automatic'), V('semi_auto','Semi-Automatic'), V('twin_tub','Twin Tub')] },
    { key: 'energyRating', label: 'Energy Rating', type: 'text',   placeholder: 'e.g. 4 Star' },
  ],
  'Generator': [
    { key: 'powerOutput', label: 'Power Output', type: 'text',   placeholder: 'e.g. 3.5 KVA' },
    { key: 'fuelType',    label: 'Fuel Type',    type: 'select', options: [V('petrol','Petrol'), V('gas','Gas (LPG/CNG)'), V('diesel','Diesel')] },
  ],
  'TV': [
    { key: 'screenSize',  label: 'Screen Size (inch)', type: 'text',   placeholder: 'e.g. 55' },
    { key: 'resolution',  label: 'Resolution',         type: 'select', options: [V('HD','HD (720p)'), V('FHD','Full HD (1080p)'), V('4K','4K UHD'), V('8K','8K')] },
    { key: 'smartTv',     label: 'Smart TV',           type: 'select', options: [V('yes','Yes'), V('no','No')] },
    { key: 'panelType',   label: 'Panel Type',         type: 'select', options: [V('LED','LED'), V('OLED','OLED'), V('QLED','QLED')] },
  ],
};

export class CategoryTemplatesService {
  getSystemTemplates() {
    return Object.entries(SYSTEM_TEMPLATES).map(([name, fields]) => ({ name, fields, isSystem: true }));
  }

  getSystemTemplate(categoryName: string): FieldDefinition[] | null {
    return SYSTEM_TEMPLATES[categoryName] ?? null;
  }

  async list(sellerId: string) {
    const custom = await db.select().from(categoryTemplates).where(eq(categoryTemplates.sellerId, sellerId));
    const system = this.getSystemTemplates();
    return { system, custom };
  }

  async getByCategory(sellerId: string, categoryName: string): Promise<FieldDefinition[] | null> {
    const custom = await db.query.categoryTemplates.findFirst({
      where: and(eq(categoryTemplates.sellerId, sellerId), eq(categoryTemplates.categoryName, categoryName)),
    });
    if (custom) return custom.fields as FieldDefinition[];
    return this.getSystemTemplate(categoryName);
  }

  async upsert(sellerId: string, body: CreateCategoryTemplateInput) {
    const existing = await db.query.categoryTemplates.findFirst({
      where: and(eq(categoryTemplates.sellerId, sellerId), eq(categoryTemplates.categoryName, body.categoryName)),
    });
    if (existing) {
      const [updated] = await db.update(categoryTemplates)
        .set({ fields: body.fields })
        .where(and(eq(categoryTemplates.sellerId, sellerId), eq(categoryTemplates.categoryName, body.categoryName)))
        .returning();
      return updated;
    }
    const [created] = await db.insert(categoryTemplates).values({
      sellerId,
      categoryName: body.categoryName,
      fields: body.fields,
    }).returning();
    return created;
  }

  async remove(id: string, sellerId: string) {
    await db.delete(categoryTemplates).where(and(eq(categoryTemplates.id, id), eq(categoryTemplates.sellerId, sellerId)));
  }
}
