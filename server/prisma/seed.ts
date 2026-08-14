import { hash } from 'bcryptjs';
import { prisma } from '../src/lib/prisma';

const DEMO_EMAIL = 'demo@example.com';
const DEMO_PASSWORD = 'demo-password-1234';
const BCRYPT_COST = 12;

async function seed(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed: this creates an account whose password is in the repo.');
  }

  const passwordHash = await hash(DEMO_PASSWORD, BCRYPT_COST);

  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: {
      email: DEMO_EMAIL,
      name: 'Demo Investor',
      passwordHash,
      onboardingCompletedAt: new Date(),
    },
  });

  await prisma.preference.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      assets: ['bitcoin', 'ethereum'],
      investorType: 'HODLER',
      contentTypes: ['MARKET_NEWS', 'CHARTS'],
    },
  });

  // PRICES only: its itemRef is a CoinGecko coin id, which is stable today. The other three
  // sections key on ids that the static feed, the meme list and DailyInsight do not create
  // until Steps 8, 10 and 9.
  const votes = [
    { itemRef: 'bitcoin', vote: 'UP' },
    { itemRef: 'ethereum', vote: 'DOWN' },
  ] as const;

  for (const { itemRef, vote } of votes) {
    await prisma.feedback.upsert({
      where: {
        userId_sectionType_itemRef: { userId: user.id, sectionType: 'PRICES', itemRef },
      },
      update: { vote },
      create: { userId: user.id, sectionType: 'PRICES', itemRef, vote },
    });
  }

  process.stdout.write(`Seeded ${DEMO_EMAIL} with preferences and ${votes.length} votes\n`);
}

seed()
  .catch((error: unknown) => {
    process.exitCode = 1;
    throw error;
  })
  .finally(() => prisma.$disconnect());
