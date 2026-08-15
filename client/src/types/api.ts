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
