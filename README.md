# Crypto Advisor Dashboard

A personalized crypto investor dashboard — onboarding quiz, preference-driven daily content,
feedback capture.

Two independent applications in one repository:

| Directory | What it is |
|---|---|
| `server/` | Node.js + Express + TypeScript API |
| `client/` | React + TypeScript + Vite SPA |

Each has its own `package.json` and is installed and run separately. This is deliberately not
an npm workspace — see `docs/ARCHITECTURE.md` §10.4.

## Local setup

Node ≥20 (`.nvmrc` pins 20).

```
cd server && npm install && npm run dev
cd client && npm install && npm run dev
```

## Documentation

- `docs/ARCHITECTURE.md` — the design record: requirements, decisions, and why each was made
- `CLAUDE.md` — working conventions for this repository

Full setup instructions, the live URL, architecture summary and known limitations are written
in Step 17 of the build.
