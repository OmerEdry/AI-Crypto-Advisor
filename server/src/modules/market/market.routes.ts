import { Router } from 'express';
import { requireAuth } from '../../middleware/require-auth';
import { getPrices } from './market.controller';

// Named for the module rather than the resource because §6.1 mounts /news on this same router
// at Step 8.
export const marketRouter = Router();

marketRouter.get('/prices', requireAuth, getPrices);
