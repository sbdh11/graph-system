import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Graph } from '../src/core/graph.js';
import { loadData } from '../src/core/dataLoader.js';
import { QueryEngine } from '../src/core/queryEngine.js';

function writeJsonl(filePath, records) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const content = records.map((r) => JSON.stringify(r)).join('\n') + '\n';
  fs.writeFileSync(filePath, content, 'utf8');
}

describe('dataLoader — entity modeling smoke test', () => {
  it('creates Customer/Address/Plant/Material/OrderItem nodes and key edges', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'o2c-loader-smoke-'));

    try {
      // Customers + Addresses + Plants
      writeJsonl(path.join(tmpDir, 'business_partners', 'part-1.jsonl'), [
        {
          businessPartner: 'CUST1',
          customer: 'CUST1',
          businessPartnerCategory: '2',
          businessPartnerFullName: 'Test Customer',
          businessPartnerGrouping: 'Y101',
          businessPartnerName: 'Test Customer',
          creationDate: '2025-01-01T00:00:00.000Z',
          lastChangeDate: '2025-01-02T00:00:00.000Z',
        },
      ]);

      writeJsonl(path.join(tmpDir, 'business_partner_addresses', 'part-1.jsonl'), [
        {
          businessPartner: 'CUST1',
          addressId: 'ADDR1',
          addressUuid: 'uuid-1',
          addressTimeZone: 'INDIA',
          cityName: 'Test City',
          country: 'IN',
          postalCode: '12345',
          region: 'TS',
          streetName: 'Test Street',
        },
      ]);

      writeJsonl(path.join(tmpDir, 'plants', 'part-1.jsonl'), [
        {
          plant: 'PLANT1',
          plantName: 'Test Plant',
          valuationArea: 'VAL1',
          plantCustomer: 'PLANT1',
          plantSupplier: 'PLANT1',
          factoryCalendar: 'IN',
          defaultPurchasingOrganization: '',
          salesOrganization: 'ABCD',
          addressId: 'ADDR1',
          distributionChannel: '80',
          division: '99',
          language: 'EN',
          isMarkedForArchiving: false,
        },
      ]);

      // Core O2C chain nodes
      writeJsonl(path.join(tmpDir, 'sales_order_headers', 'part-1.jsonl'), [
        {
          salesOrder: 'ORDER1',
          salesOrderType: 'OR',
          totalNetAmount: '100',
          transactionCurrency: 'INR',
          soldToParty: 'CUST1',
          creationDate: '2025-01-01T00:00:00.000Z',
        },
      ]);

      writeJsonl(path.join(tmpDir, 'outbound_delivery_headers', 'part-1.jsonl'), [
        {
          deliveryDocument: 'DEL1',
          shippingPoint: '1301',
          creationDate: '2025-01-02T00:00:00.000Z',
        },
      ]);

      writeJsonl(path.join(tmpDir, 'sales_order_items', 'part-1.jsonl'), [
        {
          salesOrder: 'ORDER1',
          salesOrderItem: '10',
          salesOrderItemCategory: 'TAN',
          material: 'MAT1',
          requestedQuantity: '1',
          requestedQuantityUnit: 'PC',
          transactionCurrency: 'INR',
          netAmount: '10',
          materialGroup: 'MG1',
          productionPlant: 'PLANT1',
          storageLocation: 'SL1',
          salesDocumentRjcnReason: '',
          itemBillingBlockReason: '',
        },
      ]);

      writeJsonl(path.join(tmpDir, 'outbound_delivery_items', 'part-1.jsonl'), [
        {
          deliveryDocument: 'DEL1',
          referenceSdDocument: 'ORDER1',
          plant: 'PLANT1',
        },
      ]);

      writeJsonl(path.join(tmpDir, 'billing_document_headers', 'part-1.jsonl'), [
        {
          billingDocument: 'BILL1',
          billingDocumentType: 'S1',
          billingDocumentIsCancelled: false,
          cancelledBillingDocument: '',
          accountingDocument: 'JRN1',
          totalNetAmount: '100',
          transactionCurrency: 'INR',
        },
      ]);

      writeJsonl(path.join(tmpDir, 'billing_document_items', 'part-1.jsonl'), [
        {
          billingDocument: 'BILL1',
          referenceSdDocument: 'DEL1',
          material: 'MAT1',
          billingQuantity: '1',
          billingQuantityUnit: 'PC',
          netAmount: '100',
          transactionCurrency: 'INR',
          billingDocumentItem: '10',
        },
      ]);

      writeJsonl(path.join(tmpDir, 'journal_entry_items_accounts_receivable', 'part-1.jsonl'), [
        {
          accountingDocument: 'JRN1',
          referenceDocument: 'BILL1',
          amountInTransactionCurrency: '-100',
          transactionCurrency: 'INR',
          postingDate: '2025-01-03T00:00:00.000Z',
        },
      ]);

      writeJsonl(path.join(tmpDir, 'payments_accounts_receivable', 'part-1.jsonl'), [
        {
          accountingDocument: 'PAYDOC1',
          clearingAccountingDocument: 'JRN1',
          amountInTransactionCurrency: '100',
          transactionCurrency: 'INR',
          postingDate: '2025-01-04T00:00:00.000Z',
          customer: 'CUST1',
        },
      ]);

      const graph = new Graph();
      await loadData(graph, tmpDir);

      // Node types
      assert.ok(graph.getNodesByType('Customer').length > 0, 'Customer nodes should exist');
      assert.ok(graph.getNodesByType('Address').length > 0, 'Address nodes should exist');
      assert.ok(graph.getNodesByType('Plant').length > 0, 'Plant nodes should exist');
      assert.ok(graph.getNodesByType('Material').length > 0, 'Material nodes should exist');
      assert.ok(graph.getNodesByType('OrderItem').length > 0, 'OrderItem nodes should exist');

      // Key edges
      const custToDel = graph.getOutgoing('CUST1', 'CUSTOMER_TO_DELIVERY');
      assert.strictEqual(custToDel.length, 1);
      assert.strictEqual(custToDel[0].target, 'DEL1');

      const delToPlant = graph.getOutgoing('DEL1', 'DELIVERY_TO_PLANT');
      assert.strictEqual(delToPlant.length, 1);
      assert.strictEqual(delToPlant[0].target, 'PLANT1');

      const billingToMat = graph.getOutgoing('BILL1', 'BILLING_TO_MATERIAL');
      assert.strictEqual(billingToMat.length, 1);
      assert.strictEqual(billingToMat[0].target, 'MAT1');

      const engine = new QueryEngine(graph);
      const flow = engine.traceFullFlow('BILL1');
      assert.strictEqual(flow.order.id, 'ORDER1');
      assert.strictEqual(flow.delivery.id, 'DEL1');
      assert.strictEqual(flow.billing.id, 'BILL1');
      assert.strictEqual(flow.journalEntries[0].id, 'JRN1');
      assert.ok(flow.payments.length === 1);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

