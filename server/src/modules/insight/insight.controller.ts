import type { RequestHandler } from 'express';
import { AppError } from '../../errors/app-error';
import * as insightService from './insight.service';

export const getTodaysInsight: RequestHandler = async (req, res) => {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'Sign in to continue.');
  }

  const insight = await insightService.getTodaysInsight(req.user.id);
  res.status(200).json(insight);
};
