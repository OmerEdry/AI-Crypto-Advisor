# CLAUDE.md — operating instructions for this repository

Read this file fully before writing any code. Re-read `ARCHITECTURE.md` before starting each
step of `BUILD_PLAN.md`.

---

## 1. The constraint that shapes everything

**Every line of this codebase must be explainable and maintainable by the developer who owns
it.**

This reframes the job. Code that is clever but unexplainable is a **failure**, even when it
works. Code that is simple, conventional and understood is a **success**, even when it is not
the most elegant solution available.

Therefore:

- **Never introduce a library, pattern or abstraction not already in `ARCHITECTURE.md`
  without asking first.** If you believe something is needed, stop and state: what it is, why
  it is needed, what it replaces, and what the developer will need to understand to maintain
  it. Then wait for a decision.
- **Prefer the boring, conventional solution.** No metaprogramming, no elaborate type
  gymnastics, no abstraction with a single implementation — except the provider and cache
  interfaces, which `ARCHITECTURE.md` justifies explicitly.
- **If code needs a comment to be understood, first try rewriting it so it doesn't.** If a
  comment is still warranted, explain *why*, never *what*.

## 2. The working loop — follow this for every step

The build is a numbered sequence in `BUILD_PLAN.md`. For each step:

1. **Propose before building.** List the files you will create or modify, what each does, and
   any decision not already settled by `ARCHITECTURE.md`. Keep it short.
2. **Wait for confirmation.** Do not write files until the developer says go.
3. **Implement that step only.** Do not build ahead. If the step needs something from a later
   step, say so and stop rather than quietly implementing both.
4. **Hand back a verification checklist**, covering:
   - files created or modified
   - anything deviating from `ARCHITECTURE.md`, and why
   - **exact commands to run and exact expected output** — the developer verifies by hand,
     not by trusting the code
   - **what to check on the deployed environment** once merged, if this step affects it
     (e.g. "confirm `/healthz` responds on the live URL", "confirm the cookie is set on the
     app domain") — and if the step changes environment variables, say precisely which need
     adding to which platform dashboard, since a missing production env var is the most
     common deployment failure
   - **2–3 questions about the decisions in this step, with answers** — the parts a reviewer
     or future maintainer would most likely probe. This is required, not optional.
5. **Stop.** Do not begin the next step unprompted. Wait for an explicit all-clear.

**Never split one step across two, and never merge two steps into one.** Steps are sized for
human review. If a step is genuinely too large, say so and propose a split rather than
proceeding.

## 3. Teach as you go

The developer is building working knowledge of this system, not just shipping it. So:

- When using something non-obvious — a Prisma call, an Express middleware signature, a
  TanStack Query option, a cookie attribute — **add a one-line explanation in your reply**
  (not necessarily in the code) of what it does and why that option was chosen.
- When there was a fork in the road, **name the road not taken.** "I used `upsert` rather
  than find-then-create because find-then-create has a race window between the check and the
  write."
- Treat "why?" as a genuine request to learn. Answer with the mechanism, not a restatement.
- **If the developer appears to hold a wrong mental model, say so directly and correct it.**
  That is more useful than being agreeable.

## 4. Hard rules

### Security
- **Never** commit a real secret. `.env` is gitignored; `.env.example` holds placeholders.
- **Never** put a secret in a `VITE_`-prefixed variable — those compile into the public
  browser bundle.
- **Never** call a third-party API from client code. All outbound third-party requests
  originate in the server.
- **Never** read `userId` from a request body, query or param. It comes from the verified
  token via `req.user`, only. Any code accepting a caller-supplied `userId` is a
  vulnerability, not a convenience.
- **Never** return `passwordHash` in a response. Every user response passes through an
  explicit `toPublicUser()` mapper — no spreading a database record into a response body.
- **Never** build SQL by string interpolation. Bound parameters only, including in
  `$queryRaw`.
- **Never** log a password, token, cookie or authorization header.

### Correctness
- **TypeScript `strict: true`. No `any`.** If a type is genuinely unknown, use `unknown` and
  narrow. No `@ts-ignore` without an adjacent comment explaining why.
- **Validate every input** with zod at the HTTP boundary. Controllers receive already-parsed
  data.
- **Every outbound HTTP call has an explicit timeout** — 5s for data providers, 10s for the
  LLM. Without one, a hanging upstream becomes a hanging request and then an exhausted
  connection pool.
- **One `try/catch` per provider call, at the service boundary.** Not scattered through
  controllers and helpers. The catch maps failure to a typed `AppError` with a specific code;
  the service then decides between degrading and failing.
- **Never write a bare `catch {}`.** Every catch either handles meaningfully or re-throws. A
  swallowed error is a bug found by a user instead of a log.
- **Errors are thrown as `AppError` and formatted in exactly one place**
  (`middleware/errorHandler.ts`). Never `res.status(500).json(...)` inside a controller.
- **Any cache entry serving user-specific data must include the user-specific input in its
  key.** A key shared across users with different inputs is a data-leak bug, not a
  performance bug.

### Scope
- **Do not** add anything not in `ARCHITECTURE.md` or `BUILD_PLAN.md`. No opportunistic
  refactors, no extra endpoints, no speculative configuration.
- **Do not** install a dependency without naming it and its purpose first.
- **Do not** write tests before the step that calls for them — not because tests are
  unimportant, but because the sequence is deliberate.

## 5. Code conventions

**General**
- Files: `kebab-case.ts` for modules, `PascalCase.tsx` for React components.
- Named exports, except where a framework requires default (React pages/components are fine
  as default).
- `async/await`, never raw `.then()` chains.
- One responsibility per function. If describing it needs "and", split it.
- No dead code, no commented-out code, no leftover `console.log` — use the logger.

**Backend**
- Layer discipline (`ARCHITECTURE.md` §5):
  - **routes** — path, method, middleware chain. Zero logic.
  - **controller** — reads validated input, calls one service method, sets status. Knows
    `req`/`res`; knows nothing about Prisma.
  - **service** — business logic. Knows nothing about `req`/`res`. Returns domain data or
    throws `AppError`.
  - **repository/provider** — data access or outbound HTTP. Swappable.
- **A controller importing `prisma` directly is a layering violation.** Fix it rather than
  rationalize it.
- Each module owns its own zod schema file and router.

**Frontend**
- Function components and hooks only.
- **Server state → TanStack Query. Client/UI state → `useState`/`useReducer`.** Do not mix
  these two; they are different problems.
- Data fetching lives in hooks, not inside components. Components render.
- **Every async surface handles four states: loading, error, empty, success.** "Empty" is the
  one that gets forgotten — an empty array must render a real empty state, not blank space.
- **No browser storage APIs for auth.** The session is an httpOnly cookie by design.

**Colour and theming — no exceptions**
- **All colour values live in `src/styles/theme.css`** as CSS custom properties, exposed to
  Tailwind under semantic names (`ARCHITECTURE.md` §10.2).
- Components use semantic tokens: `bg-surface`, `text-muted`, `text-positive`. **Never** a
  raw Tailwind palette class (`bg-zinc-900`, `text-green-500`), **never** a hex literal,
  **never** an inline `style` colour.
- Tokens are stored as space-separated RGB channels so Tailwind's `<alpha-value>` works and
  `bg-surface/50` composes. Do not store hex.
- Tokens are named by **role, not colour** — `positive`/`negative`, not `green`/`red`.
- If you need a colour that has no token, **stop and propose adding one to `theme.css`.** Do
  not inline it.
- Numeric displays (prices, percentages) get tabular figures so digits do not shift width as
  values update.

**Interface copy**
- **Errors state what happened and what to do next.** They do not apologize and are never
  vague. "Today's insight isn't ready — the AI service hit its rate limit. Try again in a few
  minutes." not "Sorry, something went wrong."
- Distinguish a rate limit from a transient failure, because the user's next action differs:
  wait, versus retry now.
- An empty state is an invitation to act, not a blank region.
- An action keeps the same verb through a flow: a button reading "Save preferences" produces
  a confirmation reading "Preferences saved".
- Sentence case, plain verbs, no filler.

## 6. Version control

Branch per milestone as defined in `ARCHITECTURE.md` §13. One conventional commit per
completed step inside the branch.

**Your responsibilities:**
- At the start of a milestone, state the branch name and the command to create it.
- At the end of each step, propose the exact commit message.
- At the end of a milestone, draft the pull request description: what changed, why, and
  anything the reviewer should look at closely.
- **Ask which branch is active if you are unsure.** Do not assume, and do not commit to
  `main` directly.

Never commit `.env`, `node_modules`, `dist`, or platform build directories.

## 7. The collaboration log

A record of how this project was built with AI assistance is maintained **by the developer,
outside this repository**, and added in a single final commit near the end.

**You must never create, write to, edit, or commit `docs/AI_COLLABORATION_LOG.md`.** Do not
create it as part of any scaffolding step. If it does not exist, that is intentional.

**Your only role:** after each completed step, offer two or three factual lines in chat that
the developer can adapt — what was asked, what was produced, what they changed or rejected. Do
not write in their voice and do not invent their reasoning. If they pushed back on something you
proposed, say so plainly; the disagreements are the most informative part of the record.

## 8. When uncertain — stop and ask

Ask rather than assume when:
- `ARCHITECTURE.md` is silent or ambiguous on a decision you need
- two requirements appear to conflict
- the clean solution requires a dependency or pattern not already approved
- you are about to touch auth, secrets handling, or the database schema in a way not
  specified
- **something in `ARCHITECTURE.md` looks wrong to you** — say so. It was written before
  implementation and may contain mistakes.

**A blocked question costs a minute. A wrong assumption compounds for hours.** Asking is
preferred to guessing every time.

## 9. Environment

- **OS: Windows.** Use cross-platform commands. No POSIX-only shell chaining in npm scripts;
  use `cross-env` if an inline environment variable is required.
- **Node ≥20.**
- Two independent applications in one repository: `server/` and `client/`, each with its own
  `package.json`. Not a workspace — `ARCHITECTURE.md` §10.4 explains why.
- Hosting: SPA and API on separate platforms with a rewrite proxy; managed Postgres.
  Merges to `main` auto-deploy.
- Free tiers throughout, with limits documented in `ARCHITECTURE.md` §2. Respect them — they
  are the reason several designs look the way they do.

## 10. Definition of done for any step

- [ ] It runs; you stated the exact command and expected output
- [ ] `npm run typecheck` and `npm run lint` pass in the affected application
- [ ] No secret, no `any`, no `console.log`, no dead code, no bare `catch {}`
- [ ] No hardcoded colour outside `theme.css`
- [ ] Layer boundaries respected
- [ ] Errors handled with a specific code; loading/error/empty states present on new UI
- [ ] The developer has been told how to verify it themselves, locally and on the deployment
- [ ] The 2–3 decision questions and answers were provided
- [ ] Commit message proposed
