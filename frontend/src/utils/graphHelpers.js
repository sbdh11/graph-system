// src/utils/graphHelpers.js

export const normalizeId = (value) => {
  if (value === null || value === undefined) return null;
  return String(value);
};

export const titleizeType = (type) => {
  if (!type) return '';
  return String(type)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
};

export const formatMaybeDate = (value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  const d = new Date(trimmed);
  if (!Number.isNaN(d.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return d.toLocaleDateString();
  }
  return value;
};

export const toRowsFromNodeData = (data) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return [];

  const preferredOrder = [
    'Entity', 'CompanyCode', 'FiscalYear', 'AccountingDocument', 'GIaccount',
    'ReferenceDocument', 'CostCenter', 'ProfitCenter', 'TransactionCurrency',
    'AmountInTransactionCurrency', 'CompanyCodeCurrency', 'PostingDate',
    'DocumentDate', 'AccountingDocumentType', 'AccountingDocumentItem1',
    'creationDate', 'postingDate', 'documentDate', 'billDate', 'paymentDate',
    'amount', 'currency', 'originalId', 'id',
  ];

  const entries = Object.entries(data)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => [k, formatMaybeDate(v)])
    .filter(([, v]) => {
      const t = typeof v;
      return t === 'string' || t === 'number' || t === 'boolean';
    });

  const byKey = new Map(entries);
  const ordered = preferredOrder
    .filter((k) => byKey.has(k))
    .map((k) => [k, byKey.get(k)]);

  const remaining = entries
    .filter(([k]) => !preferredOrder.includes(k))
    .sort(([a], [b]) => String(a).localeCompare(String(b)));

  return [...ordered, ...remaining].map(([k, v]) => ({ key: k, value: v }));
};

export const asId = (linkEndpoint) =>
  typeof linkEndpoint === 'object' ? linkEndpoint.id : linkEndpoint;

export const getNeighborhood = (links, startId, depth = 1) => {
  if (!links || !startId) return new Set();

  const visited = new Set([startId]);
  let frontier = new Set([startId]);

  for (let d = 0; d < depth; d++) {
    const next = new Set();
    for (const link of links) {
      const s = asId(link.source);
      const t = asId(link.target);
      if (frontier.has(s) && !visited.has(t)) next.add(t);
      if (frontier.has(t) && !visited.has(s)) next.add(s);
    }
    for (const id of next) visited.add(id);
    frontier = next;
    if (frontier.size === 0) break;
  }

  return visited;
};

export const hexToRgb = (hex) => {
  const h = String(hex).trim();
  const m = h.match(/^#?([0-9a-fA-F]{6})$/);
  if (!m) return null;
  const num = parseInt(m[1], 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return { r, g, b };
};

export const rgbaFromRgb = (r, g, b, a) => `rgba(${r},${g},${b},${a})`;

export const darkenColor = (hex, amount = 0.18) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const r = Math.round(rgb.r * (1 - amount));
  const g = Math.round(rgb.g * (1 - amount));
  const b = Math.round(rgb.b * (1 - amount));
  return rgbaFromRgb(r, g, b, 0.85);
};
