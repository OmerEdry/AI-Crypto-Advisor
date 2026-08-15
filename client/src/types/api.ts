// Hand-mirrored from the server's response DTOs, per ARCHITECTURE.md §10.4. This is duplication
// and it can drift — a server-side rename produces no compile error here. The parsers in
// features/auth/auth-api.ts are what turn that drift into a visible failure rather than an
// `undefined` rendered into the page.
//
// Only what Steps 12 and 13 consume. The four section DTOs arrive at Step 15, with their readers.

// `createdAt` is a string, not a Date: JSON has no date type, and the server's Date serialises
// to an ISO string on the way out.
export interface PublicUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

// §17: `hasCompletedOnboarding` is a sibling of `user`, not a field inside it — it describes
// where the session sits in the flow, not the person.
export interface Session {
  user: PublicUser;
  hasCompletedOnboarding: boolean;
}

// §6.4. `details` is present on validation failures only, and each entry names the field it
// belongs to, which is what lets a form render a server error against the right input.
export interface ErrorDetail {
  path: string;
  message: string;
}

// The two Prisma enums, mirrored as string unions. §8: investorType picks the tone and the
// price window, contentTypes ranks the dashboard sections.
export type InvestorType = 'HODLER' | 'DAY_TRADER' | 'NFT_COLLECTOR';
export type ContentType = 'MARKET_NEWS' | 'CHARTS' | 'SOCIAL' | 'FUN';

// `contentTypes` is a ranking, not a set: §8.1 orders dashboard sections by it, and the server
// dedupes preserving first occurrence for the same reason. Whatever builds this array must
// preserve the order the user chose in.
export interface PreferencesInput {
  assets: string[];
  investorType: InvestorType;
  contentTypes: ContentType[];
}
