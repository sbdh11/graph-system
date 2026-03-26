/**
 * Narrator: turn structured query results into conversational text.
 *
 * Streaming provider:
 * 1) Gemini (if GEMINI_API_KEY is set)
 * 2) deterministic fallback (never blocks the UI)
 */

const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';
const MAX_HISTORY_MESSAGES = Number(process.env.NARRATOR_MAX_HISTORY || '10');

// Simple in-memory cache to reduce repeated LLM calls.
// Note: this is server-local; restarting the server clears the cache.
const narrationCache = new Map(); // cacheKey -> { expiresAt, text }

// Avoid hammering Gemini when it is rate-limited or temporarily unavailable.
// When active, narrateStream will skip Gemini and return deterministic fallback immediately.
let geminiBackoffUntilMs = 0;

function stableSortValue(value) {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(stableSortValue);

  const out = {};
  for (const key of Object.keys(value).sort()) {
    out[key] = stableSortValue(value[key]);
  }
  return out;
}

function stableStringify(value) {
  try {
    return JSON.stringify(stableSortValue(value));
  } catch {
    // Best effort fallback; cache correctness is not critical.
    return String(value);
  }
}

function condenseResultForPrompt({ action, result }) {
  try {
    switch (action) {
      case 'TRACE_FULL_FLOW': {
        const r = result && typeof result === 'object' ? result : {};
        return JSON.stringify(
          {
            orderId: r.order?.id ?? null,
            deliveryId: r.delivery?.id ?? null,
            billingId: r.billing?.id ?? null,
            journalEntryIds: Array.isArray(r.journalEntries) ? r.journalEntries.map(j => j?.id ?? j?.originalId).filter(Boolean).slice(0, 30) : [],
            paymentIds: Array.isArray(r.payments) ? r.payments.map(p => p?.originalId ?? p?.id).filter(Boolean).slice(0, 30) : [],
          },
          null,
          0
        );
      }
      case 'FIND_JOURNAL': {
        const ids = Array.isArray(result) ? result.map(n => n?.id ?? n?.originalId).filter(Boolean).slice(0, 50) : [];
        return JSON.stringify({ journalEntryIds: ids }, null, 0);
      }
      case 'FIND_REVERSALS': {
        const billingDocumentId = result?.billingDocument?.id ?? null;
        const reversalDocumentIds = Array.isArray(result?.reversals)
          ? result.reversals.map(rev => rev?.document?.id ?? rev?.document?.originalId ?? rev?.id).filter(Boolean).slice(0, 50)
          : [];
        return JSON.stringify({ billingDocumentId, reversalDocumentIds }, null, 0);
      }
      case 'FIND_BROKEN_FLOWS': {
        const brokenOrders = result?.brokenOrders || [];
        const orphanBillings = result?.orphanBillings || [];
        return JSON.stringify(
          {
            brokenOrdersCount: Array.isArray(brokenOrders) ? brokenOrders.length : 0,
            orphanBillingsCount: Array.isArray(orphanBillings) ? orphanBillings.length : 0,
            brokenOrderIds: Array.isArray(brokenOrders) ? brokenOrders.slice(0, 30) : [],
            orphanBillingIds: Array.isArray(orphanBillings) ? orphanBillings.slice(0, 30) : [],
          },
          null,
          0
        );
      }
      case 'FIND_TOP_PRODUCTS': {
        const arr = Array.isArray(result) ? result : [];
        return JSON.stringify(
          arr.slice(0, 15).map(item => ({
            product: item?.product ?? item?.material ?? item?.id ?? null,
            count: item?.count ?? item?.billingCount ?? item?.billings ?? null,
          })),
          null,
          0
        );
      }
      default:
        return JSON.stringify(result);
    }
  } catch {
    return JSON.stringify(result);
  }
}

function fallbackNarration({ action, result }) {
  if (!result) return 'No analysis available.';

  if (Array.isArray(result)) {
    if (result.length === 0) {
      if (action === 'FIND_TOP_PRODUCTS') return 'No product data found.';
      if (action === 'FIND_JOURNAL') return 'No journal entries found.';
      return 'No results found.';
    }

    if (action === 'FIND_TOP_PRODUCTS') {
      const items = result
        .slice(0, 5)
        .map((item, i) => {
          const product = item?.product ?? item?.material ?? item?.id;
          const count = item?.count ?? item?.billingCount ?? item?.billings;
          if (!product) return null;
          if (typeof count !== 'number') return `${i + 1}. ${product} (billings: unavailable)`;
          return `${i + 1}. ${product} (${count} billings)`;
        })
        .filter(Boolean)
        .join(', ');
      return items ? `Top ranking products by billing frequency: ${items}.` : 'No product data found.';
    }

    if (action === 'FIND_JOURNAL') {
      const ids = result.map((n) => n?.id ?? n?.originalId).filter(Boolean);
      return ids.length ? `Linked journal entries: ${ids.join(', ')}.` : 'No journal entries found.';
    }

    const ids = result.map((n) => n?.id ?? n?.originalId ?? n?.product).filter(Boolean);
    return ids.length ? `Found ${ids.length} related item(s): ${ids.slice(0, 10).join(', ')}.` : 'Results unavailable.';
  }

  if (typeof result === 'object' && (result.brokenOrders || result.orphanBillings)) {
    const brokenOrders = result.brokenOrders || [];
    const orphanBillings = result.orphanBillings || [];
    if (brokenOrders.length === 0 && orphanBillings.length === 0) {
      return 'No inconsistencies found in the current flow.';
    }

    const parts = [];
    if (brokenOrders.length > 0) {
      parts.push(`${brokenOrders.length} order(s) have deliveries but no linked billing documents.`);
    }
    if (orphanBillings.length > 0) {
      parts.push(`${orphanBillings.length} billing document(s) have no linked delivery documents.`);
    }
    return parts.join(' ');
  }

  // Trace-style object narration.
  if (typeof result === 'object') {
    const r = result;
    const parts = [];
    if (r.order) {
      let s = `Order ${r.order.id}`;
      if (r.delivery) {
        s += ` was delivered via Delivery ${r.delivery.id}`;
        if (r.billing) s += ` and billed as ${r.billing.id}`;
      } else if (r.billing) {
        s += ` was billed as ${r.billing.id}`;
      }
      parts.push(`${s}.`);
    } else if (r.delivery) {
      let s = `Delivery ${r.delivery.id}`;
      if (r.billing) s += ` was billed as ${r.billing.id}`;
      parts.push(`${s}.`);
    } else if (r.billing) {
      parts.push(`Billing document ${r.billing.id}.`);
    }
    if (Array.isArray(r.journalEntries) && r.journalEntries.length > 0) {
      parts.push(`It generated journal entries: ${r.journalEntries.map(j => j.id).join(', ')}.`);
    }
    if (Array.isArray(r.payments) && r.payments.length > 0) {
      parts.push(`Payments received: ${r.payments.map(p => p.originalId || p.id).join(', ')}.`);
    }
    return parts.join(' ');
  }

  return 'No analysis available.';
}

async function* geminiStreamText({
  apiKey,
  model,
  systemInstruction,
  contents,
  temperature,
  maxOutputTokens,
  timeoutMs,
}) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), typeof timeoutMs === 'number' ? timeoutMs : 2000);

  let resp;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents,
        systemInstruction,
        generationConfig: {
          temperature: typeof temperature === 'number' ? temperature : 0.2,
          maxOutputTokens: typeof maxOutputTokens === 'number' ? maxOutputTokens : 220,
        },
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(t);
  }

  if (!resp.ok || !resp.body) {
    throw new Error(`Gemini streaming call failed (${resp.status}).`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder('utf-8');

  let buffer = '';
  let emitted = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;

      const payload = trimmed.slice('data:'.length).trim();
      if (!payload) continue;
      if (payload === '[DONE]') return;

      let parsed;
      try {
        parsed = JSON.parse(payload);
      } catch {
        continue;
      }

      const parts = parsed?.candidates?.[0]?.content?.parts || [];
      const currentText = parts.map(p => p?.text).filter(t => typeof t === 'string').join('');
      if (!currentText) continue;

      // If Gemini sends the entire accumulated text each chunk, avoid duplication.
      if (currentText.startsWith(emitted)) {
        const delta = currentText.slice(emitted.length);
        if (delta) {
          emitted += delta;
          yield delta;
        }
      } else {
        // Otherwise treat as delta (or at least best effort).
        emitted = currentText;
        yield currentText;
      }
    }
  }
}

export async function* narrateStream({ query, action, result, messages }) {
  const temperature = 0.2;

  const safeMessages = Array.isArray(messages) ? messages.slice(-MAX_HISTORY_MESSAGES) : [];

  const condensed = condenseResultForPrompt({ action, result });
  const cacheTtlMs = Number(process.env.NARRATOR_CACHE_TTL_MS || '300000'); // 5 minutes
  const cacheKey = `${String(action)}|${String(query)}|${condensed}`;
  const cached = narrationCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() && typeof cached.text === 'string') {
    yield cached.text;
    return;
  }

  // Circuit breaker: skip Gemini when we recently got rate limited/unavailable.
  if (Date.now() < geminiBackoffUntilMs) {
    const fallback = fallbackNarration({ action, result });
    narrationCache.set(cacheKey, { expiresAt: Date.now() + cacheTtlMs, text: fallback });
    yield fallback;
    return;
  }

  const system = {
    role: 'system',
    content:
      'You are a narrator for a SAP Order-to-Cash (O2C) graph analysis tool. ' +
      'Write conversational narration that is grounded in the provided result JSON. ' +
      'Do not invent numbers, entities, or relationships. ' +
      'If the result JSON is missing, say you cannot determine the answer from the dataset.',
  };

  const user = {
    role: 'user',
    content:
      `User query:\n${String(query)}\n\n` +
      `Structured action:\n${String(action)}\n\n` +
      `Structured result summary JSON:\n${condensed}\n\n` +
      'Narrate the answer conversationally (1-3 short paragraphs).',
  };

  const chatMessages = [system, ...safeMessages, user];

  let fullText = '';

  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (geminiApiKey) {
    try {
      const model = DEFAULT_GEMINI_MODEL;
      const systemInstruction = { parts: [{ text: system.content }] };
      const maxOutputTokens = Number(process.env.NARRATOR_MAX_OUTPUT_TOKENS || '220');
      const timeoutMs = Number(process.env.NARRATOR_GEMINI_TIMEOUT_MS || '2000');

      const geminiContents = [
        ...safeMessages
          .filter(m => m && m.role !== 'system')
          .map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: String(m.content ?? '') }],
          })),
        { role: 'user', parts: [{ text: user.content }] },
      ];

      for await (const chunk of geminiStreamText({
        apiKey: geminiApiKey,
        model,
        systemInstruction,
        contents: geminiContents,
        temperature,
        maxOutputTokens,
        timeoutMs,
      })) {
        fullText += chunk;
        yield chunk;
      }
    } catch (err) {
      console.warn('Gemini narration failed; using fallback.', err?.message || err);
      fullText = '';

      const msg = String(err?.message || err || '');
      // If Gemini is rate-limited, back off for a short window.
      if (msg.includes('429')) {
        geminiBackoffUntilMs = Date.now() + Number(process.env.NARRATOR_GEMINI_429_BACKOFF_MS || '60000');
      } else if (msg.includes('503')) {
        geminiBackoffUntilMs = Date.now() + Number(process.env.NARRATOR_GEMINI_503_BACKOFF_MS || '15000');
      } else {
        // Small default backoff to avoid thrashing on transient failures.
        geminiBackoffUntilMs = Date.now() + Number(process.env.NARRATOR_GEMINI_BACKOFF_MS || '5000');
      }
    }
  }

  if (!fullText) {
    const fallback = fallbackNarration({ action, result });
    narrationCache.set(cacheKey, { expiresAt: Date.now() + cacheTtlMs, text: fallback });
    yield fallback;
    return;
  }

  narrationCache.set(cacheKey, { expiresAt: Date.now() + cacheTtlMs, text: fullText });
}

