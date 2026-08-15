import type { RequestHandler } from 'express';
import { AppError } from '../../errors/app-error';
import * as newsService from './news.service';
import * as pricesService from './prices.service';

export const getPrices: RequestHandler = async (req, res) => {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'Sign in to continue.');
  }

  // The watchlist is read from the verified token's user, never from a query parameter.
  const prices = await pricesService.getPricesFor(req.user.id);

  // §6.1 specifies a flat body here — { status, coins, cachedAt, notice? } — rather than the
  // wrapper that /api/preferences uses.
  res.status(200).json(prices);
};

export const getNews: RequestHandler = async (req, res) => {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'Sign in to continue.');
  }

  const news = await newsService.getNewsFor(req.user.id);
  res.status(200).json(news);
};
