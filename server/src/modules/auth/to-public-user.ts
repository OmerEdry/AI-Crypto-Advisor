import type { User } from '@prisma/client';

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

// Field by field, never a spread. A spread would carry passwordHash into the response body the
// moment anyone adds a column, and nothing would fail to warn about it.
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
  };
}
