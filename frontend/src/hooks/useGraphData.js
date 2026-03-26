// src/hooks/useGraphData.js
import { useEffect, useState } from 'react';
import { normalizeId } from '../utils/graphHelpers';

export function useGraphData() {
  const [fullGraphData, setFullGraphData] = useState(null);

  useEffect(() => {
    fetch('http://localhost:3000/graph')
      .then((r) => r.json())
      .then((data) => {
        const normalizedNodes = (data?.nodes || []).map((n) => ({
          ...n,
          id: normalizeId(n.id),
          originalId: normalizeId(n.originalId),
          data: n?.data && typeof n.data === 'object' && !Array.isArray(n.data) ? n.data : {},
        }));

        const nodeIds = new Set(normalizedNodes.map((n) => n.id));
        const normalizedLinks = (data?.links || [])
          .map((l) => ({
            ...l,
            source: normalizeId(typeof l.source === 'object' ? l.source.id : l.source),
            target: normalizeId(typeof l.target === 'object' ? l.target.id : l.target),
          }))
          .filter((l) => l.source && l.target && nodeIds.has(l.source) && nodeIds.has(l.target));

        console.log('Graph loaded:', {
          nodes: normalizedNodes.length,
          links: normalizedLinks.length,
          sampleLinks: normalizedLinks.slice(0, 5),
        });

        setFullGraphData({ nodes: normalizedNodes, links: normalizedLinks });
      })
      .catch(() => setFullGraphData({ nodes: [], links: [] }));
  }, []);

  return { fullGraphData };
}
