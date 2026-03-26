import { REJECT_MESSAGE, DOMAIN_KEYWORDS } from '../config/index.js';

/**
 * Express middleware: rejects queries that don't match any O2C domain keyword.
 * Extracted from the inline guard in the original /query handler.
 */
export function domainGuard(req, res, next) {
  const queryLower = String(req.body?.query || '').toLowerCase();
  const isDomainQuery = DOMAIN_KEYWORDS.some((k) => queryLower.includes(k));

  if (!isDomainQuery) {
    return res.json({ answer: REJECT_MESSAGE, action: null, result: null });
  }

  next();
}
