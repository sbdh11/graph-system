import { Router } from 'express';
import { graphHandler } from '../controllers/graphController.js';

const router = Router();

router.get('/graph', graphHandler);

export default router;
