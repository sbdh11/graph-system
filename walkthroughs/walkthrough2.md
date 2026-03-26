# SAP O2C Graph Query Engine — Full Flow Walkthrough

## What Was Built
Extended the graph engine from Billing ↔ Journal + Reversal to the complete Order-to-Cash chain:

```
Order → Delivery → Billing → Journal Entry → Payment
                                  ↕ Reversal
```

## Edge Types

| Edge | Direction | Linking Fields |
|---|---|---|
| `ORDER_TO_DELIVERY` | Order → Delivery | `delivery_items.referenceSdDocument` → `salesOrder` |
| `DELIVERY_TO_BILLING` | Delivery → Billing | `billing_items.referenceSdDocument` → `deliveryDocument` |
| `BILLING_TO_JOURNAL` | Billing → Journal | `billing_headers.accountingDocument` |
| `JOURNAL_TO_PAYMENT` | Journal → Payment | `payments.clearingAccountingDocument` |
| `REVERSAL` | Reversal doc → Original | `billing_headers.cancelledBillingDocument` |

## Files Modified

- [dataLoader.js](file:///c:/Users/Admin/new-ts/src/dataLoader.js) — 7-step loader for all entity types with deduplication
- [queryEngine.js](file:///c:/Users/Admin/new-ts/src/queryEngine.js) — Added [traceFullFlow(billingId)](file:///c:/Users/Admin/new-ts/src/queryEngine.js#66-128)
- [index.js](file:///c:/Users/Admin/new-ts/src/index.js) — Demo runner
- [queryEngine.test.js](file:///c:/Users/Admin/new-ts/test/queryEngine.test.js) — 7 unit tests

## Verification

### Real Dataset Output (billing `90678703`)
```json
{
  "order": { "id": "740542", "type": "Order" },
  "delivery": { "id": "80754606", "type": "Delivery" },
  "billing": { "id": "90678703", "type": "Billing", "data": { "type": "F2" } },
  "journalEntries": [{ "id": "9400172480" }],
  "payments": [],
  "reversals": [{ "direction": "isReversedBy", "document": { "id": "91150083" } }]
}
```

Graph stats: **512 nodes, 498 edge sets** loaded from the dataset.

### Unit Tests (7/7 pass)
```
✔ findJournalByBilling returns the correct journal entry
✔ traceBillingFlow for F2 doc shows reversal by S1
✔ traceBillingFlow for S1 doc shows it reverses F2
✔ traceFullFlow resolves full chain: order → delivery → billing → journal
✔ traceFullFlow for S1 finds payment via journal clearing
✔ traceFullFlow for non-existent billing returns all nulls
✔ traceFullFlow includes reversal information
```
