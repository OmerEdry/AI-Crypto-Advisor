import { Prisma } from '@prisma/client';
import { AppError } from '../../errors/app-error';
import { prisma } from '../../lib/prisma';
import type { LoginInput, RegisterInput } from './auth.schema';
import { hashPassword, verifyPassword } from './password.service';
import { signAccessToken } from './token.service';
import { toPublicUser, type PublicUser } from './to-public-user';

// One message for "no such email" and another for "wrong password" would turn the login form
// into a tool for discovering which addresses have accounts (ARCHITECTURE.md §7.6).
const INVALID_CREDENTIALS = 'Email or password is incorrect.';

export interface AuthResult {
  user: PublicUser;
  token: string;
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const passwordHash = await hashPassword(input.password);

  try {
    const user = await prisma.user.create({
      data: { name: input.name, email: input.email, passwordHash },
    });

    return { user: toPublicUser(user), token: signAccessToken({ sub: user.id }) };
  } catch (error) {
    // Letting the unique index decide, rather than selecting first, closes the race window
    // between the check and the write (ARCHITECTURE.md §12). Prisma surfaces the violation as
    // P2002 — the underlying Postgres SQLSTATE 23505 never reaches this catch.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError('CONFLICT', 'That email is already registered. Sign in instead.');
    }

    throw error;
  }
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  if (!user) {
    throw new AppError('UNAUTHORIZED', INVALID_CREDENTIALS);
  }

  const passwordMatches = await verifyPassword(input.password, user.passwordHash);

  if (!passwordMatches) {
    throw new AppError('UNAUTHORIZED', INVALID_CREDENTIALS);
  }

  return { user: toPublicUser(user), token: signAccessToken({ sub: user.id }) };
}

// Reads the row rather than trusting the token's claim: the account may have been deleted
// since the token was signed, and a stateless token has no way to know that.
export async function getUser(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    throw new AppError('UNAUTHORIZED', 'Your session has ended. Sign in again.');
  }

  return toPublicUser(user);
}
