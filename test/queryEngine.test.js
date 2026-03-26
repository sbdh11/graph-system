import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Graph } from '../src/core/graph.js';
import { QueryEngine } from '../src/core/queryEngine.js';

function buildTestGraph() {
  const graph = new Graph();

  // Order
  graph.addNode('740542', 'Order', { type: 'OR', amount: '589.95', currency: 'INR', soldToParty: '320000082' });

  // Delivery
  graph.addNode('80754606', 'Delivery', { shippingPoint: '1301' });

  // Billing (F2 original + S1 reversal)
  graph.addNode('90678703', 'Billing', { type: 'F2', isCancelled: true, cancelledDoc: '' });
  graph.addNode('91150083', 'Billing', { type: 'S1', isCancelled: false, cancelledDoc: '90678703' });

  // Journal Entries
  graph.addNode('9400172480', 'JournalEntry', { refDoc: '90678703', amount: '2088.42' });
  graph.addNode('9400635854', 'JournalEntry', { refDoc: '91150083', amount: '-2088.42' });

  // Payment
  graph.addNode('PAY001', 'Payment', { clearingDoc: '9400635854', amount: '-2088.42' }, 'ORIGINAL_PAY001');

  // Materials
  graph.addNode('MAT1', 'Material', { material: 'MAT1' });
  graph.addNode('MAT2', 'Material', { material: 'MAT2' });

  // Edges
  graph.addEdge('740542', '80754606', 'ORDER_TO_DELIVERY');
  graph.addEdge('80754606', '90678703', 'DELIVERY_TO_BILLING');
  graph.addEdge('80754606', '91150083', 'DELIVERY_TO_BILLING');
  graph.addEdge('90678703', '9400172480', 'BILLING_TO_JOURNAL');
  graph.addEdge('91150083', '9400635854', 'BILLING_TO_JOURNAL');
  graph.addEdge('91150083', '90678703', 'REVERSAL');
  graph.addEdge('9400635854', 'PAY001', 'JOURNAL_TO_PAYMENT');

  // Billing -> Material edges (grounded aggregation input)
  graph.addEdge('90678703', 'MAT1', 'BILLING_TO_MATERIAL');
  graph.addEdge('90678703', 'MAT2', 'BILLING_TO_MATERIAL');
  graph.addEdge('91150083', 'MAT1', 'BILLING_TO_MATERIAL');

  // --- Broken/Orphan Data for Testing ---
  // Order with delivery but no billing
  graph.addNode('ORDER_BROKEN_1', 'Order', {});
  graph.addNode('DELIVERY_BROKEN_1', 'Delivery', {});
  graph.addEdge('ORDER_BROKEN_1', 'DELIVERY_BROKEN_1', 'ORDER_TO_DELIVERY');

  // Billing without delivery (Orphan)
  graph.addNode('BILLING_ORPHAN_1', 'Billing', { products: ['MAT1'] });
  graph.addEdge('BILLING_ORPHAN_1', 'MAT1', 'BILLING_TO_MATERIAL');
  
  // Assign products to existing billings
  graph.getNode('90678703').data.products = ['MAT1', 'MAT2'];
  graph.getNode('91150083').data.products = ['MAT1'];

  return graph;
}

describe('Phase 1 — findJournalByBilling + traceBillingFlow', () => {
  const graph = buildTestGraph();
  const engine = new QueryEngine(graph);

  it('findJournalByBilling returns the correct journal entry', () => {
    const journals = engine.findJournalByBilling('90678703');
    assert.strictEqual(journals.length, 1);
    assert.strictEqual(journals[0].id, '9400172480');
  });

  it('traceBillingFlow for F2 doc shows reversal by S1', () => {
    const flow = engine.traceBillingFlow('90678703');
    assert.strictEqual(flow.billingDocument.id, '90678703');
    assert.strictEqual(flow.journalEntries[0].id, '9400172480');
    assert.strictEqual(flow.reversals[0].direction, 'isReversedBy');
    assert.strictEqual(flow.reversals[0].document.id, '91150083');
  });

  it('traceBillingFlow for S1 doc shows it reverses F2', () => {
    const flow = engine.traceBillingFlow('91150083');
    assert.strictEqual(flow.reversals[0].direction, 'reverses');
    assert.strictEqual(flow.reversals[0].document.id, '90678703');
  });
});

describe('Phase 2 — traceFullFlow (full O2C)', () => {
  const graph = buildTestGraph();
  const engine = new QueryEngine(graph);

  it('traceFullFlow resolves full chain: order → delivery → billing → journal', () => {
    const flow = engine.traceFullFlow('90678703');

    assert.strictEqual(flow.order.id, '740542');
    assert.strictEqual(flow.order.type, 'Order');
    assert.strictEqual(flow.delivery.id, '80754606');
    assert.strictEqual(flow.delivery.type, 'Delivery');
    assert.strictEqual(flow.billing.id, '90678703');
    assert.strictEqual(flow.journalEntries.length, 1);
    assert.strictEqual(flow.journalEntries[0].id, '9400172480');
  });

  it('traceFullFlow for S1 finds payment via journal clearing', () => {
    const flow = engine.traceFullFlow('91150083');

    assert.strictEqual(flow.order.id, '740542');
    assert.strictEqual(flow.delivery.id, '80754606');
    assert.strictEqual(flow.billing.id, '91150083');
    assert.strictEqual(flow.journalEntries[0].id, '9400635854');
    assert.strictEqual(flow.payments.length, 1);
    assert.strictEqual(flow.payments[0].id, 'PAY001');
    assert.strictEqual(flow.payments[0].type, 'Payment');
    assert.strictEqual(flow.payments[0].originalId, 'ORIGINAL_PAY001');
  });

  it('traceFullFlow for non-existent billing returns all nulls', () => {
    const flow = engine.traceFullFlow('DOESNOTEXIST');
    assert.strictEqual(flow.order, null);
    assert.strictEqual(flow.delivery, null);
    assert.strictEqual(flow.billing, null);
    assert.strictEqual(flow.journalEntries.length, 0);
    assert.strictEqual(flow.payments.length, 0);
    assert.strictEqual(flow.reversals.length, 0);
  });

  it('traceFullFlow includes reversal information', () => {
    const flow = engine.traceFullFlow('90678703');
    assert.strictEqual(flow.reversals.length, 1);
    assert.strictEqual(flow.reversals[0].direction, 'isReversedBy');
    assert.strictEqual(flow.reversals[0].document.id, '91150083');
  });
});

describe('Phase 3 — Broken Flows + Top Products', () => {
  const graph = buildTestGraph();
  const engine = new QueryEngine(graph);

  it('findBrokenFlows identifies the broken order and orphan billing', () => {
    const result = engine.findBrokenFlows();
    
    assert.ok(result.brokenOrders.includes('ORDER_BROKEN_1'), 'Should identify ORDER_BROKEN_1');
    assert.ok(!result.brokenOrders.includes('740542'), 'Should NOT flag valid order 740542');
    
    assert.ok(result.orphanBillings.includes('BILLING_ORPHAN_1'), 'Should identify BILLING_ORPHAN_1');
    assert.ok(!result.orphanBillings.includes('90678703'), 'Should NOT flag valid billing 90678703');
  });

  it('findTopProducts returns sorted counts of materials', () => {
    // MAT1 appears in 3 billings, MAT2 appears in 1 billing
    const top = engine.findTopProducts(5);
    
    assert.strictEqual(top.length, 2);
    assert.strictEqual(top[0].product, 'MAT1');
    assert.strictEqual(top[0].count, 3);
    assert.strictEqual(top[1].product, 'MAT2');
    assert.strictEqual(top[1].count, 1);
  });

  it('findTopProducts respects the limit parameter', () => {
    const top = engine.findTopProducts(1);
    assert.strictEqual(top.length, 1);
    assert.strictEqual(top[0].product, 'MAT1');
  });
});
