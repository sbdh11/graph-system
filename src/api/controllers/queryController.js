import { handleQuery } from '../../services/queryService.js';

export async function queryHandler(req, res) {
  const { query } = req.body;
  const result = await handleQuery(query, req.app.locals.queryEngine);
  return res.json(result);
}
