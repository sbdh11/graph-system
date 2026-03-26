import fs from 'fs';
import readline from 'readline';
import path from 'path';

// Force all graph IDs to strings to prevent fragmented joins.
function asId(rawId) {
  return String(rawId);
}

export async function loadData(graph, dataDir) {
  const billingDir = path.join(dataDir, 'billing_document_headers');
  const billingItemsDir = path.join(dataDir, 'billing_document_items');
  const journalDir = path.join(dataDir, 'journal_entry_items_accounts_receivable');
  const deliveryHeadersDir = path.join(dataDir, 'outbound_delivery_headers');
  const deliveryItemsDir = path.join(dataDir, 'outbound_delivery_items');
  const salesOrderDir = path.join(dataDir, 'sales_order_headers');
  const salesOrderItemsDir = path.join(dataDir, 'sales_order_items');
  const paymentsDir = path.join(dataDir, 'payments_accounts_receivable');

  const businessPartnersDir = path.join(dataDir, 'business_partners');
  const businessPartnerAddressesDir = path.join(dataDir, 'business_partner_addresses');
  const plantsDir = path.join(dataDir, 'plants');

  // Used to derive Customer -> Delivery edges via delivery items that reference sales orders.
  const orderToCustomer = new Map(); // OrderId -> CustomerId

  // 0. Load Customers (business partners)
  await loadDir(businessPartnersDir, graph, (record) => {
    const customerId = asId(record.customer ?? record.businessPartner);
    if (!customerId) return;

    graph.addNode(customerId, 'Customer', {
      businessPartner: record.businessPartner,
      customer: record.customer,
      businessPartnerFullName: record.businessPartnerFullName,
      businessPartnerName: record.businessPartnerName,
      businessPartnerGrouping: record.businessPartnerGrouping,
      businessPartnerCategory: record.businessPartnerCategory,
      creationDate: record.creationDate,
      lastChangeDate: record.lastChangeDate,
    });
  });

  // 0b. Load Addresses + Customer -> Address edges
  await loadDir(businessPartnerAddressesDir, graph, (record) => {
    const customerId = asId(record.businessPartner);
    const addressId = asId(record.addressId);
    if (!customerId || !addressId) return;

    graph.addNode(addressId, 'Address', {
      addressUuid: record.addressUuid,
      addressTimeZone: record.addressTimeZone,
      cityName: record.cityName,
      country: record.country,
      postalCode: record.postalCode,
      region: record.region,
      streetName: record.streetName,
    });

    graph.addEdge(customerId, addressId, 'CUSTOMER_TO_ADDRESS');
  });

  // 0c. Load Plants (+ optional Plant -> Address edge)
  await loadDir(plantsDir, graph, (record) => {
    const plantId = asId(record.plant);
    if (!plantId) return;

    const addressId = record.addressId ? asId(record.addressId) : null;

    graph.addNode(plantId, 'Plant', {
      plantName: record.plantName,
      valuationArea: record.valuationArea,
      factoryCalendar: record.factoryCalendar,
      salesOrganization: record.salesOrganization,
      distributionChannel: record.distributionChannel,
      division: record.division,
      addressId: addressId,
    });

    if (addressId) {
      graph.addEdge(plantId, addressId, 'PLANT_TO_ADDRESS');
    }
  });

  // 1. Load Billing Document Headers
  await loadDir(billingDir, graph, (record) => {
    const {
      billingDocument, billingDocumentType, billingDocumentIsCancelled,
      cancelledBillingDocument, accountingDocument, totalNetAmount, transactionCurrency
    } = record;

    const billing = { id: asId(billingDocument) };
    graph.addNode(billing.id, 'Billing', {
      type: billingDocumentType, isCancelled: billingDocumentIsCancelled,
      cancelledDoc: cancelledBillingDocument ? asId(cancelledBillingDocument) : cancelledBillingDocument,
      amount: totalNetAmount, currency: transactionCurrency,
      products: []
    });

    if (accountingDocument && accountingDocument !== "") {
      const journal = { id: asId(accountingDocument) };
      graph.addNode(journal.id, 'JournalEntry');
      console.log("LINKING:", billing.id, "→", journal.id);
      graph.addEdge(billing.id, journal.id, "BILLING_TO_JOURNAL");
    }

    if (cancelledBillingDocument && cancelledBillingDocument !== "") {
      const cancelledBilling = { id: asId(cancelledBillingDocument) };
      graph.addNode(cancelledBilling.id, 'Billing');
      graph.addEdge(billing.id, cancelledBilling.id, "REVERSAL");
    }
  });

  // 2. Load Journal Entries
  await loadDir(journalDir, graph, (record) => {
    const { accountingDocument, referenceDocument, amountInTransactionCurrency, transactionCurrency, postingDate } = record;
    const journal = { id: asId(accountingDocument) };
    graph.addNode(journal.id, 'JournalEntry', {
      refDoc: referenceDocument, amount: amountInTransactionCurrency,
      currency: transactionCurrency, postingDate
    });
  });

  // 3. Load Sales Order Headers
  await loadDir(salesOrderDir, graph, (record) => {
    const { salesOrder, salesOrderType, totalNetAmount, transactionCurrency, soldToParty, creationDate } = record;
    const order = { id: asId(salesOrder) };
    graph.addNode(order.id, 'Order', {
      type: salesOrderType, amount: totalNetAmount, currency: transactionCurrency,
      soldToParty, creationDate
    });

    // Used later to derive Customer -> Delivery edges from delivery items.
    if (soldToParty) {
      orderToCustomer.set(order.id, asId(soldToParty));
    }
  });

  // 4. Load Outbound Delivery Headers
  await loadDir(deliveryHeadersDir, graph, (record) => {
    const { deliveryDocument, shippingPoint, creationDate } = record;
    const delivery = { id: asId(deliveryDocument) };
    graph.addNode(delivery.id, 'Delivery', { shippingPoint, creationDate });
  });

  // 4b. Load Sales Order Items -> Material (as OrderItem nodes)
  await loadDir(salesOrderItemsDir, graph, (record) => {
    const salesOrderId = record.salesOrder ? asId(record.salesOrder) : null;
    const salesOrderItemId = record.salesOrderItem ? asId(record.salesOrderItem) : null;
    const materialId = record.material ? asId(record.material) : null;
    if (!salesOrderId || !salesOrderItemId || !materialId) return;

    const orderItemId = `${salesOrderId}:${salesOrderItemId}`;

    graph.addNode(orderItemId, 'OrderItem', {
      salesOrder: record.salesOrder,
      salesOrderItem: record.salesOrderItem,
      material: record.material,
      requestedQuantity: record.requestedQuantity,
      requestedQuantityUnit: record.requestedQuantityUnit,
      netAmount: record.netAmount,
      transactionCurrency: record.transactionCurrency,
      materialGroup: record.materialGroup,
      productionPlant: record.productionPlant,
      storageLocation: record.storageLocation,
    });

    graph.addNode(materialId, 'Material', {
      material: record.material,
      materialGroup: record.materialGroup,
    });

    graph.addEdge(salesOrderId, orderItemId, 'ORDER_TO_ORDER_ITEM');
    graph.addEdge(orderItemId, materialId, 'ORDER_ITEM_TO_MATERIAL');
  });

  // 5. Load Outbound Delivery Items → ORDER_TO_DELIVERY edges
  const seenOrderDelivery = new Set();
  await loadDir(deliveryItemsDir, graph, (record) => {
    const { deliveryDocument, referenceSdDocument, plant } = record;
    if (referenceSdDocument && referenceSdDocument !== "") {
      const order = { id: asId(referenceSdDocument) };
      const delivery = { id: asId(deliveryDocument) };
      const key = `${order.id}->${delivery.id}`;
      if (!seenOrderDelivery.has(key)) {
        seenOrderDelivery.add(key);
        graph.addNode(order.id, 'Order');
        graph.addNode(delivery.id, 'Delivery');
        console.log("LINKING:", order.id, "→", delivery.id);
        graph.addEdge(order.id, delivery.id, "ORDER_TO_DELIVERY");
      }

      // Customer -> Delivery via known Order -> Customer mapping.
      const customerId = orderToCustomer.get(order.id);
      if (customerId) {
        graph.addNode(customerId, 'Customer', {});
        graph.addEdge(customerId, delivery.id, 'CUSTOMER_TO_DELIVERY');
      }

      // Delivery -> Plant via delivery item plant.
      if (plant) {
        const plantId = asId(plant);
        graph.addNode(plantId, 'Plant', { plant });
        graph.addEdge(delivery.id, plantId, 'DELIVERY_TO_PLANT');
      }
    }
  });

  const seenDeliveryBilling = new Set();
  const billingToProducts = new Map();

  await loadDir(billingItemsDir, graph, (record) => {
    const { billingDocument, referenceSdDocument, material } = record;
    const billing = { id: asId(billingDocument) };
    const billingId = billing.id;
    
    // Track materials for each billing document
    if (material) {
      if (!billingToProducts.has(billingId)) {
        billingToProducts.set(billingId, new Set());
      }
      billingToProducts.get(billingId).add(material);

      // Billing -> Material edge (supports grounded aggregation queries).
      const materialId = asId(material);
      graph.addNode(materialId, 'Material', { material });
      graph.addEdge(billingId, materialId, 'BILLING_TO_MATERIAL');
    }

    if (referenceSdDocument && referenceSdDocument !== "") {
      const delivery = { id: asId(referenceSdDocument) };
      // Reuse the already-forced string billing id
      const key = `${delivery.id}->${billing.id}`;
      if (!seenDeliveryBilling.has(key)) {
        seenDeliveryBilling.add(key);
        graph.addNode(delivery.id, 'Delivery');
        graph.addNode(billing.id, 'Billing');
        console.log("LINKING:", delivery.id, "→", billing.id);
        graph.addEdge(delivery.id, billing.id, "DELIVERY_TO_BILLING");
      }
    }
  });

  // Attach deduplicated products to Billing nodes
  for (const [billingId, productSet] of billingToProducts.entries()) {
    const node = graph.getNode(billingId);
    if (node && node.type === 'Billing') {
      node.data.products = Array.from(productSet);
    }
  }

  // 7. Load Payments → JOURNAL_TO_PAYMENT edges
  await loadDir(paymentsDir, graph, (record) => {
    const { accountingDocument, clearingAccountingDocument, amountInTransactionCurrency, transactionCurrency, postingDate, customer } = record;
    const payment = { id: `PAY:${asId(accountingDocument)}` };
    const journal = { id: asId(clearingAccountingDocument) };

    graph.addNode(payment.id, 'Payment', {
      clearingDoc: journal.id,
      amount: amountInTransactionCurrency,
      currency: transactionCurrency, postingDate, customer
    }, asId(accountingDocument));

    // Link journal entry → payment via clearingAccountingDocument
    const clearingDocId = String(clearingAccountingDocument);
    const paymentClearsDifferentJournal = clearingDocId !== "" && clearingDocId !== String(accountingDocument);
    if (paymentClearsDifferentJournal) {
      graph.addNode(journal.id, 'JournalEntry');
      console.log("LINKING:", journal.id, "→", payment.id);
      graph.addEdge(journal.id, payment.id, "JOURNAL_TO_PAYMENT");
    }
  });
}

async function loadDir(dir, graph, callback) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsonl'));
  for (const file of files) {
    await processJsonl(path.join(dir, file), callback);
  }
}

async function processJsonl(filePath, callback) {
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const record = JSON.parse(line);
      callback(record);
    } catch (err) {
      console.error(`Error parsing JSON in ${filePath}:`, err.message);
    }
  }
}
