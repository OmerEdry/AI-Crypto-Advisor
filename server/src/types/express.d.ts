// `user` is attached by requireAuth and read by controllers. It stays optional on purpose: a
// route that forgets requireAuth then produces a compile error at the read site rather than a
// silently undefined id, so the mistake fails closed.
declare global {
  namespace Express {
    interface Request {
      user?: { id: string };
    }
  }
}

export {};
