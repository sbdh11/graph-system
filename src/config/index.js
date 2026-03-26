import path from 'path';

export const PORT = process.env.PORT || 3000;
export const DATA_DIR = path.resolve('sap-o2c-data');

export const REJECT_MESSAGE =
  'This system only answers questions about the O2C dataset. Please ask about orders, deliveries, billing, or payments.';

export const DOMAIN_KEYWORDS = [
  'order',
  'sales order',
  'delivery',
  'deliveries',
  'billing',
  'invoice',
  'payment',
  'payments',
  'customer',
  'journal',
  'accounting',
  'broken',
  'incomplete',
  'reversal',
  'order to cash',
  'order-to-cash',
  'o2c',
];
