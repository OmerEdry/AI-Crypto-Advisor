import { Router } from 'express';
import { requireAuth } from '../../middleware/require-auth';
import { getTodaysInsight } from './insight.controller';

export const insightRouter = Router();

insightRouter.get('/today', requireAuth, getTodaysInsight);
