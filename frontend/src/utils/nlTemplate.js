// src/utils/nlTemplate.js
import {
  FIND_TOP_PRODUCTS,
  FIND_JOURNAL,
} from '../constants/actionTypes';

export const generateNaturalLanguage = (result, action) => {
  if (!result) return null;

  if (Array.isArray(result)) {
    if (result.length === 0) {
      if (action === FIND_TOP_PRODUCTS) return 'No product data found.';
      if (action === FIND_JOURNAL) return 'No journal entries found.';
      return 'No results found.';
    }

    if (action === FIND_TOP_PRODUCTS) {
      const items = result
        .map((item, i) => {
          const product = item?.product ?? item?.material ?? item?.id;
          const count = item?.count ?? item?.billingCount ?? item?.billings;
          if (!product) return null;
          if (typeof count !== 'number') return `${i + 1}. ${product} (billings: unavailable)`;
          return `${i + 1}. ${product} (${count} billings)`;
        })
        .filter(Boolean)
        .join(', ');
      return items
        ? `Top ranking products by billing frequency: ${items}.`
        : 'No product data found.';
    }

    if (action === FIND_JOURNAL) {
      const ids = result.map((n) => n?.id ?? n?.originalId).filter(Boolean);
      return ids.length ? `Linked journal entries: ${ids.join(', ')}.` : 'No journal entries found.';
    }

    const ids = result.map((n) => n?.id ?? n?.originalId ?? n?.product).filter(Boolean);
    return ids.length ? `Found ${ids.length} related items: ${ids.slice(0, 10).join(', ')}.` : 'Results unavailable.';
  }

  if (result.brokenOrders || result.orphanBillings) {
    const parts = [];
    if (result.brokenOrders?.length > 0) {
      parts.push(`Found ${result.brokenOrders.length} orders with deliveries but no linked billing documents.`);
    }
    if (result.orphanBillings?.length > 0) {
      parts.push(`Found ${result.orphanBillings.length} billing documents with no linked delivery documents.`);
    }
    return parts.length > 0 ? parts.join(' ') : 'No inconsistencies found in the current flow.';
  }

  if (typeof result !== 'object') return null;

  const parts = [];
  if (result.order) {
    let s = `Order ${result.order.id}`;
    if (result.delivery) {
      s += ` was delivered via Delivery ${result.delivery.id}`;
      if (result.billing) {
        s += ` and billed as ${result.billing.id}`;
      }
    } else if (result.billing) {
      s += ` was billed as ${result.billing.id}`;
    }
    parts.push(s + '.');
  } else if (result.delivery) {
    let s = `Delivery ${result.delivery.id}`;
    if (result.billing) {
      s += ` was billed as ${result.billing.id}`;
    }
    parts.push(s + '.');
  } else if (result.billing) {
    parts.push(`Billing document ${result.billing.id}.`);
  }

  if (result.journalEntries && result.journalEntries.length > 0) {
    const jIds = result.journalEntries.map(j => j.id).join(', ');
    parts.push(`It generated journal entries: ${jIds}.`);
  }

  if (result.payments && result.payments.length > 0) {
    const pIds = result.payments.map(p => p.originalId || p.id).join(', ');
    parts.push(`Payments received: ${pIds}.`);
  }

  return parts.join(' ');
};
