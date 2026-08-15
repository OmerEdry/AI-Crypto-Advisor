import { Router } from 'express';
import { authRouter } from './modules/auth/auth.routes';
import { marketRouter } from './modules/market/market.routes';
import { preferencesRouter } from './modules/preferences/preferences.routes';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/preferences', preferencesRouter);
apiRouter.use('/market', marketRouter);
