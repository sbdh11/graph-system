/**
 * Serializes the in-memory graph into the JSON shape expected by the frontend.
 * Extracted from the GET /graph handler in server.js.
 */
export function getGraphData(graph) {
  const links = [];
  for (const [sourceId, edges] of graph.edges.entries()) {
    for (const edge of edges) {
      if (edge.dir !== 'out') continue;
      const source = edge.source || edge.from || sourceId;
      const target = edge.target || edge.to;
      if (source === undefined || source === null || target === undefined || target === null) continue;
      links.push({
        source: String(source),
        target: String(target),
        type: edge.type,
      });
    }
  }

  console.log('Sample edge:', links[0]);

  return {
    nodes: Array.from(graph.nodes.values()).map(n => ({
      id: String(n.id),
      type: n.type,
      data: n.data || {},
      originalId: n.originalId ? String(n.originalId) : null,
    })),
    links,
  };
}
