// src/hooks/useHighlight.js
import { useState, useCallback } from 'react';
import {
  TRACE_FULL_FLOW,
  FIND_TOP_PRODUCTS,
  FIND_BROKEN_FLOWS,
  FIND_JOURNAL,
  FIND_REVERSALS,
} from '../constants/actionTypes';

export function useHighlight() {
  const [highlightedIds, setHighlightedIds] = useState(new Set());
  const [expandedIds, setExpandedIds] = useState(new Set());

  const setHighlightFromResult = useCallback((action, result) => {
    const ids = new Set();

    if (action === TRACE_FULL_FLOW) {
      const r = result;
      if (r && typeof r === 'object' && !Array.isArray(r)) {
        ids.add(r.order?.id);
        ids.add(r.delivery?.id);
        ids.add(r.billing?.id);
        for (const j of r.journalEntries || []) ids.add(j?.id);
        for (const p of r.payments || []) ids.add(p?.id);
      }
    } else if (action === FIND_TOP_PRODUCTS) {
      if (Array.isArray(result)) {
        for (const item of result) ids.add(item?.product);
      }
    } else if (action === FIND_BROKEN_FLOWS) {
      if (result && typeof result === 'object' && !Array.isArray(result)) {
        for (const id of result.brokenOrders || []) ids.add(id);
        for (const id of result.orphanBillings || []) ids.add(id);
      }
    } else if (action === FIND_JOURNAL) {
      if (Array.isArray(result)) {
        for (const j of result) ids.add(j?.id);
      }
    } else if (action === FIND_REVERSALS) {
      if (result && typeof result === 'object' && !Array.isArray(result)) {
        ids.add(result?.billingDocument?.id);
        for (const rev of result.reversals || []) ids.add(rev?.document?.id);
      }
    }

    const filteredIds = new Set(Array.from(ids).filter(Boolean).map(String));
    setHighlightedIds(filteredIds);
    return filteredIds;
  }, []);

  const clearHighlight = useCallback(() => {
    setHighlightedIds(new Set());
    setExpandedIds(new Set());
  }, []);

  return {
    highlightedIds,
    setHighlightedIds,
    expandedIds,
    setExpandedIds,
    setHighlightFromResult,
    clearHighlight,
  };
}
