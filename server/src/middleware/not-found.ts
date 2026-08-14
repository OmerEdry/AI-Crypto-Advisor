import type { RequestHandler } from 'express';
import { AppError } from '../errors/app-error';

export const notFound: RequestHandler = () => {
  throw new AppError('NOT_FOUND', 'Route not found');
};
