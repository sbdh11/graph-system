// src/components/GraphCanvas.jsx
import { useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { FileText, Maximize2, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HoverPanel } from './HoverPanel';
import { LABEL_MAP, CANVAS_COLOR_MAP } from '../constants/nodeColors';
import { darkenColor, getNeighborhood, asId } from '../utils/graphHelpers';

export const GraphCanvas = ({
  fullGraphData,
  highlightedIds,
  expandedIds,
  setExpandedIds,
  fgRef,
  lockedNodeRef,
  onMinimize,
}) => {
  const [hoverNode, setHoverNode] = useState(null);
  const [hoverPos, setHoverPos] = useState(null);
  const [lockedNode, setLockedNode] = useState(null);

  const updateHover = (node) => {
    setHoverNode(node);
    if (!node) {
      setHoverPos(null);
      return;
    }
    const methods = fgRef.current;
    if (methods && typeof node.x === 'number' && typeof node.y === 'number' && methods.graph2ScreenCoords) {
      const { x: sx, y: sy } = methods.graph2ScreenCoords(node.x, node.y);
      const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
      const placeBelow = sy < 220;
      const y = Math.max(20, Math.min(viewportHeight - 20, sy));
      setHoverPos({ x: sx, y, placeBelow });
    } else {
      setHoverPos(null);
    }
  };

  const nodeCanvasObject = (node, ctx, globalScale) => {
    const hasHighlight = highlightedIds.size > 0;
    const clickedId = lockedNode?.id ? String(lockedNode.id) : null;
    const isClicked = clickedId && String(node.id) === clickedId;
    const isTraceNode = hasHighlight && highlightedIds.has(node.id);
    const isHighlighted = !hasHighlight || isTraceNode || isClicked;
    const isExpanded = hasHighlight && expandedIds.has(node.id);

    const baseColor = CANVAS_COLOR_MAP[node.type] || '#999';
    const alpha = !hasHighlight ? (isClicked ? 1 : 0.95) : isHighlighted ? 1 : isExpanded ? 0.45 : 0.15;
    const size = !hasHighlight ? (isClicked ? 3.2 : 2.3) : isHighlighted ? 4.2 : isExpanded ? 2.9 : 1.7;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
    ctx.fillStyle = baseColor;
    ctx.fill();

    ctx.lineWidth = 1;
    const stroke = darkenColor(baseColor, 0.22) || 'rgba(0,0,0,0.35)';
    ctx.strokeStyle = stroke;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(node.x, node.y, size * 0.38, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.fill();

    const shouldGlow = (hasHighlight && isTraceNode) || (!hasHighlight && isClicked);
    if (shouldGlow) {
      ctx.shadowBlur = 12;
      ctx.shadowColor = baseColor;
      ctx.beginPath();
      ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
      ctx.fillStyle = baseColor;
      ctx.fill();

      ctx.lineWidth = 1;
      const glowStroke = darkenColor(baseColor, 0.18) || 'rgba(0,0,0,0.35)';
      ctx.strokeStyle = glowStroke;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(node.x, node.y, size * 0.38, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fill();
      ctx.shadowBlur = 0;

      if (hasHighlight && isTraceNode) {
        const label = LABEL_MAP[node.type] || node.type;
        const fontSize = Math.max(10 / globalScale, 3);
        ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = 'rgba(30,41,59,0.9)';
        ctx.fillText(label, node.x, node.y + size + 3 / globalScale);

        const idLabel = node.originalId || node.id;
        const idFontSize = Math.max(8 / globalScale, 2.5);
        ctx.font = `400 ${idFontSize}px 'SF Mono', monospace`;
        ctx.fillStyle = 'rgba(100,116,139,0.8)';
        ctx.fillText(
          String(idLabel),
          node.x,
          node.y + size + 3 / globalScale + fontSize + 1 / globalScale
        );
      }
    }

    ctx.restore();
  };

  const nodePointerAreaPaint = (node, color, ctx) => {
    ctx.save();
    const hasHighlight = highlightedIds.size > 0;
    const isHighlighted = !hasHighlight || highlightedIds.has(node.id);
    const isExpanded = hasHighlight && expandedIds.has(node.id);

    ctx.globalAlpha = 1;
    const radius = !hasHighlight ? 8 : isHighlighted ? 10 : isExpanded ? 8 : 7;
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  };

  const linkColor = (link) => {
    const srcId = asId(link.source);
    const tgtId = asId(link.target);
    const hasHighlight = highlightedIds.size > 0;
    if (!hasHighlight) return 'rgba(59,130,246,0.20)';

    const srcHit = highlightedIds.has(srcId);
    const tgtHit = highlightedIds.has(tgtId);
    const srcExpanded = expandedIds.has(srcId);
    const tgtExpanded = expandedIds.has(tgtId);
    const isReversalEdge = link.type === 'BILLING_REVERSAL' || link.type === 'REVERSAL';
    const isMainFlow = srcHit && tgtHit && !isReversalEdge;
    const isSecondaryFlow =
      !isMainFlow && !isReversalEdge &&
      ((srcExpanded && tgtExpanded) || (srcHit && tgtExpanded) || (tgtHit && srcExpanded));

    if (isMainFlow) return '#2563eb';
    if (isSecondaryFlow) return 'rgba(59,130,246,0.15)';
    return 'rgba(59,130,246,0.06)';
  };

  const linkWidth = (link) => {
    const srcId = asId(link.source);
    const tgtId = asId(link.target);
    const hasHighlight = highlightedIds.size > 0;
    if (!hasHighlight) return 0.7;

    const srcHit = highlightedIds.has(srcId);
    const tgtHit = highlightedIds.has(tgtId);
    const srcExpanded = expandedIds.has(srcId);
    const tgtExpanded = expandedIds.has(tgtId);
    const isReversalEdge = link.type === 'BILLING_REVERSAL' || link.type === 'REVERSAL';
    const isMainFlow = srcHit && tgtHit && !isReversalEdge;
    const isSecondaryFlow =
      !isMainFlow && !isReversalEdge &&
      ((srcExpanded && tgtExpanded) || (srcHit && tgtExpanded) || (tgtHit && srcExpanded));

    if (isMainFlow) return 2.5;
    if (isSecondaryFlow) return 1.0;
    return 0.5;
  };

  const linkDirectionalParticles = (link) => {
    const srcId = asId(link.source);
    const tgtId = asId(link.target);
    const hasHighlight = highlightedIds.size > 0;
    if (!hasHighlight) return 0;

    const srcHit = highlightedIds.has(srcId);
    const tgtHit = highlightedIds.has(tgtId);
    const srcExpanded = expandedIds.has(srcId);
    const tgtExpanded = expandedIds.has(tgtId);
    const isReversalEdge = link.type === 'BILLING_REVERSAL' || link.type === 'REVERSAL';
    const isMainFlow = srcHit && tgtHit && !isReversalEdge;
    const isSecondaryFlow =
      !isMainFlow && !isReversalEdge &&
      ((srcExpanded && tgtExpanded) || (srcHit && tgtExpanded) || (tgtHit && srcExpanded));

    if (isMainFlow) return 3;
    if (isSecondaryFlow) return 1;
    return 0;
  };

  const handleNodeClick = (node) => {
    if (lockedNodeRef.current?.id === node?.id) {
      lockedNodeRef.current = null;
      setLockedNode(null);
      updateHover(null);
      setExpandedIds(new Set());
    } else if (node) {
      lockedNodeRef.current = node;
      setLockedNode(node);
      updateHover(node);
      setHoverPos(null);
      setExpandedIds(getNeighborhood(fullGraphData?.links, String(node.id), 1));
    } else {
      lockedNodeRef.current = null;
      setLockedNode(null);
      updateHover(null);
      setExpandedIds(new Set());
    }
  };

  const handleBackgroundClick = () => {
    lockedNodeRef.current = null;
    setLockedNode(null);
    updateHover(null);
    setExpandedIds(new Set());
  };

  return (
    <div className="w-full h-full relative bg-neutral-50 dark:bg-neutral-950 overflow-hidden" 
         style={{ backgroundImage: 'radial-gradient(circle at 10px 10px, rgba(0,0,0,0.05) 2px, transparent 0)', backgroundSize: '40px 40px' }}>
      
      <div className="absolute left-6 top-6 z-40 flex items-center gap-3">
        <Button
          variant="secondary"
          className="h-9 bg-background/80 hover:bg-muted shadow-sm backdrop-blur-md border border-border"
          onClick={onMinimize}
        >
          <Maximize2 size={16} className="mr-2 opacity-70" /> Minimize
        </Button>
        <Button variant="default" className="h-9 shadow-sm hover:opacity-90 transition-opacity">
          <Layers size={16} className="mr-2 opacity-80" /> Hide Granular Overlay
        </Button>
      </div>

      <div className="absolute inset-0">
        {fullGraphData && fullGraphData.nodes.length > 0 ? (
          <ForceGraph2D
            ref={fgRef}
            graphData={fullGraphData}
            nodeId="id"
            linkSource="source"
            linkTarget="target"
            nodeCanvasObject={nodeCanvasObject}
            nodePointerAreaPaint={nodePointerAreaPaint}
            linkColor={linkColor}
            linkWidth={linkWidth}
            linkDirectionalParticles={linkDirectionalParticles}
            linkDirectionalParticleWidth={3}
            linkDirectionalParticleColor={() => '#3b82f6'}
            linkDirectionalParticleSpeed={0.004}
            linkDirectionalArrowLength={3}
            linkDirectionalArrowRelPos={1}
            linkDirectionalArrowColor={() => 'rgba(59,130,246,0.35)'}
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.3}
            cooldownTicks={300}
            nodeLabel={() => ''}
            linkLabel={() => ''}
            enablePointerInteraction={true}
            onNodeHover={(node) => {
              if (!lockedNodeRef.current) updateHover(node);
            }}
            onNodeClick={handleNodeClick}
            onBackgroundClick={handleBackgroundClick}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center flex-col gap-4 text-muted-foreground">
            <div className="p-4 rounded-full bg-muted/50 ring-1 ring-border shadow-inner">
               <FileText size={32} className="opacity-40" />
            </div>
            <p className="text-foreground/70 font-medium">Loading graph...</p>
          </div>
        )}
      </div>

      {(lockedNode || hoverNode) && (
         <HoverPanel node={lockedNode || hoverNode} pos={lockedNode ? null : hoverPos} fullGraphData={fullGraphData} />
      )}
    </div>
  );
};
