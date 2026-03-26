import { REJECT_MESSAGE } from '../config/index.js';
import { translate } from '../llm/translator.js';
import { classifyQuery } from '../llm/classifier.js';

/**
 * Orchestrates query handling: translate → classify → dispatch to queryEngine.
 * Extracted from the POST /query handler in server.js (lines 64-112).
 */
export async function handleQuery(query, queryEngine) {
  // First try fast deterministic parsing (no LLM round-trip).
  const structuredFromTranslate = translate(query);

  const hasDigits = /\d+/.test(String(query || ''));
  let structured = structuredFromTranslate;

  // Only hit the LLM classifier if the deterministic translator can't parse.
  if (structuredFromTranslate.action === 'REJECT') {
    // Most supported dataset actions require a numeric billing/document id.
    if (!hasDigits) {
      return { answer: REJECT_MESSAGE, action: null, result: null };
    }

    const classifier = await classifyQuery(query).catch(() => null);

    // Semantic guardrails: reject unrelated queries early.
    if (classifier && classifier.allow === false) {
      return { answer: REJECT_MESSAGE, action: null, result: null };
    }

    structured = classifier?.action && classifier.action !== 'REJECT' ? classifier : structuredFromTranslate;
  }

  if (!structured || structured.action === 'REJECT') {
    return { answer: REJECT_MESSAGE, action: null, result: null };
  }

  let result = null;
  switch (structured.action) {
    case 'TRACE_FULL_FLOW':
      result = queryEngine.traceFullFlow(structured.id);
      break;
    case 'FIND_JOURNAL':
      result = queryEngine.findJournalByBilling(structured.id);
      break;
    case 'FIND_REVERSALS':
      result = queryEngine.traceBillingFlow(structured.id);
      break;
    case 'FIND_BROKEN_FLOWS':
      result = queryEngine.findBrokenFlows();
      break;
    case 'FIND_TOP_PRODUCTS':
      result = queryEngine.findTopProducts(structured.n);
      break;
    default:
      return { answer: REJECT_MESSAGE, action: null, result: null };
  }

  return { action: structured.action, id: structured.id, result };
}
