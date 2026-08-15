import { Router } from 'express';
import { requireAuth } from '../../middleware/require-auth';
import { validateBody } from '../../middleware/validate';
import { getFeedbackSummary, postFeedback } from './feedback.controller';
import { feedbackSchema } from './feedback.schema';

export const feedbackRouter = Router();

feedbackRouter.post('/', requireAuth, validateBody(feedbackSchema), postFeedback);
feedbackRouter.get('/summary', requireAuth, getFeedbackSummary);
