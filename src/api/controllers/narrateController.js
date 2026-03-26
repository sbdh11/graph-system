import { streamNarration } from '../../services/narrateService.js';

/**
 * Streaming narration controller.
 * Preserves the exact streaming behavior from the original server.js handler.
 */
export async function narrateHandler(req, res) {
  const { query, action, result, messages } = req.body || {};

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform, must-revalidate');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // Flush as soon as possible so the frontend starts receiving tokens.
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  try {
    for await (const chunk of streamNarration({ query, action, result, messages })) {
      res.write(String(chunk));
    }
  } catch {
    // If narration fails, send nothing (frontend will fallback).
  } finally {
    res.end();
  }
}
