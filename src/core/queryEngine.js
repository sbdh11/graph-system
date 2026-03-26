export class QueryEngine {
  constructor(graph) {
    this.graph = graph;
  }

  findJournalByBilling(billingId) {
    const node = this.graph.getNode(billingId);
    if (!node) {
      throw new Error(`Billing document ${billingId} not found`);
    }

    const edges = this.graph.getEdges(billingId);
    const journalEdges = edges.filter(e => e.type === 'BILLING_TO_JOURNAL' && e.dir === 'out');
    
    if (journalEdges.length === 0) {
      return null;
    }

    // Return the linked journal entry nodes
    return journalEdges.map(e => this.graph.getNode(e.target));
  }

  traceBillingFlow(billingId) {
    const result = {
      billingDocument: null,
      journalEntries: [],
      reversals: []
    };

    const node = this.graph.getNode(billingId);
    if (!node) return result;

    result.billingDocument = node;

    const edges = this.graph.getEdges(billingId);
    
    // Find journal entries
    const journalEdges = edges.filter(e => e.type === 'BILLING_TO_JOURNAL' && e.dir === 'out');
    for (const edge of journalEdges) {
      result.journalEntries.push(this.graph.getNode(edge.target));
    }

    // Find reversals
    // A reversal edge could be incoming (another doc reverses this one) 
    // or outgoing (this doc reverses another). Let's trace both.
    
    const incomingReversals = edges.filter(e => e.type === 'REVERSAL' && e.dir === 'in');
    for (const edge of incomingReversals) {
       result.reversals.push({
         direction: 'isReversedBy',
         document: this.graph.getNode(edge.target)
       });
    }

    const outgoingReversals = edges.filter(e => e.type === 'REVERSAL' && e.dir === 'out');
    for (const edge of outgoingReversals) {
       result.reversals.push({
         direction: 'reverses',
         document: this.graph.getNode(edge.target)
       });
    }

    return result;
  }

  traceFullFlow(billingId) {
    const result = {
      order: null,
      delivery: null,
      billing: null,
      journalEntries: [],
      payments: [],
      reversals: []
    };

    const billingNode = this.graph.getNode(billingId);
    if (!billingNode) return result;

    result.billing = billingNode;
    const billingEdges = this.graph.getEdges(billingId);

    // Journal entries (outgoing BILLING_TO_JOURNAL)
    const journalEdges = billingEdges.filter(e => e.type === 'BILLING_TO_JOURNAL' && e.dir === 'out');
    for (const edge of journalEdges) {
      result.journalEntries.push(this.graph.getNode(edge.target));
    }

    // Payments (from journal entries via JOURNAL_TO_PAYMENT)
    for (const journal of result.journalEntries) {
      const jEdges = this.graph.getEdges(journal.id);
      const paymentEdges = jEdges.filter(e => e.type === 'JOURNAL_TO_PAYMENT' && e.dir === 'out');
      for (const pe of paymentEdges) {
        const paymentNode = this.graph.getNode(pe.target);
        if (paymentNode && paymentNode.type === 'Payment' && !result.payments.find(p => p.id === paymentNode.id)) {
          result.payments.push(paymentNode);
        } else if (paymentNode && paymentNode.type !== 'Payment') {
          console.warn(`Warning: expected Payment node but found ${paymentNode.type} for ${paymentNode.id}`);
        }
      }
    }

    // Delivery (incoming DELIVERY_TO_BILLING)
    const deliveryEdges = billingEdges.filter(e => e.type === 'DELIVERY_TO_BILLING' && e.dir === 'in');
    if (deliveryEdges.length > 0) {
      const deliveryNode = this.graph.getNode(deliveryEdges[0].target);
      result.delivery = deliveryNode;

      // Order (incoming ORDER_TO_DELIVERY from delivery)
      if (deliveryNode) {
        const delEdges = this.graph.getEdges(deliveryNode.id);
        const orderEdges = delEdges.filter(e => e.type === 'ORDER_TO_DELIVERY' && e.dir === 'in');
        if (orderEdges.length > 0) {
          result.order = this.graph.getNode(orderEdges[0].target);
        }
      }
    }

    // Reversals
    const incomingReversals = billingEdges.filter(e => e.type === 'REVERSAL' && e.dir === 'in');
    for (const edge of incomingReversals) {
      result.reversals.push({ direction: 'isReversedBy', document: this.graph.getNode(edge.target) });
    }
    const outgoingReversals = billingEdges.filter(e => e.type === 'REVERSAL' && e.dir === 'out');
    for (const edge of outgoingReversals) {
      result.reversals.push({ direction: 'reverses', document: this.graph.getNode(edge.target) });
    }

    return result;
  }

  findBrokenFlows() {
    const brokenOrders = [];
    const orphanBillings = [];

    const orders = this.graph.getNodesByType('Order');
    const billings = this.graph.getNodesByType('Billing');

    // --- Broken Orders ---
    for (const order of orders) {
      const deliveries = this.graph.getOutgoing(order.id, 'ORDER_TO_DELIVERY');
      if (!deliveries || deliveries.length === 0) continue;

      let hasBilling = false;
      for (const delivery of deliveries) {
        const billingEdges = this.graph.getOutgoing(delivery.target, 'DELIVERY_TO_BILLING');
        if (billingEdges && billingEdges.length > 0) {
          hasBilling = true;
          break;
        }
      }

      if (!hasBilling) {
        brokenOrders.push(order.id);
      }
    }

    // --- Orphan Billings ---
    for (const billing of billings) {
      const deliveryEdges = this.graph.getIncoming(billing.id, 'DELIVERY_TO_BILLING');
      if (!deliveryEdges || deliveryEdges.length === 0) {
        orphanBillings.push(billing.id);
      }
    }

    return {
      brokenOrders,
      orphanBillings
    };
  }

  findTopProducts(n = 5) {
    const counts = {};
    const billings = this.graph.getNodesByType('Billing');

    for (const billing of billings) {
      // Grounded aggregation: count how many billing documents connect to each Material node.
      const edges = this.graph.getEdges(billing.id);
      const materialEdges = edges.filter(e => e.type === 'BILLING_TO_MATERIAL' && e.dir === 'out');

      for (const edge of materialEdges) {
        const materialId = edge.target;
        if (!materialId) continue;
        counts[materialId] = (counts[materialId] || 0) + 1;
      }
    }

    return Object.entries(counts)
      .map(([product, count]) => ({ product, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, n);
  }
}
