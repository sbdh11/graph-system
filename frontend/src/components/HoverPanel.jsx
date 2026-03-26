// src/components/HoverPanel.jsx
import { Card } from '@/components/ui/card';
import { getNodeColor } from '../constants/nodeColors';
import { titleizeType, toRowsFromNodeData } from '../utils/graphHelpers';

export const HoverPanel = ({ node, pos, fullGraphData }) => {
  const fallbackId = node.originalId || node.id;
  const rows = toRowsFromNodeData(node.data);
  const finalRows = rows.length > 0 ? rows : fallbackId ? [{ key: 'ID', value: fallbackId }] : [];

  const nodeId = String(node.id);
  const links = fullGraphData?.links || [];
  const nodes = fullGraphData?.nodes || [];
  const nodeTypeById = new Map(nodes.map((n) => [n.id, n.type]));

  const outgoing = links
    .filter((l) => String(l.source) === nodeId)
    .slice(0, 10);

  const incoming = links
    .filter((l) => String(l.target) === nodeId)
    .slice(0, 10);

  const panelWidth = 300;
  const panelHalf = panelWidth / 2;
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const clampedLeft = pos
    ? Math.max(panelHalf + 12, Math.min(viewportWidth - panelHalf - 12, pos.x))
    : null;

  return (
    <div
      className={`absolute z-50 w-[300px] pointer-events-none ${pos ? '' : 'top-6 left-1/2 -translate-x-1/2'}`}
      style={
        pos
          ? {
              left: clampedLeft,
              top: pos.y,
              transform: pos.placeBelow ? 'translate(-50%, 14px)' : 'translate(-50%, -105%)',
            }
          : {}
      }
    >
      <Card className="py-0 gap-0 border border-border bg-card shadow-2xl overflow-hidden rounded-xl">
        <div className="px-4 py-3 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full shadow-sm"
              style={{ backgroundColor: getNodeColor(node.type) }}
            />
            <h4 className="font-semibold text-sm text-foreground">
              {titleizeType(node.type)}
            </h4>
          </div>
        </div>
        <div className="px-4 py-3 space-y-1.5 bg-card/95 backdrop-blur-sm">
          {finalRows.map((row) => (
            <div key={row.key} className="flex items-baseline justify-between gap-3 border-b border-border/50 pb-1.5 last:border-b-0 last:pb-0">
              <span className="text-xs text-muted-foreground truncate">{titleizeType(row.key)}:</span>
              <span className="text-xs text-foreground font-mono text-right truncate">{String(row.value)}</span>
            </div>
          ))}

          {(outgoing.length > 0 || incoming.length > 0) && (
            <div className="pt-2 mt-1 border-t border-border/60">
              <div className="text-xs font-semibold text-muted-foreground mb-1">Relationships</div>

              {outgoing.length > 0 && (
                <div className="space-y-1 mb-2">
                  <div className="text-[11px] font-medium text-muted-foreground/90">Outgoing</div>
                  {outgoing.map((l, idx) => {
                    const targetId = String(l.target);
                    const targetType = nodeTypeById.get(targetId) || 'Node';
                    return (
                      <div key={`${l.type}-${idx}`} className="flex items-baseline justify-between gap-3 text-xs">
                        <span className="text-xs text-muted-foreground truncate">
                          {l.type} → {targetType}
                        </span>
                        <span className="text-xs text-foreground font-mono text-right truncate">
                          {targetId}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {incoming.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[11px] font-medium text-muted-foreground/90">Incoming</div>
                  {incoming.map((l, idx) => {
                    const sourceId = String(l.source);
                    const sourceType = nodeTypeById.get(sourceId) || 'Node';
                    return (
                      <div key={`${l.type}-${idx}`} className="flex items-baseline justify-between gap-3 text-xs">
                        <span className="text-xs text-muted-foreground truncate">
                          {sourceType} → {l.type}
                        </span>
                        <span className="text-xs text-foreground font-mono text-right truncate">
                          {sourceId}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
