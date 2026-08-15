import bcrypt from 'bcryptjs';

// ARCHITECTURE.md §7.4. bcrypt is deliberately slow and this number is the dial: each
// increment doubles the work, so it is raised as hardware improves rather than replaced.
const COST_FACTOR = 12;

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, COST_FACTOR);
}

export async function verifyPassword(plaintext: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, passwordHash);
}
