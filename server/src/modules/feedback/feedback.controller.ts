import type { RequestHandler } from 'express';
import { AppError } from '../../errors/app-error';
import * as feedbackService from './feedback.service';
import type { FeedbackInput } from './feedback.schema';

export const postFeedback: RequestHandler<unknown, unknown, FeedbackInput> = async (req, res) => {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'Sign in to continue.');
  }

  // The owner comes from the verified token, never from the body (CLAUDE.md §4). A caller
  // supplying `userId` cannot reach this line — zod strips it before the controller runs.
  const feedback = await feedbackService.recordVote(req.user.id, req.body);
  res.status(200).json({ feedback });
};

export const getFeedbackSummary: RequestHandler = async (req, res) => {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'Sign in to continue.');
  }

  const { summary, votes } = await feedbackService.getSummary(req.user.id);
  res.status(200).json({ summary, votes });
};
