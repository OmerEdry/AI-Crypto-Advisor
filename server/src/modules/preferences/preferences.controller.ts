import type { RequestHandler } from 'express';
import { AppError } from '../../errors/app-error';
import type { PreferencesInput } from './preferences.schema';
import * as preferencesService from './preferences.service';

export const getPreferences: RequestHandler = async (req, res) => {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'Sign in to continue.');
  }

  const preferences = await preferencesService.get(req.user.id);
  res.status(200).json({ preferences });
};

export const putPreferences: RequestHandler<unknown, unknown, PreferencesInput> = async (
  req,
  res,
) => {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'Sign in to continue.');
  }

  // The owner comes from the verified token, never from the body (CLAUDE.md §4). A caller
  // supplying `userId` cannot reach this line — zod strips it before the controller runs.
  const preferences = await preferencesService.upsert(req.user.id, req.body);
  res.status(200).json({ preferences });
};
