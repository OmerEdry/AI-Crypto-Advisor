import { Router } from 'express';
import { authRateLimit } from '../../middleware/rate-limit';
import { requireAuth } from '../../middleware/require-auth';
import { validateBody } from '../../middleware/validate';
import { login, logout, me, register } from './auth.controller';
import { loginSchema, registerSchema } from './auth.schema';

export const authRouter = Router();

authRouter.post('/register', authRateLimit, validateBody(registerSchema), register);
authRouter.post('/login', authRateLimit, validateBody(loginSchema), login);
authRouter.post('/logout', logout);
authRouter.get('/me', requireAuth, me);
