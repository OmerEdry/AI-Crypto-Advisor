import { Router } from 'express';
import { requireAuth } from '../../middleware/require-auth';
import { getNews, getPrices } from './market.controller';

export const marketRouter = Router();

marketRouter.get('/prices', requireAuth, getPrices);
marketRouter.get('/news', requireAuth, getNews);
