import { Router } from 'express';
import { narrateHandler } from '../controllers/narrateController.js';

const router = Router();

router.post('/narrate_stream', narrateHandler);

export default router;
