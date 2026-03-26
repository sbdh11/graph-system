// src/components/ResultCards.jsx
import { Card } from '@/components/ui/card';
import { getNodeColor } from '../constants/nodeColors';

const renderBadge = (id) => (
  <span className="font-mono text-xs text-foreground/80 bg-background border border-border px-2 py-0.5 rounded shadow-sm">
    {id}
  </span>
);

export const FormattedOutput = ({ data }) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  if (!data.order && !data.delivery && !data.billing && !data.journalEntries && !data.payments) return null;

  return (
    <Card className="p-4 rounded-xl shadow-md space-y-3.5 text-sm">
      <h3 className="font-semibold text-foreground">Trace Result</h3>
      {data.order && (
        <div className="flex gap-3 items-start">
          <div className="flex items-center gap-1.5 w-24 shrink-0 mt-0.5">
            <span className="w-2 h-2 rounded-full" style={{backgroundColor: getNodeColor('Order')}}></span>
            <span className="font-medium text-foreground/90">Order</span>
          </div>
          <div className="flex flex-wrap gap-1.5">{renderBadge(data.order.id)}</div>
        </div>
      )}
      {data.delivery && (
        <div className="flex gap-3 items-start">
          <div className="flex items-center gap-1.5 w-24 shrink-0 mt-0.5">
            <span className="w-2 h-2 rounded-full" style={{backgroundColor: getNodeColor('Delivery')}}></span>
            <span className="font-medium text-foreground/90">Delivery</span>
          </div>
          <div className="flex flex-wrap gap-1.5">{renderBadge(data.delivery.id)}</div>
        </div>
      )}
      {data.billing && (
        <div className="flex gap-3 items-start">
          <div className="flex items-center gap-1.5 w-24 shrink-0 mt-0.5">
            <span className="w-2 h-2 rounded-full" style={{backgroundColor: getNodeColor('Billing')}}></span>
            <span className="font-medium text-foreground/90">Billing</span>
          </div>
          <div className="flex flex-wrap gap-1.5">{renderBadge(data.billing.id)}</div>
        </div>
      )}
      {data.journalEntries?.length > 0 && (
        <div className="flex gap-3 items-start">
          <div className="flex items-center gap-1.5 w-24 shrink-0 mt-0.5">
            <span className="w-2 h-2 rounded-full" style={{backgroundColor: getNodeColor('JournalEntry')}}></span>
            <span className="font-medium text-foreground/90">Journals</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {data.journalEntries.map(j => <span key={j.id}>{renderBadge(j.id)}</span>)}
          </div>
        </div>
      )}
      {data.payments?.length > 0 && (
        <div className="flex gap-3 items-start">
          <div className="flex items-center gap-1.5 w-24 shrink-0 mt-0.5">
            <span className="w-2 h-2 rounded-full" style={{backgroundColor: getNodeColor('Payment')}}></span>
            <span className="font-medium text-foreground/90">Payments</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {data.payments.map(p => <span key={p.id}>{renderBadge(p.originalId || p.id)}</span>)}
          </div>
        </div>
      )}
    </Card>
  );
};

export const TopProductsCard = ({ data }) => {
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <Card className="p-4 rounded-xl shadow-md">
        <h3 className="font-semibold mb-2 text-foreground">Top Products</h3>
        <p className="text-sm text-muted-foreground">No product data found.</p>
      </Card>
    );
  }

  const maxCount = data[0].count;

  return (
    <Card className="p-4 rounded-xl shadow-md">
      <h3 className="font-semibold mb-4 text-foreground">Top Products</h3>
      {data.map((p, i) => (
        <div key={p.product} className="mb-3 last:mb-0">
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded">
                #{i + 1}
              </span>
              <span className="font-mono text-foreground/90">{p.product}</span>
            </div>
            <span className="text-sm text-muted-foreground tabular-nums">
              {p.count} billings
            </span>
          </div>
          <div className="w-full bg-muted h-2 rounded mt-1.5">
            <div
              className="h-2 rounded transition-all duration-500"
              style={{
                width: `${(p.count / maxCount) * 100}%`,
                background: 'linear-gradient(90deg, #10b981, #34d399, #6ee7b7)', 
              }}
            />
          </div>
        </div>
      ))}
    </Card>
  );
};

export const BrokenFlowsCard = ({ data }) => {
  if (!data || typeof data !== 'object') return null;

  const brokenOrders = data.brokenOrders || [];
  const orphanBillings = data.orphanBillings || [];
  const isClean = brokenOrders.length === 0 && orphanBillings.length === 0;

  return (
    <Card className="p-4 rounded-xl shadow-md">
      <h3 className="font-semibold mb-3 text-foreground">Flow Anomalies</h3>
      {isClean ? (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          No anomalies detected — all flows are complete.
        </div>
      ) : (
        <div className="space-y-4">
          {brokenOrders.length > 0 && (
            <div>
              <div className="text-sm font-medium text-foreground/90 mb-1.5 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                Orders without billing
                <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold">
                  {brokenOrders.length}
                </span>
              </div>
              <div className="ml-4 space-y-1">
                {brokenOrders.map(id => (
                  <div key={id} className="text-xs font-mono text-muted-foreground">{id}</div>
                ))}
              </div>
            </div>
          )}
          {orphanBillings.length > 0 && (
            <div>
              <div className="text-sm font-medium text-foreground/90 mb-1.5 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                Billings without delivery
                <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-semibold">
                  {orphanBillings.length}
                </span>
              </div>
              <div className="ml-4 space-y-1">
                {orphanBillings.map(id => (
                  <div key={id} className="text-xs font-mono text-muted-foreground">{id}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

export const JournalEntriesCard = ({ data }) => {
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <Card className="p-4 rounded-xl shadow-md">
        <h3 className="font-semibold mb-2 text-foreground">Journal Entries</h3>
        <p className="text-sm text-muted-foreground">No journal entries found.</p>
      </Card>
    );
  }

  return (
    <Card className="p-4 rounded-xl shadow-md">
      <h3 className="font-semibold mb-3 text-foreground">Journal Entries</h3>
      <div className="space-y-1">
        {data.map((j) => (
          <div key={j?.id || j} className="text-xs font-mono text-muted-foreground">
            {j?.originalId || j?.id}
          </div>
        ))}
      </div>
    </Card>
  );
};
