/**
 * Dataset-related intent classifier (server-side).
 *
 * This is used to upgrade guardrails from keyword-based filtering
 * to a semantic decision: "Should we answer this using the SAP O2C dataset?"
 *
 * If the configured LLM keys are missing (or the call fails), we fall back
 * to deterministic heuristics so the app still works.
 */

const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';

function keywordFallbackAllow(query) {
  const lower = String(query || '').toLowerCase();
  // Minimal gate only for "keep working without LLM".
  return (
    lower.includes('order to cash') ||
    lower.includes('order-to-cash') ||
    lower.includes('o2c') ||
    lower.includes('order') ||
    lower.includes('delivery') ||
    lower.includes('billing') ||
    lower.includes('invoice') ||
    lower.includes('journal') ||
    lower.includes('payment') ||
    lower.includes('trace') ||
    lower.includes('flow') ||
    lower.includes('broken') ||
    lower.includes('incomplete') ||
    lower.includes('reversal') ||
    (lower.includes('top') &&
      (lower.includes('product') || lower.includes('material')) &&
      (lower.includes('billing') || lower.includes('billings') || lower.includes('invoice')))
  );
}

function extractFirstDigitsId(query) {
  const m = String(query || '').match(/\d+/);
  return m ? m[0] : null;
}

function extractTopN(query) {
  const m = String(query || '').match(/(?:top|limit|first)\s+(\d+)/i);
  if (m) return parseInt(m[1], 10);
  // If the sentence contains a number but not in the "top N" slot, still accept it.
  const any = String(query || '').match(/\d+/);
  if (any) return parseInt(any[0], 10);
  return null;
}

function heuristicClassify(query) {
  const raw = String(query || '');
  const lower = raw.toLowerCase();
  const id = extractFirstDigitsId(raw);

  const wantsTop =
    (lower.includes('top') &&
      (lower.includes('product') || lower.includes('material')) &&
      (lower.includes('billing') || lower.includes('billings') || lower.includes('invoice'))) ||
    ((lower.includes('highest') || lower.includes('most') || lower.includes('largest')) &&
      (lower.includes('product') || lower.includes('material')) &&
      (lower.includes('billing') || lower.includes('billings') || lower.includes('invoice')));

  if (wantsTop) {
    return {
      allow: true,
      action: 'FIND_TOP_PRODUCTS',
      id: null,
      n: extractTopN(raw) ?? 5,
    };
  }

  const wantsBroken =
    lower.includes('broken') ||
    lower.includes('incomplete') ||
    (lower.includes('missing') && (lower.includes('billing') || lower.includes('deliver')));

  if (wantsBroken) {
    return { allow: true, action: 'FIND_BROKEN_FLOWS', id: null, n: null };
  }

  const hasBillingId = Boolean(id) && (lower.includes('billing') || lower.includes('invoice'));

  // Journal + reversals target a specific billing/doc id
  if (hasBillingId && lower.includes('journal')) {
    return { allow: true, action: 'FIND_JOURNAL', id, n: null };
  }

  if (hasBillingId && lower.includes('reversal')) {
    return { allow: true, action: 'FIND_REVERSALS', id, n: null };
  }

  // If the user is asking about a specific billing/invoice document, default to
  // tracing the full Order-to-Cash flow (end-to-end) for that id.
  // This avoids unnecessary LLM classifier calls and makes answers instant.
  if (hasBillingId && (lower.includes('billing') || lower.includes('invoice'))) {
    return { allow: true, action: 'TRACE_FULL_FLOW', id, n: null };
  }

  // Trace the full order-to-cash flow. "trace" is optional as long as it’s a full O2C flow request for billing/doc id.
  const looksLikeFullFlow =
    lower.includes('trace') ||
    lower.includes('flow') ||
    lower.includes('end to end') ||
    lower.includes('end-to-end') ||
    lower.includes('full') ||
    lower.includes('order to cash') ||
    lower.includes('order-to-cash') ||
    lower.includes('o2c') ||
    lower.includes('payment') ||
    lower.includes('journal entry');

  if (hasBillingId && looksLikeFullFlow) {
    return { allow: true, action: 'TRACE_FULL_FLOW', id, n: null };
  }

  return null;
}

export async function classifyQuery(query) {
  // 1) Deterministic heuristics first (prevents LLM failures/rate-limits from breaking intent mapping).
  const heuristic = heuristicClassify(query);
  if (heuristic) return heuristic;

  // 2) If it doesn’t even look dataset-related, reject early.
  if (!keywordFallbackAllow(query)) {
    return { allow: false, action: 'REJECT', id: null, n: null };
  }

  const systemText =
    'You are a strict intent classifier for a SAP Order-to-Cash (O2C) graph system. ' +
    'You MUST map the user query into one of the supported actions below, or REJECT if unrelated. ' +
    'Supported actions: ' +
    'TRACE_FULL_FLOW (needs billing id), ' +
    'FIND_JOURNAL (needs billing id), ' +
    'FIND_REVERSALS (needs billing id), ' +
    'FIND_BROKEN_FLOWS, ' +
    'FIND_TOP_PRODUCTS (needs optional n limit). ' +
    'Rules: ' +
    '- If you detect a billing/document id, put it in `id` as a string of digits. ' +
    '- If you detect a numeric limit (top 10, first 3, limit 5), put it in `n` as an integer. ' +
    '- If missing, set them to null. ' +
    '- Always set `allow` to true when you mapped to a supported action (except REJECT). ' +
    '- Output ONLY valid JSON matching this shape: ' +
    '{ "allow": boolean, "action": string, "id": string|null, "n": number|null }';

  const geminiClassify = async () => {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) return null;
    const model = DEFAULT_GEMINI_MODEL;

    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': geminiApiKey,
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemText }] },
            contents: [
              {
                role: 'user',
                parts: [{ text: `User query:\n${String(query)}\n\nClassify into one supported action.` }],
              },
            ],
            generationConfig: { temperature: 0 },
          }),
        }
      );

      if (!resp.ok) return null;
      const data = await resp.json();
      const parts = data?.candidates?.[0]?.content?.parts || [];
      const text = parts.map(p => p?.text).filter(t => typeof t === 'string').join('');
      if (!text) return null;

      // Extract first JSON object (Gemini sometimes wraps text).
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start === -1 || end === -1 || end <= start) return null;

      const rawJson = text.slice(start, end + 1);
      const parsed = JSON.parse(rawJson);

      const action = parsed?.action || 'REJECT';
      const id = parsed?.id ?? null;
      const n = typeof parsed?.n === 'number' ? parsed.n : null;
      const allow = typeof parsed?.allow === 'boolean' ? parsed.allow : keywordFallbackAllow(query);
      const finalAllow = action !== 'REJECT' ? true : allow;

      return { allow: finalAllow, action, id, n };
    } catch {
      return null;
    }
  };

  // Use Gemini for semantic mapping if available.
  const geminiRes = await geminiClassify();
  if (geminiRes && geminiRes.action) return geminiRes;

  // We are dataset-related, but couldn’t confidently map to an action without the LLM.
  return { allow: true, action: 'REJECT', id: null, n: null };
}

// Backwards-compatible export name (older code might import it).
export { classifyQuery as classifyDatasetIntent };

