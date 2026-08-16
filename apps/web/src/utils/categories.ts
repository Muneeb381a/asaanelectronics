export interface CategoryGroup {
  label: string;
  emoji: string;
  items: string[];
}

export const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    label: 'Mobile & Computing',
    emoji: '📱',
    items: ['Mobile Phone', 'Tablet', 'Laptop', 'Desktop PC', 'Smart Watch', 'Power Bank'],
  },
  {
    label: 'TV & Display',
    emoji: '📺',
    items: ['LED TV', 'Smart TV', 'Monitor'],
  },
  {
    label: 'Home Appliances',
    emoji: '🏠',
    items: [
      'Refrigerator', 'Air Conditioner', 'Washing Machine', 'Microwave Oven',
      'Electric Fan', 'Water Dispenser', 'Electric Iron', 'Juicer / Blender', 'Vacuum Cleaner',
    ],
  },
  {
    label: 'Power & Energy',
    emoji: '⚡',
    items: ['UPS / Inverter', 'Generator', 'Solar Panel', 'Solar Battery', 'Battery'],
  },
  {
    label: 'Audio & Accessories',
    emoji: '🎧',
    items: ['Headphones', 'Earphones', 'Speaker', 'Charger / Adapter'],
  },
  {
    label: 'Storage',
    emoji: '💾',
    items: ['Memory Card', 'Pen Drive', 'Hard Drive', 'SSD'],
  },
  {
    label: 'Networking & Security',
    emoji: '🔒',
    items: ['Router / Modem', 'CCTV Camera', 'WiFi Extender'],
  },
  {
    label: 'Printing',
    emoji: '🖨️',
    items: ['Printer', 'Scanner', 'Ink / Toner'],
  },
  {
    label: 'Vehicles',
    emoji: '🏍️',
    items: ['Bike', 'AutoRickshaw', 'Car', 'Chingchi', 'Pickup / Truck', 'Tractor'],
  },
  {
    label: 'Other',
    emoji: '📦',
    items: ['Spare Parts', 'Accessories'],
  },
];

export const PRESET_CATEGORIES = CATEGORY_GROUPS.flatMap((g) => g.items);
