# How this project was built with AI assistance

I used AI throughout, as an implementer working to a specification I wrote and verified — not as an
autocomplete. This summary was written with AI too, and deliberately so: the sessions hold the
fullest record of what was proposed, what I rejected, and why. I directed and edited it, and it
would have been a strange document to write any other way.

## The setup

Before any code existed I wrote three documents: an architecture specification, a set of coding
conventions and hard rules, and a build plan of numbered steps. Everything the AI produced was
implemented against those.

The most useful rule I set was that **the AI could not edit the specification.** When it found an
error, a contradiction or a gap — and it found several — it had to report it and stop. A
specification the implementer can rewrite is not a constraint, and a document that always agrees
with the code has stopped carrying information. Corrections went into a deviations table I
maintained, which now records every place the design was wrong, what was built instead, and why.

## The loop

I separated the work into two roles and used different agents for each.

**Planning and review** — Claude and Gemini in a chat interface. I used these to pressure-test
architecture decisions, argue through trade-offs, and write the brief for each phase before any
code was written. Nothing here touched the repository.

**Implementation** — Claude Code, working in the project directory. It received the phase brief and
the three specification documents, and never saw the conversation where the trade-offs were argued
out. The thing reviewing a decision wasn't the thing that had just made it.

Per step: it proposed the files it would touch and any decision the specification didn't settle. I
answered or pushed back. It implemented that step only, then handed back exact commands and exact
expected output. **I ran them myself** — reading database rows, watching requests in devtools —
rather than reading the code and trusting it. That was slower, and it's the reason I can explain
any part of this codebase rather than point at it.

## Three examples

**A cache that would not have scaled.** The price cache was originally keyed by each user's
selected assets. It worked and it passed its checks. I questioned whether the cache lifetime was
too aggressive, and working through that surfaced the real problem: keyed that way, upstream API
calls scale with the number of distinct watchlists — so with the number of users — against a free
tier of roughly 333 calls a day. It's now keyed per coin, one batched request fills every entry,
and I confirmed in the logs that a second user with a different watchlist cost zero additional
calls.

**A timeout set from assumption, corrected by measurement.** The AI proposed a 10-second timeout
on the AI provider, matching the data providers. Then I watched a real request abort at 10,014ms.
Rather than accept that as the expected failure path, I raised it to 20 seconds — a free model on
a cold start is genuinely slow, and a timeout that fires on ordinary behaviour isn't a safety
limit.

**A gap between two documents that were each correct.** The feedback endpoint was specified to
return votes aggregated by section and direction. The dashboard was specified to show a vote
button in its already-voted state. Both were internally consistent, and neither could serve the
other, because the aggregation discards which item was voted on. I caught it while reading the
implementation proposal rather than when the dashboard needed it. Every real defect in this build
came from that pattern — two things each specified correctly, never read side by side.

## Where it was better than me, and where it wasn't

It was better at the things that are invisible from the source: a border colour arriving from a
framework's defaults that appears in no file of mine, and a date-formatting bug that renders the
previous day for every reader behind UTC — invisible from where I sit, wrong in California.

It was worse at anything requiring judgement about the result. Its design brief proposed a serif
face for the AI insight; the argument was good and the page looked wrong, so it came out. Three
other changes in that session came from opening a browser rather than reading code.

It wrote most of the lines. The system design, the architecture, the review of what came back, the
decisions and the rejections, and every check that something actually worked were mine.
