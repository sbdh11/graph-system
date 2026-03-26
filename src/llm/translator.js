/**
 * Rule-based translator: converts natural language queries into
 * structured actions for the graph query engine.
 *
 * This layer does NOT access or interpret dataset data.
 * It only parses intent + numeric ID from the input string.
 */

export function translate(query) {
  if (!query || typeof query !== 'string') {
    return { action: 'REJECT' };
  }

  const lower = query.toLowerCase().trim();
  const idMatch = query.match(/\d+/);
  const id = idMatch ? idMatch[0] : null;

  if (lower.includes('broken')) {
    return { action: 'FIND_BROKEN_FLOWS' };
  }

  // Top products/materials by number of billing documents.
  // Handles phrasing like:
  // - "top products"
  // - "top 10 materials"
  // - "Which products are associated with the highest number of billing documents?"
  const wantsTopProducts =
    (lower.includes('top') &&
      (lower.includes('product') || lower.includes('material')) &&
      (lower.includes('billing') || lower.includes('invoice'))) ||
    (
      (lower.includes('highest') || lower.includes('most') || lower.includes('largest')) &&
      (lower.includes('product') || lower.includes('material')) &&
      (lower.includes('billing') || lower.includes('billings') || lower.includes('invoice'))
    );

  if (wantsTopProducts) {
    // Prefer explicit N after "top/limit/first". Fall back to first number in the sentence.
    const nFromContext = query.match(/(?:top|limit|first)\s+(\d+)/i);
    if (nFromContext) {
      return { action: 'FIND_TOP_PRODUCTS', n: parseInt(nFromContext[1], 10) };
    }

    const anyNum = query.match(/\d+/);
    return {
      action: 'FIND_TOP_PRODUCTS',
      n: anyNum ? parseInt(anyNum[0], 10) : 5,
    };
  }

  if (!id) return { action: 'REJECT' };

  if (lower.includes('trace') && lower.includes('billing')) {
    return { action: 'TRACE_FULL_FLOW', id };
  }

  if (lower.includes('journal')) {
    return { action: 'FIND_JOURNAL', id };
  }

  if (lower.includes('reversal')) {
    return { action: 'FIND_REVERSALS', id };
  }

  // If the user asks about a specific billing/invoice document,
  // default to the full trace for that id.
  if (lower.includes('billing') || lower.includes('invoice')) {
    return { action: 'TRACE_FULL_FLOW', id };
  }

  return { action: 'REJECT' };
}
