import { getGraphData } from '../../services/graphService.js';

export function graphHandler(req, res) {
  const graph = req.app.locals.graph;
  
  if (!graph) {
    return res.status(503).json({ 
      error: "Initialize", 
      message: "The graph is still loading. Please try again in a few seconds." 
    });
  }
  
  try {
    const data = getGraphData(graph);
    res.json(data);
  } catch (err) {
    console.error('getGraphData failed:', err);
    res.status(500).json({ error: "Graph serialization failed" });
  }
}