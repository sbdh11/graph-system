import { Router } from 'express';
import { domainGuard } from '../../middleware/domainGuard.js';
import { queryHandler } from '../controllers/queryController.js';

const router = Router();

router.post('/query', domainGuard, queryHandler);

export default router;
