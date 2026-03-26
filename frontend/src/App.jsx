// src/App.jsx
import { useRef, useEffect } from 'react';
import { Activity } from 'lucide-react';

import { GraphCanvas } from './components/GraphCanvas';
import { ChatPanel } from './components/ChatPanel';
import { useGraphData } from './hooks/useGraphData';
import { useHighlight } from './hooks/useHighlight';
import { useStream } from './hooks/useStream';
import { useChat } from './hooks/useChat';
import { asId } from './utils/graphHelpers';

const Header = () => (
  <header className="h-[60px] flex items-center px-6 border-b border-border bg-card z-30 shrink-0 shadow-sm">
    <div className="flex items-center gap-3">
      <Activity className="text-muted-foreground" size={20} />
      <div className="h-4 w-px bg-border"></div>
      <span className="text-muted-foreground font-medium">Mapping</span>
      <span className="text-muted-foreground/40">/</span>
      <h1 className="font-semibold text-foreground text-lg">Order to Cash</h1>
    </div>
  </header>
);

export default function App() {
  const fgRef = useRef(null);
  const lockedNodeRef = useRef(null);

  const { fullGraphData } = useGraphData();
  const highlightHook = useHighlight();
  const streamHook = useStream();

  const { highlightedIds, expandedIds, setExpandedIds, clearHighlight } = highlightHook;
  const { narrationText, narrationStreaming } = streamHook;

  const { query, setQuery, loading, error, result, action, chatHistory, handleQuery } = useChat({
    highlightHook,
    streamHook,
    fullGraphData,
    fgRef,
    lockedNodeRef,
  });

  const onMinimize = () => {
    clearHighlight();
    lockedNodeRef.current = null;
    try {
      fgRef.current?.zoomToFit?.(100, 10);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!fullGraphData || fullGraphData.nodes.length === 0) return;
    const fg = fgRef.current;
    if (!fg) return;

    try {
      const chargeForce = fg.d3Force('charge');
      if (chargeForce) chargeForce.strength(-120);

      const linkForce = fg.d3Force('link');
      if (linkForce) {
        linkForce.strength(0.9);
        linkForce.distance((link) => {
          const srcId = asId(link.source);
          const tgtId = asId(link.target);
          const hasHighlight = highlightedIds.size > 0;
          const srcHit = highlightedIds.has(srcId);
          const tgtHit = highlightedIds.has(tgtId);
          const srcExpanded = expandedIds.has(srcId);
          const tgtExpanded = expandedIds.has(tgtId);

          if (link.type === 'BILLING_REVERSAL' || link.type === 'REVERSAL') return 220;
          if (!hasHighlight) return 120;
          if (srcHit && tgtHit) return 80;

          const isSecondaryFlow =
            (srcHit && tgtExpanded) || (tgtHit && srcExpanded) || (srcExpanded && tgtExpanded);
          return isSecondaryFlow ? 120 : 160;
        });
      }

      fg.d3ReheatSimulation();
    } catch {
      // no-op
    }
  }, [fullGraphData, highlightedIds, expandedIds]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background text-foreground font-sans">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-[7] relative min-w-0 h-full">
          <GraphCanvas
            fullGraphData={fullGraphData}
            highlightedIds={highlightedIds}
            expandedIds={expandedIds}
            setExpandedIds={setExpandedIds}
            fgRef={fgRef}
            lockedNodeRef={lockedNodeRef}
            onMinimize={onMinimize}
          />
        </div>
        <div className="flex-[3] min-w-[320px] max-w-[450px] h-full min-h-0 border-l border-border bg-card shadow-[-8px_0_30px_rgba(0,0,0,0.04)] z-20">
          <ChatPanel
            query={query}
            setQuery={setQuery}
            handleQuery={handleQuery}
            loading={loading}
            chatHistory={chatHistory}
            narrationText={narrationText}
            narrationStreaming={narrationStreaming}
            error={error}
            result={result}
            action={action}
          />
        </div>
      </div>
    </div>
  );
}
