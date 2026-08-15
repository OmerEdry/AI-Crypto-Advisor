import { Router } from 'express';
import { requireAuth } from '../../middleware/require-auth';
import { validateBody } from '../../middleware/validate';
import { getPreferences, putPreferences } from './preferences.controller';
import { preferencesSchema } from './preferences.schema';

export const preferencesRouter = Router();

preferencesRouter.get('/', requireAuth, getPreferences);
preferencesRouter.put('/', requireAuth, validateBody(preferencesSchema), putPreferences);
