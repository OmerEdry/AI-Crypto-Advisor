import { Router } from 'express';
import { authRouter } from './modules/auth/auth.routes';
import { preferencesRouter } from './modules/preferences/preferences.routes';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/preferences', preferencesRouter);
