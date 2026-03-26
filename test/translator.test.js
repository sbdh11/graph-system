import { describe, it } from 'node:test';
import assert from 'node:assert';
import { translate } from '../src/llm/translator.js';

describe('Translator — rule-based query parsing', () => {
  it('parses "trace billing 91150083" → TRACE_FULL_FLOW', () => {
    const result = translate('trace billing 91150083');
    assert.strictEqual(result.action, 'TRACE_FULL_FLOW');
    assert.strictEqual(result.id, '91150083');
  });

  it('parses "find journal for billing 90678703" → FIND_JOURNAL', () => {
    const result = translate('find journal for billing 90678703');
    assert.strictEqual(result.action, 'FIND_JOURNAL');
    assert.strictEqual(result.id, '90678703');
  });

  it('parses "show reversal for billing 91150083" → FIND_REVERSALS', () => {
    const result = translate('show reversal for billing 91150083');
    assert.strictEqual(result.action, 'FIND_REVERSALS');
    assert.strictEqual(result.id, '91150083');
  });

  it('parses "find me the billing for 91150083" → TRACE_FULL_FLOW', () => {
    const result = translate('find me the billing for 91150083');
    assert.strictEqual(result.action, 'TRACE_FULL_FLOW');
    assert.strictEqual(result.id, '91150083');
  });

  it('parses "show broken flows" → FIND_BROKEN_FLOWS', () => {
    const result = translate('show broken flows');
    assert.strictEqual(result.action, 'FIND_BROKEN_FLOWS');
  });

  it('parses "show top 10 products from billing documents" → FIND_TOP_PRODUCTS with n=10', () => {
    const result = translate('show top 10 products from billing documents');
    assert.strictEqual(result.action, 'FIND_TOP_PRODUCTS');
    assert.strictEqual(result.n, 10);
  });

  it('parses "show top products from billing documents" → FIND_TOP_PRODUCTS with default n=5', () => {
    const result = translate('show top products from billing documents');
    assert.strictEqual(result.action, 'FIND_TOP_PRODUCTS');
    assert.strictEqual(result.n, 5);
  });

  it('rejects trace queries without numeric IDs', () => {
    const result = translate('trace billing document');
    assert.strictEqual(result.action, 'REJECT');
  });

  it('rejects unrelated queries', () => {
    const result = translate('who is PM of India');
    assert.strictEqual(result.action, 'REJECT');
  });

  it('rejects empty/null input', () => {
    assert.strictEqual(translate('').action, 'REJECT');
    assert.strictEqual(translate(null).action, 'REJECT');
    assert.strictEqual(translate(undefined).action, 'REJECT');
  });

  it('is case-insensitive', () => {
    const result = translate('TRACE BILLING 91150083');
    assert.strictEqual(result.action, 'TRACE_FULL_FLOW');
  });
});
