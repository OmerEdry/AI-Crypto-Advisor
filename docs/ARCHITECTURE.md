# Architecture & Decision Record — Crypto Advisor Dashboard

**Status:** design locked before implementation
**Scope:** a personalized crypto investor dashboard — onboarding quiz, preference-driven
daily content, feedback capture

> This document has two jobs: it is the specification that guides implementation, and it is
> the record of *why* each choice was made — so every decision can be defended and every
> deliberate omission is named rather than discovered later.

---

## 1. Product requirements

### 1.1 Functional

| # | Requirement | Where it lands |
|---|---|---|
| R1 | Register with email, name, password | `POST /api/auth/register` |
| R2 | Log in with basic authentication | `POST /api/auth/login`, JWT in httpOnly cookie |
| R3 | Onboarding quiz after first login | `PUT /api/preferences` + gate on `onboardingCompletedAt` |
| R4 | Persist answers as user preferences | `preferences` table, 1:1 with user |
| R5 | Dashboard with four preference-driven sections | `/dashboard` + four independent endpoints |
| R6 | Market news | `GET /api/market/news`, provider interface with fallback |
| R7 | Coin prices | `GET /api/market/prices` |
| R8 | AI insight of the day | `GET /api/insight/today`, persisted per user per day |
| R9 | Crypto meme, refreshed on each dashboard update | `GET /api/memes/random` |
| R10 | Thumbs up/down per section, persisted | `POST /api/feedback`, `feedback` table |
| R11 | Publicly deployed | Vercel (web) + Render (API) + Neon (Postgres) |

### 1.2 Non-functional — the requirements that shape the design

- **NF1 — Personalization must be observable.** Two accounts with different onboarding
  answers must produce visibly different dashboards. A dashboard with hardcoded assets
  satisfies the letter of R5 and fails its purpose.
- **NF2 — "Of the day" and "on each update" are different cache lifetimes.** The insight is
  stable for 24h per user; the meme changes on every load. Treated as specification, not
  inconsistency.
- **NF3 — Feedback must close a loop.** Votes are summarized into the next day's insight
  prompt, so the stored feedback demonstrably affects output rather than accumulating
  unused.
- **NF4 — Nothing hard-fails.** Every upstream dependency runs on a free tier and will
  eventually rate-limit or error. Each section degrades to a usable, honestly-labelled
  state. See §9.
- **NF5 — The database must be durable and inspectable.** Rules out ephemeral-disk SQLite
  and any Postgres tier that expires.
- **NF6 — Every line must be explainable and maintainable.** Constrains the codebase toward
  conventional, legible solutions over clever ones.

---

## 2. Platform constraints

Verified at design time. These drove real decisions, so they are recorded with their
consequences. **Re-verify periodically** — free tiers change.

| Service | Constraint | Consequence |
|---|---|---|
| **OpenRouter** | `:free` models ≈ **20 req/min, ~50 req/day** with no credits. Free model IDs rotate; a hardcoded ID can disappear. | Insight generated **at most once per user per day**, persisted in Postgres. Model ID is an env var. Template fallback on failure. |
| **CoinGecko** | Keyless API is 5–15 calls/min and varies with global load. Free **Demo** key: 30 calls/min, **10,000 calls/month**. Underlying data refreshes every 1–5 min. | Demo key. Batched full-watchlist fetch, cached **per coin**, 120s TTL. See §9.1 — the monthly cap is the binding constraint, not the per-minute one. |
| **CryptoPanic** | v2 API at `https://cryptopanic.com/api/{plan}/v2/`, requires an `auth_token` query param. **No token obtained — the free developer tier was not pursued.** | Provider interface with two implementations. The static curated feed is the **production** provider; the live provider is implemented but unauthenticated, so it returns 401 and the service falls back automatically. See §9.2a. 10 min TTL. |
| **Render (web, free)** | Spins down after 15 min idle. **30–60s cold start.** | Deliberate cold-start UX (§9.4). Health-check warm-up on app load. |
| **Render (Postgres, free)** | **Expires 30 days after creation**, then deleted. | **Rejected** — violates NF5. |
| **Neon (free)** | 0.5 GB/project, 100 compute-hours/month, scale-to-zero after 5 min, resumes in ~hundreds of ms. **Permanent, not a trial.** | **Selected.** Also provides a browser SQL editor for inspection. |
| **Vercel (hobby)** | Free SPA hosting, supports `rewrites`. | Hosts the SPA **and** proxies `/api/*` to Render — load-bearing, see §6.2. |

---

## 3. Stack decisions

Format: **Decision → Why → What I'd do with more time or budget.**

### 3.1 Frontend — React 18 + TypeScript + Vite + Tailwind v3 + React Router + TanStack Query

**Why:** Vite over CRA because CRA is deprecated and Vite's dev server is near-instant.
TypeScript because the value of a type system is highest exactly where data crosses a
boundary, and this app is almost entirely boundary-crossing. Tailwind **v3** rather than v4
is a deliberately boring choice: it is the most documented configuration available, and a
tight schedule cannot afford to debug a toolchain.

**TanStack Query is the one non-obvious pick.** The dashboard has four independent async
resources, each with its own loading state, error state, cache lifetime and refetch trigger.
Hand-rolling that is four copies of the same `useEffect` bug. The framing: **server state
and client state are different problems.** Client state (which onboarding step am I on) is
`useState`. Server state has caching, deduplication and invalidation semantics that
`useState` does not model. Query also gives per-section `staleTime` mirroring the server's
TTLs, so the browser stops requesting data the server would only serve from cache anyway.

**With more time:** component tests with Testing Library; per-route code splitting.

### 3.2 Backend — Node.js + Express + TypeScript

**Why:** Express is small enough that nothing is hidden, which matters under NF6. The
layering in §5 is applied by hand.

**Worth stating explicitly:** the module boundaries — routes, controller, service,
repository — are the ones NestJS provides through decorators and dependency injection. For
a multi-developer codebase Nest is the better choice, because those conventions stop being
optional once several people share the repo. Building them manually here means understanding
what the framework actually buys.

**With more time:** NestJS for module boundaries and DI, or Fastify for throughput and
built-in schema validation.

### 3.3 Database — PostgreSQL on Neon

**Why, in priority order:**

1. **NF5 requires durability and inspectability.** SQLite on an ephemeral disk is wiped on
   redeploy. Render's free Postgres self-destructs at 30 days. Neon is permanent and ships
   a browser SQL editor.
2. **The data is relationally shaped.** One user has exactly one preferences row; many
   feedback rows; and must not be able to vote twice on the same item. Postgres expresses
   all three as schema — foreign keys, a unique constraint on `user_id`, and a composite
   unique on `(user_id, section_type, item_ref)`. In a document store these are
   application-layer conventions, which hold until a race condition says otherwise.
3. **Auth needs transactional integrity.** Creating a user must not half-succeed.
4. **The interesting future queries are aggregations.** "Which content types does this
   cohort downvote?" is `GROUP BY` — the shape the feedback pipeline in
   `TRAINING_AND_FEEDBACK.md` depends on.

**Honest counter-argument:** if the roadmap were storing heterogeneous raw provider payloads
with unstable shapes, a document store's flexible schema would be a genuine advantage. That
is not this application's shape.

**With more time:** a read replica for analytics; partition `feedback` by month as it grows.

### 3.4 ORM — Prisma, with one deliberate raw-SQL module

**Why Prisma:** `schema.prisma` is one readable source of truth generating both migrations
and TypeScript types, so a schema change becomes a compile error rather than a runtime
surprise. Prisma parameterizes every query, removing SQL injection as a category.
`prisma studio` provides a live database browser.

**Why one module stays raw SQL:** the feedback aggregation is a natural fit for SQL —
`JOIN` + `GROUP BY` over multiple dimensions — and expressing it through an ORM would be
less clear than writing it directly. `feedback.repository.ts` holds hand-written
parameterized SQL (§4.4).

**§12 is a SQL appendix** mapping every Prisma call in the project to the SQL it generates.
It exists so the abstraction never obscures what the database is actually doing.

**With more time:** Drizzle, which stays closer to SQL, or raw SQL with a thin query builder.

### 3.5 Auth — JWT in an httpOnly cookie

Full treatment in §7. Chosen over `localStorage` because a `localStorage` token is readable
by any injected script, and over refresh-token rotation because that is a larger surface
than this schedule allows. Designed as a **stepping stone, not a dead end** — the upgrade
path is additive (§7.5).

---

## 4. Data model

```prisma
// prisma/schema.prisma

generator client { provider = "prisma-client-js" }

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // pooled — application runtime
  directUrl = env("DIRECT_URL")     // direct — migrations & seed (see §15)
}

enum InvestorType { HODLER  DAY_TRADER  NFT_COLLECTOR }
enum ContentType  { MARKET_NEWS  CHARTS  SOCIAL  FUN }
enum SectionType  { NEWS  PRICES  INSIGHT  MEME }
enum VoteType     { UP  DOWN }

model User {
  id                    String    @id @default(cuid())
  email                 String    @unique
  name                  String
  passwordHash          String
  onboardingCompletedAt DateTime?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  preferences Preference?
  feedback    Feedback[]
  insights    DailyInsight[]

  @@map("users")
}

model Preference {
  id           String        @id @default(cuid())
  userId       String        @unique
  assets       String[]      // CoinGecko coin ids, e.g. ["bitcoin","ethereum"]
  investorType InvestorType
  contentTypes ContentType[]
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("preferences")
}

model Feedback {
  id          String      @id @default(cuid())
  userId      String
  sectionType SectionType
  itemRef     String      // stable id of the voted item — §4.3
  vote        VoteType
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, sectionType, itemRef])
  @@index([userId, createdAt])
  @@index([sectionType, vote])
  @@map("feedback")
}

model DailyInsight {
  id            String   @id @default(cuid())
  userId        String
  forDate       DateTime @db.Date       // UTC calendar date
  content       String   @db.Text
  model         String                  // which LLM produced it
  promptVersion String                  // e.g. "v1"
  source        String                  // "llm" | "fallback"
  createdAt     DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, forDate])
  @@map("daily_insights")
}
```

### 4.1 Why `onboardingCompletedAt` is a nullable timestamp, not a boolean

A boolean answers "did they?" A timestamp answers "did they, and when?" — identical storage
cost, strictly more information, and it feeds funnel analytics (time from signup to
completion). General principle: **prefer nullable timestamps to booleans for one-way state
transitions.**

### 4.2 Why `assets` is a Postgres array, and the counter-argument

`String[]` maps to a native Postgres array. It is not third normal form — a normalized
design would be an `assets` table plus a `user_assets` join table.

**Chosen because** no current query joins on an individual asset. Assets are read as a set,
written as a set, and passed upstream as a comma-joined string. A join table would add two
tables and two joins to serve zero queries.

**The condition that would change this:** a requirement like "list all users interested in
Solana", or assets needing display metadata (icon, full name, category). At that point
arrays stop paying for themselves and normalization is correct. The model fits the queries
that exist, not the queries one might imagine.

### 4.3 `itemRef` — the key that makes voting idempotent

A vote attaches to a specific item, and the same user voting twice must update rather than
duplicate. `itemRef` is a stable per-item identifier scoped by `sectionType`:

| Section | `itemRef` |
|---|---|
| `PRICES` | CoinGecko coin id — `bitcoin` |
| `NEWS` | `{provider}:{providerId}` — e.g. `cryptopanic:12345`, `static:news-3` |
| `INSIGHT` | the `DailyInsight.id` |
| `MEME` | the meme's `id` from the curated JSON |

News uses the provider's own identifier, prefixed with the provider name. Both sources already
supply a stable id — the live API returns one, and the static feed's ids are ours — so there is
nothing to manufacture. The prefix prevents two providers from colliding on the same numeric id
and makes the origin of any stored vote readable at a glance.

**Why not the article URL itself:** URLs are unbounded in length, and this column sits inside a
unique index — index entries have a size ceiling, so an unbounded key is a latent failure. URLs
are also mutable in practice: the same article with a tracking parameter appended would become
a different item, silently splitting one article's votes across two rows.

With `@@unique([userId, sectionType, itemRef])` the write is a single `upsert` — one round
trip, no read-then-write race, and **the database guarantees at most one vote per user per
item.** This constraint is the clearest justification for the relational choice in §3.3.

### 4.4 The raw SQL module

`feedback.repository.ts` implements the aggregation behind `GET /api/feedback/summary` and
the insight prompt builder, as hand-written parameterized SQL:

```sql
-- Per-user vote breakdown by section, with investor type joined in.
SELECT
  f.section_type,
  f.vote,
  COUNT(*)::int      AS total,
  MAX(f.created_at)  AS last_voted_at,
  p.investor_type
FROM feedback f
JOIN users u            ON u.id      = f.user_id
LEFT JOIN preferences p ON p.user_id = u.id
WHERE f.user_id = $1
GROUP BY f.section_type, f.vote, p.investor_type
ORDER BY f.section_type;
```

Executed via `prisma.$queryRaw` with `$1` **bound as a parameter, never interpolated.**
Interpolation is how SQL injection happens; a bound parameter travels separately from the
query text, so the driver cannot confuse data for code.

---

## 5. Backend structure

Layered deliberately. Each layer has one reason to change.

```
routes      → HTTP shape only. Path, method, middleware chain. No logic.
controller  → Translates HTTP ↔ domain. Reads validated input, calls one service,
              picks a status code. Knows req/res. Knows nothing about SQL.
service     → Business logic. Knows nothing about HTTP. Returns domain data or
              throws AppError. The first thing worth unit-testing.
repository  → Data access (Prisma) or outbound HTTP (providers). Swappable —
/provider     the service depends on the shape, not the vendor.
```

**Why this matters concretely, not just on a diagram:** no CryptoPanic token was obtained, so
the live news provider returns 401 on every call. Because `news.service.ts` depends on a
`NewsProvider` interface rather than on a specific vendor, the service falls back to the static
provider automatically and the section keeps working — with no change to the service, the
controller, or the route. Supplying a token later is an environment variable, not a code change.
That is the entire justification for layering a small application.

```
server/
├── prisma/{schema.prisma, migrations/, seed.ts}
├── src/
│   ├── config/env.ts                  # zod-validated env, fail-fast at boot
│   ├── lib/
│   │   ├── prisma.ts                  # single PrismaClient instance
│   │   ├── cache.ts                   # TTL cache behind an interface
│   │   └── logger.ts                  # structured, redacts secrets
│   ├── errors/AppError.ts
│   ├── middleware/
│   │   ├── requireAuth.ts  validate.ts  errorHandler.ts
│   │   ├── rateLimit.ts    notFound.ts
│   ├── modules/
│   │   ├── auth/          # routes, controller, service, schema,
│   │   │                  # token.service.ts, password.service.ts
│   │   ├── preferences/
│   │   ├── market/
│   │   │   ├── prices.service.ts  news.service.ts
│   │   │   └── providers/
│   │   │       ├── news.provider.ts          # interface
│   │   │       ├── cryptopanic.provider.ts
│   │   │       ├── staticNews.provider.ts
│   │   │       └── coingecko.provider.ts
│   │   ├── insight/
│   │   │   ├── insight.service.ts
│   │   │   └── llm/{openrouter.client.ts, prompt.ts}
│   │   ├── memes/{memes.service.ts, data/memes.json}
│   │   └── feedback/{feedback.service.ts, feedback.repository.ts}
│   ├── routes.ts                      # mounts module routers under /api
│   ├── app.ts                         # builds the Express app — no listen()
│   └── server.ts                      # reads env, calls listen()
```

**Why `app.ts` and `server.ts` are separate:** `app.ts` exports a configured app with no
side effects, so a test can import it and issue requests without binding a port. Anything
that opens a socket lives in `server.ts`. A small split that decides whether the app is
testable at all.

---

## 6. API contract

All routes under `/api`. JSON throughout. Auth via cookie.

### 6.1 Endpoints

```
POST   /api/auth/register     { name, email, password }
       → 201 { user } + Set-Cookie
POST   /api/auth/login        { email, password }
       → 200 { user } + Set-Cookie
POST   /api/auth/logout       → 204, clears cookie
GET    /api/auth/me           → 200 { user } | 401

GET    /api/preferences       → 200 { preferences } | 404 if not onboarded
PUT    /api/preferences       { assets[], investorType, contentTypes[] }
       → 200 { preferences }   (idempotent upsert; sets onboardingCompletedAt on first save)

GET    /api/market/prices     → 200 { status, coins[], cachedAt, notice? }
GET    /api/market/news       → 200 { status, articles[], provider, cachedAt, notice? }
GET    /api/insight/today     → 200 { status, insight, notice? }
GET    /api/memes/random      → 200 { status, meme }

POST   /api/feedback          { sectionType, itemRef, vote } → 200 { feedback }
GET    /api/feedback/summary  → 200 { summary[] }     // raw SQL, §4.4

GET    /healthz               → 200 { status, uptime }   // unauthenticated, warm-up
```

### 6.2 Three decisions in this contract worth defending

**(a) Four separate section endpoints, not one aggregated `GET /api/dashboard`.**

- *Independent cache lifetimes.* Prices 120s, news 10min, insight 24h, memes uncached. One
  endpoint would collapse to the shortest TTL and waste the rest.
- *Independent failure.* If the LLM returns 429, prices still render. An aggregate endpoint
  either fails wholesale or needs per-section status inside a 200 — which is reinventing
  HTTP inside a JSON body.
- *Independent refetch.* Refreshing the meme should not re-request news.

*Accepted cost:* four round trips instead of one. Issued in parallel, so added latency is
roughly one RTT, not four. If the section count grew, or for a mobile-first client on poor
connectivity, a BFF aggregate that fans out server-side and returns per-section status would
be the better trade.

**(b) The browser never contacts a third-party API — a Backend-for-Frontend.**

Express is the only process holding `COINGECKO_API_KEY`, `CRYPTOPANIC_TOKEN`,
`OPENROUTER_API_KEY`. **Anything shipped to a browser is public** — every bundle, every
`VITE_`-prefixed variable, every network request. Calling the LLM from React would publish
the key to anyone who opens devtools. Routing through the server also centralizes the cache
and the rate-limit budget, which is the only place they can be enforced across all users.

**(c) Vercel rewrite — the session cookie must be first-party.**

`vercel.json`:

```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://<service>.onrender.com/api/:path*" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Without this, an SPA on one domain calling an API on another is a cross-site request, so the
cookie needs `SameSite=None; Secure` — and browser tracking prevention blocks third-party
cookies, which would break login in some browsers while working perfectly in others. With
the rewrite the browser treats the API as same-origin, the cookie is `SameSite=Lax`, and
that entire class of problem disappears. The second rule is the SPA fallback, so client-side
routes survive a hard refresh.

*Accepted cost:* an extra proxy hop and platform-specific configuration. With a custom
domain the better shape is `api.example.com` + `app.example.com` — one registrable domain,
so the cookie is first-party without a proxy.

**Fallback if the rewrite cannot be made to work.** This is the most environment-dependent
piece of the deployment, so the response is planned rather than improvised:

1. **Primary** — SPA on the static host, `/api/*` rewritten to the API service. Cookie
   same-origin, `SameSite=Lax`.
2. **Fallback** — build the SPA and **serve its static files from Express**, with an SPA
   catch-all route. One service, one origin, no CORS configuration at all, cookie still
   `httpOnly` and same-origin. Roughly ten lines: `express.static` plus a catch-all returning
   `index.html`. Costs the CDN and independent frontend deploys; keeps every security property
   intact and makes the deployment simpler rather than more complex.
3. **Not an option** — moving the token to `localStorage`. That trades the one property worth
   having (a credential JavaScript cannot read) for configuration convenience, and both
   fallbacks above preserve it. If cross-origin cookies are the problem, the answer is to stop
   being cross-origin, not to stop protecting the token.

**What CORS is actually doing here — worth being precise about.** Under the rewrite, the browser's
request is same-origin, and the proxy's onward request to the API is server-to-server and carries
no browser `Origin` header. So **CORS is not what makes production login work** — `SameSite=Lax`
on a first-party cookie is. The CORS allowlist remains correct to have, and it is load-bearing in
exactly two places: local development, where the SPA on one port genuinely does call the API on
another, and any client hitting the API's own URL directly, bypassing the proxy.

This distinction matters because "CORS lets my frontend talk to my backend" is the common and
wrong mental model. CORS is a browser-enforced policy about which *origins* may read a response;
it has nothing to do with authentication, and it does not apply to requests a server makes on its
own behalf. Under this topology the browser never makes a cross-origin request at all.

### 6.3 Response status — how sections report degradation

Every content endpoint returns a `status`:

| `status` | Meaning | UI treatment |
|---|---|---|
| `ok` | Live data from the intended source | Normal |
| `degraded` | Something was served, but not the real thing — stale cache, fallback provider, or template insight | Render content + a small inline notice naming the reason |
| `unavailable` | Nothing could be served | Render an actionable message + retry control |

`notice` carries a short human-readable string when `status !== 'ok'`.

**Why a three-state field rather than a boolean or an HTTP error:** "these prices are four
minutes old" and "prices failed entirely" are different situations requiring different user
action, and collapsing them either hides a real problem or overstates a minor one. Returning
`degraded` in a 200 is correct because the request *succeeded* — the payload is simply not
ideal, and that is information the client needs rather than an error condition.

**Never conceal degradation.** A dashboard that silently presents a template as AI output,
or six-hour-old prices as live, is lying to its user. The notice is the honest path.

### 6.4 Error envelope

One shape, produced only by `errorHandler.ts`:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": [{ "path": "password", "message": "Must be at least 8 characters" }]
  }
}
```

Codes: `VALIDATION_ERROR` 400 · `UNAUTHORIZED` 401 · `FORBIDDEN` 403 · `NOT_FOUND` 404 ·
`CONFLICT` 409 · `RATE_LIMITED` 429 · `UPSTREAM_ERROR` 502 · `UPSTREAM_RATE_LIMITED` 502 ·
`INTERNAL_ERROR` 500.

**Why centralized:** the client needs exactly one error parser instead of one per call site.
And it is the single place deciding what leaks — stack traces are logged server-side and
never serialized in production.

**Why `UPSTREAM_RATE_LIMITED` is distinct from `UPSTREAM_ERROR`:** the user's next action
differs. A rate limit means wait; a transient error means retry now. Different codes let the
UI say the right thing.

---

## 7. Auth design

### 7.1 Flow

```
Register → validate → check email uniqueness → bcrypt hash → INSERT
         → sign JWT → Set-Cookie → 201 { user }

Login    → validate → find by email → bcrypt.compare
         → sign JWT → Set-Cookie → 200 { user }

Protected request
         → requireAuth reads cookie → jwt.verify → attach req.user → next()
         → missing/invalid/expired → 401

Logout   → clear cookie → 204
```

### 7.2 The cookie, attribute by attribute

```ts
res.cookie(env.COOKIE_NAME, token, {
  httpOnly: true,
  secure:   env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge:   ms(env.JWT_EXPIRES_IN),
  path:     '/',
});
```

| Attribute | Mechanism | Threat addressed |
|---|---|---|
| `httpOnly` | `document.cookie` cannot read it | **XSS token theft.** An injected script cannot exfiltrate a token it cannot read. The entire reason not to use `localStorage`. |
| `secure` | HTTPS only | Network interception. Disabled in dev because localhost is plain HTTP. |
| `sameSite: 'lax'` | Not sent on cross-site POST/PUT/DELETE | **CSRF.** A form on a hostile origin posting to the API arrives with no cookie. |
| `maxAge` | Browser-side expiry | Cookie lifetime tracks token lifetime; no dead credential lingering. |
| `path: '/'` | Sent to all routes | Required because the rewrite serves app and API from one origin. |

### 7.3 Why not `localStorage`

`localStorage` is readable by every script on the page — including one arriving through a
compromised dependency. A single XSS becomes a stolen, replayable session token. With
`httpOnly`, the browser holds the credential and JavaScript never sees it: XSS can still act
as the user within that page, but cannot steal the session for use elsewhere or later.

Cookies do introduce CSRF, which `localStorage` does not have. `SameSite=Lax` closes the
primary vector. **For defence in depth** the next addition is the double-submit cookie
pattern — a readable CSRF token mirrored in a request header and compared server-side —
because `SameSite` is a single browser-enforced control and should not be the only one.
Judged sufficient at this scope, with the gap named rather than ignored.

### 7.4 Passwords

- **`bcryptjs`, cost factor 12.** Pure JavaScript, so no native build toolchain — relevant
  on Windows and on hosted build environments. Slower than native bcrypt; irrelevant here.
- **The cost factor is the point.** bcrypt is deliberately slow and the cost is tunable
  upward as hardware improves. Fast hashes (MD5, SHA-256) are wrong for passwords *because*
  they are fast — speed is what makes brute-forcing cheap.
- **Salting is automatic.** bcrypt generates a per-password salt and embeds it in the
  output, so identical passwords produce different hashes and precomputed tables are
  useless.
- **With more time:** argon2id — memory-hard, therefore also resistant to GPU/ASIC
  parallelism, and the current OWASP first recommendation.

### 7.5 Token lifetime, and why this choice is not a dead end

Single access token, `JWT_EXPIRES_IN=7d`, env-driven.

**The weakness, stated plainly:** a JWT is stateless and therefore cannot be revoked before
it expires. Logout clears the cookie, but a token captured off the wire remains valid for
its full lifetime. Seven days is a long window.

**The production answer** is a short access token (~15 min) plus a long-lived, rotating,
revocable refresh token — requiring a `refresh_tokens` table, `POST /auth/refresh`, rotation
with reuse detection, and a client interceptor that retries once on 401. That is a
substantial surface, and a half-built auth system is worse than a simple one.

**Why this remains a stepping stone:** all signing and verification is isolated in
`token.service.ts`, and the cookie is set in exactly one place. Adding refresh tokens is
**additive** — a second token type, one endpoint, one table, one interceptor. No existing
code is rewritten. The seam was designed for the upgrade.

### 7.6 Remaining auth-surface protections

- **Rate limit on `/api/auth/*`** — 10 requests / 15 min / IP. Login is the one endpoint
  where unlimited attempts are directly useful to an attacker.
- **Identical error for unknown email and wrong password** — same 401, same message.
  Distinguishing them turns the login form into a free tool for discovering which emails
  have accounts (user enumeration).
- **`helmet`** for baseline security headers.
- **JWT payload contains `{ sub: userId }` and nothing else.** A JWT is signed, not
  encrypted — anyone can base64-decode and read it. Never carry anything you would not
  publish.
- **`JWT_SECRET` validated at boot** to be ≥32 chars. The process refuses to start
  otherwise, so a weak or missing secret is a startup crash rather than a silent
  production vulnerability.

---

## 8. Personalization

This is NF1 — the requirement that distinguishes a personalized dashboard from a static one.

| Onboarding answer | Stored as | Drives |
|---|---|---|
| Which assets? | `assets: string[]` | Which coins the prices section shows; the news filter; the asset list in the insight prompt |
| Investor type? | `investorType` | Insight tone and time horizon; which price-change window is emphasized (24h for `DAY_TRADER`, 30d for `HODLER`) |
| Content types? | `contentTypes[]` | Section **order** and visual emphasis on the dashboard |

### 8.1 Ordering rather than hiding

Preferred sections render first and prominently; non-preferred render below, still
functional, visually de-emphasized.

**Why not hide them:** all four sections are required to exist and work, and a user who
selects only "Fun" should still be able to reach the others. Ordering demonstrates
personalization without removing functionality. Documented in the README so it reads as a
decision.

### 8.2 Insight prompt (versioned, `promptVersion: "v1"`)

```
System: You are a concise crypto market assistant. You do NOT give financial
advice. 2–3 sentences, max 60 words. Never recommend buying or selling.

User:
  Investor profile: {investorType}
  Watching: {assets}
  Prefers: {contentTypes}
  Recent 24h moves: {compact price summary from cache}
  Recent feedback signal: {e.g. "upvoted news, downvoted memes"}

  Write today's insight for this investor.
```

- **`promptVersion` is stored on every row.** When the prompt changes, historical insights
  stay attributable to the prompt that produced them — without which A/B comparison is
  impossible.
- **Prices come from cache, not a fresh fetch.** The insight reuses data the prices section
  already paid for.
- **The feedback line closes the loop (NF3).** Votes measurably change tomorrow's prompt.

### 8.3 Why the insight is persisted per user per day

`@@unique([userId, forDate])`, read-through then generate:

1. **Necessary** — roughly 50 LLM requests/day account-wide. Per-request generation would
   exhaust the quota within a handful of refreshes.
2. **Correct** — "insight of the *day*" should not change on refresh. The cache *is* the
   feature.
3. **Durable** — survives process restarts, unlike an in-memory cache.
4. **Useful** — provides real stored content for inspection and a first dataset for the
   feedback pipeline.

The best example in this project of a platform constraint and a product requirement pointing
at the same design.

---

## 9. Caching, resilience, cold starts

### 9.1 Caching — and why the naive design was wrong

`lib/cache.ts` — in-process `Map` of `{ value, expiresAt }` behind an interface:

```ts
interface Cache {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T, ttlMs: number): void;
  getOrSet<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T>;
}
```

**The binding constraint is CoinGecko's monthly cap, not its per-minute limit.** 30
calls/min sounds generous; 10,000 calls/month is ~333/day. Reasoning only about the
per-minute figure leads to the wrong TTL.

**The design error worth recording:** the obvious approach keys the price cache by the
requesting user's asset *set*. That makes upstream call volume scale with **the number of
distinct preference combinations** — i.e. with user count. Ten users with ten different
watchlists means ten times the upstream traffic for largely overlapping data.

**The fix — cache per entity, not per request.** `/coins/markets?ids=a,b,c` returns many
coins in a single call, so the service fetches the **entire curated allowlist in one batched
request** and stores **each coin under its own key**. Any user's request is then assembled
from shared per-coin entries.

- Upstream volume scales with the number of distinct *coins* (bounded by the allowlist,
  ~20), not with users.
- One upstream call serves every user regardless of their selections.
- Adding a user adds zero upstream traffic.

| Resource | Key | TTL | Reason |
|---|---|---|---|
| Prices | `price:{coinId}` | **120s** | Matches CoinGecko's own 1–5 min refresh cadence. A shorter TTL spends quota to receive identical bytes. |
| News | `news:{sortedAssetIds}` | **10 min** | Slow-moving content, tight upstream tier. |
| Insight | Postgres, not memory | **24h** | §8.3 |
| Meme | uncached | — | Must change on each update (NF2) |

**With better resources:** shorter TTL on a paid tier, and replace polling with server-push
(SSE or WebSocket) so clients receive updates instead of asking for them.

**Cache-key discipline:** any cache entry serving user-specific data must include the
user-specific input in its key. A key shared across users with different inputs is a
data-leak-shaped bug, not a performance bug. Per-coin keying sidesteps this for prices
entirely — the entries are not user-specific at all, which is part of why it is the better
design.

**Why in-memory and not Redis:** this cache is **per process**. With two instances each
keeps its own copy, halving the hit rate and doubling upstream traffic. Any horizontal
scaling requires Redis — which is exactly why the cache sits behind the `Cache` interface,
making that swap one new file and one line of wiring. Not done now because the deployment
target is a single instance and Redis would be a second service for zero present benefit.

### 9.2 Degradation, per dependency

| Failure | Behaviour | `status` |
|---|---|---|
| CoinGecko 429 / timeout, cache warm | Serve last known values past TTL | `degraded` — "Prices from N minutes ago; live updates are rate-limited." |
| CoinGecko fails, cache cold | Nothing to serve | `unavailable` — actionable message + retry |
| CryptoPanic returns 401 (no token, expected) | Automatic fallback to static provider | `degraded` — "Showing our curated feed; the live news provider is unavailable." |
| LLM 429 / model removed | Deterministic template insight from preferences + cached prices, persisted with `source: "fallback"` | `degraded` — "Generated from your preferences; the AI service is rate-limited." |
| Database unreachable | 503 + retry | — |

### 9.2a The news section, stated plainly

No CryptoPanic token was obtained. **The static curated feed is what serves news in
production**, and the section reports `provider: "static"` with a visible notice rather than
presenting curated content as a live feed.

**The live provider is still implemented**, for two reasons:

1. **An interface with one implementation is not a pattern, it is overhead.** The
   `NewsProvider` abstraction only earns its place if something else implements it. With both
   present, the boundary is real and the vendor genuinely is a configuration choice.
2. **The fallback path is the code that runs, so it must be exercised.** Without a token
   CryptoPanic returns 401, which triggers the fallback on every request — meaning the
   degradation path is not theoretical, it is the default path and is verified continuously.

**What is honest to claim:** the live provider is written against the documented v2 API and the
automatic fallback is tested. **What is not:** that the live integration has been verified
against real authenticated responses. It has not, and the README says so. Adding a token would
be an environment variable, not a code change.

**Consequence for the curated feed:** because it serves production rather than standing in as a
placeholder, its articles need real titles, real sources, real dates and correct asset tags.
This is a content requirement, not a stub.

### 9.3 Error-handling discipline

- **One `try/catch` per provider call, at the service boundary** — not scattered through
  controllers and helpers. The catch maps the failure to a typed `AppError` with a specific
  code, and the service then decides between degrade and fail.
- **Never a bare `catch {}`.** Every catch either handles the error meaningfully or
  re-throws. A swallowed error is a bug that will be discovered by a user rather than a log.
- **Every outbound call has an explicit timeout** — 5s for data providers, 10s for the LLM.
  Without one, a hanging upstream becomes a hanging request and then an exhausted connection
  pool.
- **Failures are logged with context** (provider, status code, elapsed ms) even when the
  user-facing result is a graceful degrade. Silent degradation is unmaintainable.

### 9.4 Cold-start UX

The free hosting tier sleeps after 15 minutes and takes 30–60s to wake. Untreated, a first
visit looks like a broken application.

1. **Warm early.** The SPA issues `GET /healthz` on load, before any credential is
   submitted, so wake-up overlaps with the user reading the login form.
2. **Explain the wait.** Any request exceeding 3s surfaces: *"Waking up the server — this
   can take up to a minute on the free tier."* Honest and specific.
3. **Skeletons, not spinners.** Each section renders its own skeleton, so a slow section
   never blocks a fast one.
4. **Documented in the README** with the reason.

A paid tier removes this entirely. Given a free-tier constraint, the choice was to design
the wait honestly rather than conceal it.

---

## 10. Frontend structure

```
client/
├── vercel.json                    # /api/* rewrite + SPA fallback (§6.2c)
├── tailwind.config.ts             # maps semantic names → CSS variables
├── src/
│   ├── styles/theme.css           # the ONLY place colour values are defined
│   ├── lib/{apiClient.ts, queryClient.ts}
│   ├── types/api.ts               # DTOs mirroring the server contract
│   ├── components/ui/             # Card, Button, Spinner, Skeleton,
│   │                              # ErrorState, EmptyState, DegradedNotice
│   └── features/
│       ├── auth/                  # AuthContext, ProtectedRoute, OnboardingGate,
│       │                          # LoginPage, RegisterPage
│       ├── onboarding/            # OnboardingPage + steps/
│       └── dashboard/             # DashboardPage, sections/, VoteButtons,
│                                  # useFeedback
```

### 10.1 Feature folders, not type folders

Grouped by feature (`features/auth/*`) rather than by kind (`components/`, `hooks/`,
`pages/`). Changing how login works touches one directory instead of four. Same instinct as
the backend's module folders: **colocate by reason-to-change.**

### 10.2 Theming — no hardcoded colours anywhere

**Single source of truth.** All colour values live in `src/styles/theme.css` as CSS custom
properties, exposed to Tailwind under semantic names. Components reference the semantic name
and never a raw value.

```css
/* src/styles/theme.css — the only file containing colour values */
:root {
  --color-bg:            9 9 11;        /* rgb channels, space-separated */
  --color-surface:      24 24 27;
  --color-surface-alt:  39 39 42;
  --color-border:       39 39 42;
  --color-text:        250 250 250;
  --color-text-muted:  161 161 170;
  --color-accent:      250 250 250;    /* PROVISIONAL — monochrome. Step 15 design pass replaces this */
  --color-accent-fg:     9 9 11;
  --color-positive:     34 197 94;
  --color-negative:    239 68 68;
  --radius: 0.75rem;
}
```

```ts
// tailwind.config.ts
theme: {
  extend: {
    colors: {
      bg:                  'rgb(var(--color-bg) / <alpha-value>)',
      surface:             'rgb(var(--color-surface) / <alpha-value>)',
      'surface-alt':       'rgb(var(--color-surface-alt) / <alpha-value>)',
      border:              'rgb(var(--color-border) / <alpha-value>)',
      foreground:          'rgb(var(--color-text) / <alpha-value>)',
      muted:               'rgb(var(--color-text-muted) / <alpha-value>)',
      accent:              'rgb(var(--color-accent) / <alpha-value>)',
      'accent-foreground': 'rgb(var(--color-accent-fg) / <alpha-value>)',
      positive:            'rgb(var(--color-positive) / <alpha-value>)',
      negative:            'rgb(var(--color-negative) / <alpha-value>)',
    },
  },
}
```

**Every token in `theme.css` must appear in this map.** `CLAUDE.md` forbids inlining a colour, so
a token that exists in CSS but is not exposed to Tailwind leaves a component with no legal way to
express it. Keep the two in sync; if a component needs a colour with no token, add the token
rather than reaching for a literal.

`foreground` rather than `text`, because Tailwind derives class names from the key and `text-text`
is unusable. `foreground` / `accent-foreground` also matches the naming convention in wide use
across component libraries, which makes the intent obvious to anyone reading the code.

Set the base `color` and `background-color` on `body` in `theme.css` so the default is correct
without every component restating it.

Components then write `bg-surface`, `text-muted`, `text-positive`. **Never** `bg-zinc-900`,
never a hex literal, never an inline `style` colour.

Three points of craft here:

- **Space-separated RGB channels, not hex.** This is what makes `<alpha-value>` work, so
  `bg-surface/50` composes correctly. Storing hex breaks opacity utilities.
- **Name tokens by role, not by colour.** `positive`/`negative`, not `green`/`red` — in some
  markets red signifies a rise, and a token named `green` cannot be re-themed without
  becoming a lie. Role names survive redesigns; colour names do not.
- **Retheming is one file.** Changing the entire palette means editing `theme.css`. Adding a
  light mode means one additional `[data-theme='light']` block. Nothing in any component
  changes.

**Typography.** Two roles minimum: one face for interface text, one **monospaced or
tabular-figure** face for numbers. Prices and percentages get
`font-variant-numeric: tabular-nums` so digits occupy equal width and values stop jittering
as they update — a small detail that separates a dashboard that feels engineered from one
that feels assembled.

**Visual direction.** The default reflex for a crypto dashboard — near-black background with
a single bright acid-green accent — is the most generic answer available, and reads as
unconsidered precisely because it is what everyone reaches for. The design pass should
commit to a specific palette derived from the subject, spend its boldness in **one**
signature element, and keep everything else disciplined. Recorded as a design brief before
implementation: 4–6 named values, two type roles, one signature element.

**Quality floor, not announced:** responsive to mobile, visible keyboard focus,
`prefers-reduced-motion` respected.

### 10.3 Routing and the onboarding gate

```
/            → redirect to /dashboard or /login
/login       → public; redirect away if already authenticated
/register    → public
/onboarding  → protected; redirect to /dashboard if already onboarded
/dashboard   → protected + requires completed onboarding
*            → NotFound
```

`ProtectedRoute` awaits `GET /api/auth/me`. **The third state is the one that matters:** the
answer is not authenticated-or-not, it is authenticated / not / *not yet known*. Rendering a
redirect during "not yet known" flashes the login page at users who are in fact signed in.
The gate therefore renders a full-page loader until `me` resolves.

### 10.4 Types across the boundary

`client/src/types/api.ts` hand-mirrors the server's response DTOs. **This is duplication and
it can drift** — a server-side rename produces no client compile error.

**With more time:** npm workspaces with a shared `@app/types` package imported by both,
making the contract single-source and drift a compile error. Not done here because
workspaces complicate the hosting platforms' root-directory build configuration, and the
duplication is small, contained in one file, and documented.

### 10.5 Optimistic voting

A vote updates local state immediately, fires the mutation, and rolls back on failure.
Voting is low-stakes and high-frequency — a 300ms wait to see your own click register reads
as broken. TanStack Query's `onMutate`/`onError` handle this directly.

### 10.6 Interface copy

Following the same discipline as the code:

- **Errors state what happened and what to do.** They do not apologize and are never vague.
  "Today's insight isn't ready — the AI service hit its rate limit. Try again in a few
  minutes." not "Sorry, something went wrong."
- **An empty state is an invitation to act**, not a blank region. No news for the selected
  assets is a real state and needs real copy.
- **Actions keep the same verb throughout a flow.** A button reading "Save preferences"
  produces a confirmation reading "Preferences saved".
- **Sentence case, plain verbs, no filler.**

---

## 11. Security checklist

Every item verifiable in code.

**Secrets**
- [ ] `.env` gitignored; `.env.example` committed with placeholders only
- [ ] No secret in any `VITE_`-prefixed variable — those compile into the public bundle
- [ ] All third-party keys server-side only; browser contacts no third-party API
- [ ] Platform env vars set in dashboards, never in the repo
- [ ] Logger redacts `password`, `passwordHash`, `authorization`, `cookie`, `token`
- [ ] `git log -p` scanned for accidentally committed credentials

**Auth**
- [ ] bcrypt cost 12; plaintext never logged, stored, or returned
- [ ] `passwordHash` excluded from every response via an explicit `toPublicUser` mapper
- [ ] Cookie `httpOnly` + `secure` in production + `sameSite=lax`
- [ ] `JWT_SECRET` ≥32 chars, asserted at boot
- [ ] Identical 401 for unknown email and wrong password
- [ ] Rate limit on `/api/auth/*`

**Input & transport**
- [ ] zod validation on every body, query, param
- [ ] `express.json({ limit: '10kb' })`
- [ ] CORS allowlist from env, `credentials: true`, never `*` with credentials
- [ ] `helmet` enabled
- [ ] All queries parameterized, including `$queryRaw`
- [ ] Stack traces logged, never serialized to the client in production

**Authorization**
- [ ] **Every `userId` derives from the verified token, never from the request.**
      `POST /api/feedback` must reject or ignore a body-supplied `userId` — otherwise any
      user can write rows as any other user. Ownership comes from the credential, never
      from the caller's assertion. **The single highest-value line in this checklist.**

---

## 12. SQL appendix — what each Prisma call generates

```ts
// 1. Find user by email (login)
prisma.user.findUnique({ where: { email } })
```
```sql
SELECT * FROM users WHERE email = $1 LIMIT 1;
-- Uses the unique index on users.email → index lookup, not a table scan.
```

```ts
// 2. Create user (register)
prisma.user.create({ data: { name, email, passwordHash } })
```
```sql
INSERT INTO users (id, name, email, password_hash, created_at, updated_at)
VALUES ($1,$2,$3,$4, now(), now())
RETURNING *;
-- Duplicate email raises unique-violation 23505 → mapped to 409 CONFLICT.
-- The DB enforces uniqueness rather than a SELECT-then-INSERT, which would
-- have a race window between the check and the write.
```

```ts
// 3. User + preferences in one query
prisma.user.findUnique({ where: { id }, include: { preferences: true } })
```
```sql
-- Prisma issues TWO statements here, not a join (verified with log: ['query']):
SELECT id, email, name, password_hash, onboarding_completed_at, created_at, updated_at
FROM users WHERE id = $1 LIMIT $2 OFFSET $3;

SELECT id, user_id, assets, investor_type::text, content_types::text[], created_at, updated_at
FROM preferences WHERE user_id IN ($1) OFFSET $2;

-- One extra statement per *relation*, not per row, so the count is constant: not N+1.
-- Note it names columns rather than SELECT *, and casts enums to text on the way out.
--
-- The single-statement equivalent would be the join below, and LEFT is the point:
--   SELECT u.*, p.* FROM users u
--   LEFT JOIN preferences p ON p.user_id = u.id
--   WHERE u.id = $1;
-- INNER would return zero rows for a user who has not onboarded, which reads as
-- "user not found" — the same bug the two-query form cannot have, since a missing
-- preferences row simply comes back as null.
```

```ts
// 4. Upsert preferences
prisma.preference.upsert({ where: { userId }, create: {...}, update: {...} })
```
```sql
INSERT INTO preferences (id, user_id, assets, investor_type, content_types, created_at, updated_at)
VALUES ($1,$2,$3,$4,$5, now(), now())
ON CONFLICT (user_id)
DO UPDATE SET assets = $3, investor_type = $4, content_types = $5, updated_at = now()
RETURNING *;
-- ON CONFLICT makes this idempotent and atomic: no read-then-write race, and
-- resubmitting onboarding is safe.
```

```ts
// 5. Upsert a vote
prisma.feedback.upsert({
  where: { userId_sectionType_itemRef: { userId, sectionType, itemRef } },
  create: {...}, update: { vote },
})
```
```sql
INSERT INTO feedback (id, user_id, section_type, item_ref, vote, created_at, updated_at)
VALUES ($1,$2,$3,$4,$5, now(), now())
ON CONFLICT (user_id, section_type, item_ref)
DO UPDATE SET vote = $5, updated_at = now()
RETURNING *;
-- The composite unique constraint makes "one vote per user per item" a database
-- guarantee rather than an application-level hope.
```

```ts
// 6. Today's insight
prisma.dailyInsight.findUnique({ where: { userId_forDate: { userId, forDate } } })
```
```sql
SELECT * FROM daily_insights WHERE user_id = $1 AND for_date = $2;
```

```ts
// 7. Feedback summary — hand-written SQL, §4.4
```

**Concepts underpinning these:** `INNER` vs `LEFT JOIN`; `GROUP BY` with aggregates; what an
index does and why `WHERE email = $1` benefits from one; `ON CONFLICT` / upsert semantics;
transactions and atomicity; why parameterized queries prevent injection; and the N+1 problem
— avoided here because `include` costs one additional query per *relation*, not one per row.
Prisma loads relations with separate queries by default rather than a JOIN, so the query count
stays constant as the row count grows.

---

## 13. Version control strategy

```
main                    ← always deployable; merges auto-deploy
  feat/foundation       ← tooling, config, DB, core middleware
  feat/auth             ← auth + preferences
  feat/data-providers   ← prices, news, insight, memes
  feat/feedback-loop    ← feedback + prompt integration
  feat/frontend         ← client shell through dashboard
  chore/deploy-and-docs ← deployment, README, docs
```

**Branch per milestone, not per change.** One conventional commit per completed unit of work
*inside* the branch; a pull request into `main` carrying a written description of what
changed and why.

**Merge with `--no-ff`.** A squash merge would flatten the per-step commits into one, losing
the incremental history and the reasoning captured in individual messages. A merge commit
preserves both the commits and the visible branch structure.

**CI runs on every pull request** — install, typecheck, lint (tests once they exist). `main`
stays green, and merging triggers the platform's auto-deploy.

**Commit format** — Conventional Commits:

```
feat(auth): add register and login with httpOnly cookie JWT
feat(market): cache prices per coin with a batched upstream fetch
fix(dashboard): render empty state when no news matches user assets
docs(readme): add setup and architecture summary
chore(ci): add typecheck and lint workflow
```

Never commit `.env`, `node_modules`, `dist`, or platform build directories.

---

## 14. Deliberate omissions

Named so they read as decisions.

| Not built | Why not | What instead |
|---|---|---|
| Refresh-token rotation | Larger surface than the schedule allows; half-built auth is worse than simple auth | 15min access + rotating refresh with reuse detection |
| Redis | Second service, no benefit on a single instance | Redis once >1 instance; cache already behind an interface |
| Full test suite | Time allocated to working features; a focused set covers the security-critical paths | Vitest on services, Supertest on auth, Playwright on the happy path |
| Normalized assets table | No query requires it (§4.2) | Normalize when assets need metadata or reverse lookup |
| Shared types package | Workspaces complicate deploy config (§10.4) | npm workspaces + `@app/types` |
| Email verification / reset | Requires an email provider; outside current scope | Transactional email + single-use signed tokens |
| Observability | No budget for hosted tooling | Structured logs → hosted sink; error tracking; `/metrics` |
| Docker | Platform builds from source | `docker-compose` with Postgres for one-command local setup |
| CSRF token | `SameSite=Lax` covers the primary vector | Double-submit cookie for defence in depth |
| Pagination | Fixed-size dashboard sections | Cursor pagination on news and feedback history |

---

## 15. Environment variables

**`server/.env`**
```
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://...          # POOLED — hostname contains "-pooler"
DIRECT_URL=postgresql://...            # DIRECT  — same host WITHOUT "-pooler"
JWT_SECRET=                            # >=32 chars, generated, never reused
JWT_EXPIRES_IN=7d
COOKIE_NAME=cca_token
CORS_ORIGINS=http://localhost:5173
COINGECKO_API_KEY=                     # free Demo key
CRYPTOPANIC_TOKEN=                     # INTENTIONALLY EMPTY — static feed serves news (§9.2a)
OPENROUTER_API_KEY=
LLM_MODEL=                             # env-driven: free model IDs rotate
LLM_ENABLED=true
CACHE_TTL_PRICES_MS=120000
CACHE_TTL_NEWS_MS=600000
```

**`client/.env`**
```
VITE_API_BASE_URL=http://localhost:4000/api   # production: /api, via rewrite
```

`config/env.ts` parses this with zod at boot and throws on anything missing or malformed.
**Fail fast, loudly, at startup** — a missing `JWT_SECRET` should crash the process on
deploy rather than surface as an authentication bug days later.

### 15.1 Why there are two database URLs

Both strings point at the **same database**; they differ only in endpoint.

- **`DATABASE_URL` (pooled)** — routes through a connection pooler (PgBouncer). Correct for
  application runtime: many short-lived connections are multiplexed onto few backend
  processes, which is what keeps a small instance from exhausting its connection limit.
- **`DIRECT_URL` (direct)** — bypasses the pooler. Required by Prisma Migrate (`migrate dev`,
  `migrate deploy`) and introspection, because a pooler in transaction mode does not support
  the DDL those commands issue. `db seed` is **not** in that list: it only executes the seed
  script, whose `PrismaClient` connects over the pooled `DATABASE_URL` like any other
  application code.

**Recognise this failure.** Omitting `DIRECT_URL` makes Prisma fall back to the pooled URL for
migrations, which fails with messages like *"cannot start a transaction in prepared statements
mode"*. These read as database errors and send you debugging the schema, when the actual cause
is the connection endpoint. Set both from the start.

**Add `connect_timeout=15` to both strings.** The database scales to zero after inactivity and
takes a moment to wake. Prisma's default connect timeout is short enough that the first query
after an idle period can fail before the compute is ready — producing an intermittent,
hard-to-reproduce connection error that looks like a network problem. Raising the timeout costs
nothing and removes the class of bug entirely. Keep every other parameter the provider gave you
(`sslmode`, `channel_binding`) exactly as issued.

---

## 16. Definition of done

- [ ] Two accounts with different onboarding answers produce visibly different dashboards
- [ ] All four sections render; each degrades gracefully with an honest notice when its
      provider fails
- [ ] Votes persist; reload shows the prior vote; re-voting updates rather than duplicates
- [ ] The insight is identical on refresh and different the next day
- [ ] The meme changes on refresh
- [ ] Logout clears the cookie; `/dashboard` then redirects to `/login`
- [ ] No secret in git history; `.env.example` complete
- [ ] No hardcoded colour value anywhere outside `theme.css`
- [ ] Deployed; login works end-to-end from a browser profile that has never seen the app
- [ ] Read-only database role created and verified from a separate client
- [ ] README covers setup, architecture, decisions, and known limitations
- [ ] Every §11 checklist item verified in code
- [ ] §17 updated with anything that diverged from this design

---

## 17. Deviations from this design

This document was written before implementation. Where reality diverged, it is recorded here
rather than silently edited above — the original reasoning and the correction are both useful.

**Update this as you build.** A design document that no longer matches the code is worse than
no document at all, because it misleads with authority.

| § | Designed | Built | Why it changed |
|---|---|---|---|
| §4 | Field names unmapped, so Prisma would create camelCase columns | `@map("snake_case")` on every field; table `@@map`s unchanged | §12 and §4.4 are written in snake_case. Unquoted identifiers fold to lowercase in Postgres, so `f.section_type` would have errored against a `sectionType` column — the raw-SQL module in §3.4 could not have run as documented. The alternative was quoting every identifier (`f."sectionType"`) in all hand-written SQL, forever. The Prisma client API is unaffected. |
| §4 | `generator client { provider = "prisma-client-js" }` | `prisma` and `@prisma/client` pinned to exactly `6.19.2` | Prisma 7 (current `latest`, 7.9.1) replaces this generator with `prisma-client` + a required `output` path, imports the client from that path rather than `@prisma/client`, and requires a driver adapter in the constructor — three changes to satisfy a version bump that buys this project nothing. v6 is a maintained track, not legacy: Prisma's tooling supports v6 and v7 side by side, and 6.19 is the current stable v6 release, still the version Prisma's own docs recommend for MongoDB pending v7 support. **Revisit if v6 stops receiving fixes.** |
| §4 | Generator block written on one line | Expanded to three lines | Prisma's schema language rejects a single-line block (`P1012`). Formatting only. |
| §15 | — | Seed refuses to run when `NODE_ENV=production` | The seed hashes a password that is committed in the repository. Without the guard, one careless `prisma db seed` against production creates a live account whose credentials are public. Three lines; deletable if you disagree. |
| §5 | `AppError.ts`, `errorHandler.ts`, `requireAuth.ts`, `rateLimit.ts` | `app-error.ts`, `error-handler.ts`, `not-found.ts`, `require-auth.ts`, `rate-limit.ts`, `validate.ts` | `CLAUDE.md` §5 requires `kebab-case.ts` for modules and is the more specific rule; §5's tree used PascalCase/camelCase for the same files. |
| §5 | `routes.ts` mounts module routers under `/api` | Deferred from Step 3; created in Step 5, mounting `/api/auth` | There were no modules until Step 5, so the file would have mounted nothing — dead code by `CLAUDE.md` §5. |
| §3.2 | "Express" | Pinned exact `express@5.2.1` | Express 5 forwards a rejected promise from an async handler to the error middleware automatically. On Express 4 an `await` that throws never reaches `errorHandler.ts` and the request hangs, so "errors are formatted in exactly one place" would hold only if every async controller carried a `try/catch` — a rule kept by memory rather than by the framework. **Consequence for §6.2c:** Express 5 removed bare `*` route patterns, so the SPA-from-Express fallback needs a named wildcard (`app.get('/*splat', …)`), not `app.get('*', …)`. |
| §15 | "zod" | Pinned exact `zod@4.4.3` | Two v4 deltas that Step 5 must not write from v3 memory: `z.string().email()` is superseded by `z.email()`, and the `required_error` / `invalid_type_error` options are replaced by a single `error` option. The `issues` array that §6.4's `details` maps from is unchanged. |
| §15 | "throws at boot on anything missing" | Everything required except `CRYPTOPANIC_TOKEN` and `LLM_MODEL` | §15's own example leaves both blank, so "all required" could not be literal. `COINGECKO_API_KEY` and `OPENROUTER_API_KEY` are required from Step 3 even though no code reads them until Steps 7 and 9. **This is a decision, not an oversight:** a missing production variable should kill the Step 4 deploy immediately, rather than surface weeks later as one broken dashboard section. |
| §15 | — | Dev loads `.env` via `node --env-file`, not `dotenv` | The app process does not read `.env` on its own, and `dotenv` is named nowhere in this document. `tsx watch --env-file=.env` uses a built-in Node flag instead of adding a dependency. Raises the floor to Node ≥20.6; production passes no flag, since the platform supplies real environment variables. |
| §6.4 | Nine codes, none mapping to 503 | **Resolved in Step 5** — tenth code `SERVICE_UNAVAILABLE` 503 | §9.2 specifies "database unreachable → 503 + retry", but the taxonomy had no 503 code and `INTERNAL_ERROR` 500 tells the client "we broke" rather than "retry shortly". Step 5 is the first code to touch Postgres and Neon scales to zero after five minutes, so the first request after an idle period is exactly where this lands. Raised from open item to implemented code rather than deferred a third time. |
| §6.4, §9.3 | "One `try/catch` per provider call, at the service boundary" | Prisma failures split by whether they carry business meaning | `P2002` on register means "that email is taken" — a fact only the service can interpret — so it is caught in `auth.service.ts` and mapped to 409. Connection-class failures (`PrismaClientInitializationError`, `P1001`, `P1002`, `P1017`) mean nothing a service can act on and no service can degrade around them, so they map identically from everywhere and are handled once in `error-handler.ts` alongside the existing `express.json` branch. **The cost, stated plainly:** a middleware now imports `Prisma`, so it knows about the ORM. The alternative was the same mapping repeated in a catch in every future service — a rule kept by memory in five files rather than enforced in one. |
| §6.4 | — | `express.json` rejections map to `VALIDATION_ERROR` 400 | A body over the 10kb limit raises a 413 and malformed JSON a 400, both before any route runs. Mapped to `INTERNAL_ERROR` by default they returned **500** — blaming the server for the caller's mistake. Found by testing, not by reading. The taxonomy has no 413, so both become `VALIDATION_ERROR` with a message naming which occurred. |
| §6.4 | "stack traces are logged server-side" | 5xx logs at `error` with the stack; 4xx logs at `warn` without it | A stack for every 404 from a passing scanner buries the failures that matter. The response body carries no stack in any environment, as specified. |
| §6.2c | Two rewrite rules: `/api/:path*` and the SPA fallback | Three rules — `/api/:path*`, **`/healthz`**, then the fallback | §6.1 puts health at `/healthz`, outside `/api`, so the two-rule set never proxied it and `BUILD_PLAN`'s smoke check (`<spa-url>/api/healthz` → 200) was unsatisfiable against the documented contract. **The check was wrong, not the contract** — the smoke test is now `<spa-url>/healthz`. The path was fixed deliberately in Step 1 so implementations could change underneath it, and §9.4's warm-up ping targets it: without the rule that ping would hit the SPA fallback and return `index.html`, appearing to succeed while never waking the API. |
| §6.2c | — | **Diagnostic worth keeping: read the content-type of a failed health check** | A 404 carrying **our JSON envelope** means the proxy reached the API and only the path is wrong. A 404 or 200 of **HTML** means the rewrite never fired and Vercel answered from the SPA fallback. Same status code, opposite causes; the body distinguishes them faster than any dashboard will. |
| §2, §15 | One Neon database implied | Neon branch `prod`, with a fresh empty database `crypto_advisor`, serves production; the parent branch stays the dev database | Branching alone was not enough: a Neon branch copies its parent's **data**, so it would have carried `demo@example.com` — whose password is committed in this repository — onto a public URL. A new empty database inside the branch has nothing to delete. It also stops local development writing to the rows the live site serves. |
| §2, §13 | — | **Naming collision, stated once so it is never re-derived** | Three unrelated things share the word *production*: the Neon branch named `production` is the **dev** database (Neon's default name for the parent), the Render **Production** environment is the deployed service, and `NODE_ENV=production` is the runtime flag driving `secure: true` on the auth cookie. The database behind the live site is the branch named **`prod`**. |
| BUILD_PLAN §4 | Render build: `npm install && npx prisma generate && npm run build` | Appends `&& npx prisma migrate deploy` | The step requires migrations applied but the stated command never applies them, so every future merge to `main` would deploy code without its schema unless someone remembered. Migrations run **last**, so a build that fails to compile has not already altered the production schema. |
| §7.1, §12 | §7.1: "check email uniqueness → bcrypt hash → INSERT". §12 item 2: the DB enforces uniqueness, because SELECT-then-INSERT "would have a race window" | No pre-check; `prisma.user.create` and catch the violation | The two sections specify mutually exclusive designs and §12 explicitly names §7.1's as the buggy one. §12 wins. **One correction to §12's own comment:** it names SQLSTATE `23505`, which is what Postgres raises but *not* what the `catch` can see — Prisma wraps it as `PrismaClientKnownRequestError` with `code: 'P2002'`, and that is what the code tests. |
| §7.6 | "Identical error for unknown email and wrong password" prevents user enumeration | Kept, and **named as incomplete** | `POST /api/auth/register` answers the same question the login form is hardened against: a 409 confirms an address has an account, from an endpoint needing no credential. The 409 stays — a registration form that cannot say "that email is taken" is unusable, and the alternative (always 201, disambiguate by email) needs the provider §14 excludes. So this is an **accepted asymmetry**, not a closed vector; the mitigation if it mattered is the rate limiter on that route. A second residual: login returns faster for an unknown email than a wrong password, because bcrypt only runs in the second case. Left unfixed deliberately — closing a timing oracle while a 409 oracle stands open would be effort spent where it changes nothing. |
| §7.2, §15 | `JWT_EXPIRES_IN` a free string; cookie `maxAge: ms(env.JWT_EXPIRES_IN)` | `z.enum(['15m','1h','1d','7d','30d'])`, with a literal duration→milliseconds map in `token.service.ts` | `@types/jsonwebtoken` types `expiresIn` as `StringValue` — a template-literal union imported from `ms` — so a plain `string` does not compile, and no cast was permitted. The five literals are assignable to it. This also removes §7.2's `ms()` call, which named a package that appears nowhere in this document and exists in `node_modules` only as a transitive dependency of eslint and express; importing a transitive dependency directly breaks silently on a lockfile refresh. `.env` still reads `7d` exactly as §15 shows, a typo now fails at boot rather than at first login, and the token's lifetime and the cookie's `maxAge` are the same map entry so they cannot drift. Verified: payload `exp - iat` = 604800s and `Max-Age=604800`. |
| §7.6 | Rate limit on `/api/auth/*` | Applied to `/register` and `/login` only | §7.6's rule is broader than the reason it gives — "**Login** is the one endpoint where unlimited attempts are directly useful to an attacker". `/auth/me` is polled by the client on load and on window focus (§10.3, Step 12), so ten tab-switches inside the window would 429 a signed-in user; unless the client reads the envelope `code`, that is indistinguishable from being signed out and produces a false logout. `BUILD_PLAN`'s "11 rapid login attempts → 429" is satisfied either way. |
| §5, §6.2c | — | `app.set('trust proxy', 1)` in `app.ts` | `express-rate-limit` keys on `req.ip`, which behind Render's TLS-terminating proxy resolves to the proxy itself — one shared bucket of 10 requests per 15 minutes for every caller on the internet. The library only *logs* `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` for this, so it would have shipped silently. `1` rather than `true`: trusting the whole `X-Forwarded-For` chain lets any client forge it and escape the limit entirely, which the library flags as `ERR_ERL_PERMISSIVE_TRUST_PROXY`. **The hop count is an assumption until measured** — production adds a second proxy in front of Render, and whether Vercel's rewrite forwards the original client IP decides whether `1` or `2` is right. Confirm against the live chain before relying on the limiter. |
| §5 | `middleware/validate.ts` | Validates request **bodies** only | Express 5 exposes `req.query` through a getter with no setter, so the usual `req.query = parsed` shape throws at runtime. No route needs a query validator yet; Step 10's `?exclude=<id>` is the first that will, and it has to return the parsed value some other way rather than assigning it back. Recorded so that is not rediscovered by debugging. |
| §7.4, §11 | Password "min 8", no upper bound | `.max(72)` on register and login | bcrypt ignores input past 72 bytes, so two passwords sharing a 72-byte prefix would silently share a hash. The bound also stops a 10kb body (allowed by `express.json`) buying a cost-factor-12 hash on a single free-tier instance. **Honest limit:** zod's `.max(72)` counts characters, bcrypt truncates at 72 *bytes*, so multi-byte input can still truncate. Exact for ASCII, which is what the CPU bound is really for. |
| §7.1, §4 | Email stored as submitted | Trimmed and lowercased before validation | The `email` column is unique and login is an exact match, so without normalisation `Omer@x.com` and `omer@x.com` are two accounts, and signing in with the wrong case returns the deliberately-vague 401 with no way for the user to work out why. Order matters: the transforms run *before* the format check, via `z.string().trim().toLowerCase().pipe(z.email())`, so a pasted address with surrounding whitespace validates rather than failing. Two method calls; deletable if you disagree. |
| BUILD_PLAN §4 | `npm install` | `npm ci --include=dev` | Render sets `NODE_ENV=production`, under which npm **omits devDependencies** — so `tsc` and every `@types/*` package were absent and the build failed on each type import. This build compiles TypeScript on the server, so the *build* stage needs devDependencies even though the *runtime* does not; `--include=dev` overrides the `NODE_ENV` behaviour. `npm ci` additionally installs from the committed lockfile, which is what CI already does, so the deployed tree matches the reviewed one. Dashboard setting, not a committed file — the full command is: `npm ci --include=dev && npx prisma generate && npm run build && npx prisma migrate deploy`. |
| §5, §9.1 | The coin allowlist is referred to throughout but has no file in the §5 tree | `src/config/coins.ts`, ids only | Three steps need it — preferences validation (6), the batched upstream fetch (7), the onboarding multi-select (14) — so it cannot live inside `modules/preferences/` without Step 7's market module reaching across a feature boundary to fetch prices. **The design point:** a preferences row stores coin *ids* and copies no coin metadata. That same id is then the key in four places — the `assets` array, the `price:{coinId}` cache key, the CoinGecko `ids=` parameter, and `Feedback.itemRef` for the PRICES section (§4.3). One identifier, four uses. If a coin's display name changes, nothing stored changes. |
| §8, BUILD_PLAN §6 | "allowlisted coin ids" — the list itself never specified | 20 ids, curated from the top 60 by market cap rather than cut at the top 20 | **A product decision, not an omission.** The list exists to be picked from, so an asset the user does not recognise is one they will never select — recognisability serves the product where a leaderboard does not. Stablecoins are excluded because a dollar-pegged asset is a strange answer to "which assets interest you?" and its 24h-change column reads ~0.00% forever, spending a cache slot to teach nothing; gold-pegged tokens go for the same reason. Also excluded: tokenized real-world assets (`figure-heloc` at #9, BlackRock's BUIDL at #34), exchange tokens, and anything mid-rename (`the-open-network` currently renders as "Gram (prev. Toncoin)"). **The trade, named:** this drops `hyperliquid` (#10) and `zcash` (#14) while keeping `shiba-inu` (#35), which earns its place by giving the `FUN` content type something to show. A deliberate curation is defensible; an arbitrary rank cut that puts a tokenized home-equity product in a crypto picker is not. |
| §2 | — | Every id read from CoinGecko's `/coins/list` and `/coins/markets`, never written from memory | Three would have been guessed wrong: **`ripple`** is the id for XRP, not `xrp`; **`avalanche-2`** carries a numeric suffix from an id collision; **`hedera-hashgraph`**, not `hedera`. A wrong id is not an upstream error — it is simply absent from the response — so the mistake would not have surfaced here at all. It would have appeared at Step 7 as a coin missing from the prices section, debugged as a cache bug. Re-verify if the list is ever edited. |
| §12 item 4, §4.1 | `prisma.preference.upsert` alone | `$transaction` wrapping the upsert and a `user.updateMany` guarded on `onboardingCompletedAt: null` | The timestamp lives on `users` and the preferences data on `preferences`, so one PUT is two writes. Without the transaction a committed preferences row could pair with a user still flagged as not onboarded, gating them on the screen they just finished. The **`updateMany`** is not stylistic: `update` takes a unique `where` and cannot additionally require the column still be null, and without that guard every later edit would bump the timestamp — destroying the one thing §4.1 says it is for, time from signup to completion. Verified: two saves, one row, timestamp identical across both. This is the first place §3.3's "auth needs transactional integrity" argument is actually cashed in. |
| §6.1, §7 | `/api/auth/me → 200 { user }`; `auth.service.getUser` | `getSession`, returning `{ user, hasCompletedOnboarding }` as siblings | The flag describes the session's position in the flow, not the person, so it does not belong inside `user` — and `PublicUser` deliberately excludes `onboardingCompletedAt`. The alternative was a second query from the `/me` controller into the preferences service, on the endpoint the client hits on every load and every window focus. One read answers both questions. Renamed because a function returning a two-field envelope should not be called `getUser`. |
| §6.1 | `PUT { assets[], investorType, contentTypes[] }`; response shape unspecified | Deduped and bounded input; response `{ assets, investorType, contentTypes, updatedAt }` | Nothing specified duplicates or length, so `["bitcoin","bitcoin"]` would have rendered Bitcoin twice in the prices section and listed it twice in the insight prompt. Dedupe **preserves first occurrence**, because §8.1 makes `contentTypes` a ranking rather than a set — dropping the earlier copy would silently demote the user's top choice. Arrays are bounded by the allowlist length and the enum count rather than only by the 10kb body limit. The response omits `id`, which means nothing to the client, and `userId`, which is the caller's own. |
| §13 | One pull request per phase, merged at the end | `feat/auth` merged to `main` after Step 5, mid-phase; the branch continues and merges again after Step 6 | The Step 5 `trust proxy` hop count could only be verified against the deployed environment, and Render deploys from `main` only. Verifying it after Step 6 would have meant carrying an unverified rate limiter through a second step. The cost is a phase with two merges instead of one; the alternative was a longer window in which the limiter's production behaviour was assumed rather than known. |
| BUILD_PLAN §6 | Sized **S** — "1–3 files, a single focused concern" | Landed at **M** — five new files | §5's layer discipline sets a four-file floor for any endpoint pair — schema, service, controller, routes — before the shared allowlist makes five. The concern genuinely is single, so splitting the step would have been worse than letting it run long. Recorded rather than hidden by collapsing controller into routes, which would have bought the letter at the cost of the layering rule. **Worth applying to the remaining estimates:** any step introducing a new endpoint pair cannot be S. |
| §10.4 | — | **Open item for Step 14** | With the allowlist holding ids only, the onboarding multi-select has no display names, and §6.1 has no endpoint that serves the list — so the client would hardcode twenty names, duplication that can drift. The options then are to add `{ id, symbol, name }` to `config/coins.ts` plus a `GET /api/coins`, or to accept the copy under §10.4's existing hand-mirrored-types caveat. Named now so it is a decision at Step 14 rather than a discovery. |
| §9.1 | `Cache` with `get`, `set`, `getOrSet` | A fourth method, `getStale<T>(key): T \| undefined` | The three documented methods cannot express §9.2's headline behaviour for this phase — "CoinGecko 429/timeout, cache warm → serve last known values **past TTL**". Past TTL, `get` reports a miss and `getOrSet` propagates whatever the fetch threw; neither can return an expired entry, so the degraded path was unreachable through the documented interface. `getStale` reads the map ignoring `expiresAt`. The alternative — `get` returning `{ value, isStale }` — edits a documented signature and forces every caller to unwrap. **Honest note on the remaining three:** `getOrSet` has **no caller** as of Step 7, because prices needs get → miss → fetch → fall back to stale, which `getOrSet` also cannot express. Step 8's news service is its intended first caller; if it does not materialise there, the method should be deleted rather than kept as documented-but-unused. |
| §6.3, §6.4 | `unavailable` listed as a `status` value; `UPSTREAM_ERROR` / `UPSTREAM_RATE_LIMITED` defined at 502 | `unavailable` is returned **inside a 200**, and neither 502 code ever reaches a response body | §6.1 shows the endpoint returning 200 with a `status` field and §6.3 defines `unavailable` as one of its three values, so a total failure is a 200 carrying `coins: []`. §6.2a is the reason to keep it that way: sections fail independently, and a 502 puts the client into a generic error path instead of the actionable message §6.3 asks for. **The consequence, stated rather than hidden:** trace every upstream failure in Phases 3–4 and each one degrades inside a 200, so the two 502 codes have no path to the client. They are not dead — the provider throws them, the service's catch reads the code to choose between the rate-limited and the unreachable notice, and both are logged — but they do their work in mapping and logging rather than in an HTTP status. |
| §9.1 | "The binding constraint is CoinGecko's monthly cap, not its per-minute limit", given as what drove the 120s TTL | Claim kept; the arithmetic does not support it | 10,000 calls/month is ~333/day, or one call every ~260s. A 120s TTL under continuous polling is 720/day — more than twice the cap. The TTL therefore does **not** enforce the monthly limit. What keeps this project inside it is that the cache is demand-driven (an entry refreshes only when someone asks) plus the client's `staleTime` mirroring the server TTL from Step 15. The 120s figure is correctly derived from CoinGecko's own 1–5 minute data cadence — §9.1's *other* justification, and the one that holds. Recorded here rather than edited into §9.1 so the original claim and the correction sit side by side; a reviewer will do this division. |
| §8, §6.1 | Price DTO shape unspecified, while §8 requires "24h for `DAY_TRADER`, 30d for `HODLER`" | `price_change_percentage=24h,30d` requested at Step 7; DTO is `{ id, symbol, name, image, price, change24h, change30d }` | `/coins/markets` returns only the 24h window by default; the 30d one needs a query parameter and arrives under a different key, `price_change_percentage_30d_in_currency` — verified against the live API rather than written from memory, along with the fact that the plain `price_change_percentage_24h` stays present alongside it. Requesting it now costs one parameter and one field; discovering it at Step 15 costs a provider change at the point in the schedule with the least room for one. `image` is included on the same argument and is **deliberate, not speculative config**: it is free in the same response, and the alternative is that same provider change later, for a logo. `symbol` and `name` arrive free too; they narrow but do not settle the Step 14 open item above, because onboarding runs before any preferences row exists and so never calls this endpoint. `NFT_COLLECTOR`'s window remains unassigned — a Step 15 decision. |
| §5 | Tree lists `market/{prices.service.ts, news.service.ts}` with no controller or router for the module | Added `market.controller.ts` and `market.routes.ts` | The same gap as the deferred-`routes.ts` row above: §5's own layer discipline and `CLAUDE.md` §5 both require a route and a controller per endpoint, and the tree names neither for `market`, `insight` or `memes`. Named `market.*` rather than `prices.*` because §6.1 mounts `/news` on this same router at Step 8. |
| §9.1 | "Upstream volume scales with the number of distinct *coins*… Adding a user adds zero upstream traffic" | Holds except in one case, which is logged rather than coded around | The refetch triggers when any of the caller's coins has no fresh entry. If an allowlisted id ever stops being returned by CoinGecko — a rename, a delisting — that coin can never become fresh, so **every request from a user holding it calls upstream**, and the claim stops holding. Not defended in code: each id was read from CoinGecko's own endpoints (see the `ripple` / `avalanche-2` / `hedera-hashgraph` row above), and the condition logs a `warn` naming the missing ids every time it occurs, so the failure is loud rather than silent. The fix, if that line ever appears, is a single cached batch-timestamp key suppressing the refetch within the TTL; adding it now would be machinery for a condition that has not happened. |
| §9.1 | `get<T>(key)` and `getStale<T>(key)` — generics on the methods | Implemented exactly as documented, at the cost of the **only `as` in the server** | One cache holds values of many shapes, so the map stores `unknown` and the type parameter is the caller's assertion about what it put in; any faithful implementation of a method-generic interface needs that cast. The cast-free alternative is a per-instance generic — `class TtlCache<T>`, one instance per value type — which removes one cast in one file by changing a documented signature and multiplying cache instances. **A deliberate exception, not an oversight:** `CLAUDE.md` §4 bans `any` and uncommented `@ts-ignore`, and this is neither; the assertion is confined to two lines that no caller can widen, and every call site names the type it stored. Revisit if a second cast ever asks for the same excuse. |

*If this table is empty at the end of the project, that is itself worth noting — either the
design held, or it was not being checked.*

**With a larger team or a longer horizon,** this would be an Architecture Decision Record set
instead: one dated, immutable file per decision (`docs/adr/0001-postgres-over-document-store.md`),
appended rather than edited, with superseded decisions marked as such. That scales better than
a single evolving document, because it preserves *when* something was decided and what was
known at the time. A single record is the right size for a codebase this small.