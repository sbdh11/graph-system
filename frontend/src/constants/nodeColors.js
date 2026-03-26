// src/constants/nodeColors.js
export const NODE_COLORS = {
  Order: '#3b82f6',
  Delivery: '#10b981',
  Billing: '#f59e0b',
  JournalEntry: '#8b5cf6',
  Payment: '#ef4444',
};

export const getNodeColor = (type) => NODE_COLORS[type] || '#9ca3af';

export const NODE_RADIUS = 7;

export const LABEL_MAP = {
  Order: 'Order',
  Delivery: 'Delivery',
  Billing: 'Billing',
  JournalEntry: 'Journal',
  Payment: 'Payment',
};

export const CANVAS_COLOR_MAP = {
  Order: '#3b82f6',
  Delivery: '#10b981',
  Billing: '#f59e0b',
  Journal: '#8b5cf6',
  Payment: '#ef4444',
};
