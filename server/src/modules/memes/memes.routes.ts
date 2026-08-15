import { Router } from 'express';
import { requireAuth } from '../../middleware/require-auth';
import { getRandomMeme } from './memes.controller';

export const memesRouter = Router();

memesRouter.get('/random', requireAuth, getRandomMeme);
