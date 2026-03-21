*Status: ACTIVE PLANNING - editable messages, revisions, and derived presentation. Details of history vs index vs UI storage TBD.*

## Purpose

This document captures **high-level requirements and direction** for evolving the `messages` slice so the client can treat the transcript as **logically editable**: the same **`MessageId`** may receive **multiple revisions** over time (user typo fixes, LLM placeholder then final text, etc.), while the UI shows **one row per logical message** with **latest content** unless we intentionally surface history.

Implementation details (exact Redux shape, selector APIs, IndexedDB schema migrations) are **not** fixed here; we will refine those after agreeing on the **three-way split** below.

**Non-goals for this document**

- Replace server-side **`conversationId`** or orchestration; see `lambda/ephemera/conversations/AGENT.planning.md`. **`MessageId`** is a **row / revision chain** handle in the transcript, not a process id.
- Specify server publish or delta formats (only **client consumption** assumptions).

## Problem

1. **Room headers** can feel "live-updated" because the UI overwrites the header **slot** when new content arrives. **Narrative / description lines** in the main message stream do not have that slot behavior by default.
2. Today, `receiveMessages` + `binarySearch` effectively treat a **match** as same **`CreatedTime`** and **`MessageId`**. A revision with the **same `MessageId`** and a **new** `CreatedTime` can be inserted as a **second** row instead of replacing the first in Redux (see `index.ts` + `binarySearch.ts`).
3. Product needs: **"Generating..." then final**, **edit own message after send**, and other **same-id revisions** should **not** multiply bubbles unless we want an audit trail in the UI.

## Requirements (high level)

1. **Preserve an authoritative message history** suitable for sync and debugging: every inbound revision can be retained (policy TBD: full log vs compact old revisions).
2. **Support logical overwrite in presentation**: for a given **`MessageId`** (per `Target`), the default rendered transcript shows **one** entry whose **body** reflects **latest** revision (rule TBD: by `CreatedTime`, server revision number, etc.).
3. **Stable position in the stream**: when content updates, the row should stay where the **first** revision appeared (unless we explicitly choose "move to end" for some message types).
4. **Efficient updates**: ingesting a new revision should **not** require a full O(n) rescan of all messages on every packet; maintain **incremental** structures where practical.
5. **Compatibility path**: existing flows that truly introduce a **new** `MessageId` continue to behave as new lines; only **same-id** payloads participate in revision semantics.

## Overall plan: three conceptual layers

We expect to separate concerns into **three** interacting pieces. Exact naming and storage split is **TBD**.

### 1. History storage (underlying / time-sorted)

- **Role**: Ordered record of messages **as merged from sync and live receipt**, including **multiple** rows sharing the same **`MessageId`** when the server sends revisions. Sorted by **`CreatedTime`** (with tie-break as today), so **late** deltas can insert **in the middle** of the array — history is **not** strictly append-only at the tail.
- **Mental model**: global **chronological** log per `Target`, not "one object per MessageId."
- **Current code** today **is** this shape in Redux (`Message[]` sorted by `CreatedTime`): a revision with the **same `MessageId`** and a **new `CreatedTime`** is already **inserted** as another row (see `receiveMessages` + `binarySearch` — **replace** only when **both** time and id match). That **is** the **history** we build on: multiple rows per `MessageId` are **allowed** and **desired** in the log. What **changes** is not the core insert/replace rule for history, but **adding** per-`MessageId` aggregates and a **presentation** layer so the UI does **not** show one bubble per revision by default. A second message with the **same** `(CreatedTime, MessageId)` remains **pathological**; **idempotent replace** at that slot is still the right behavior.
- **Why keep it**: authoritative **audit**, future features (revision history UI), sync/debug — even when the **default** render path rarely scans the full log.

### 2. Index / aggregates (per `MessageId`, not raw indices)

- **Why not store array indices into `history`**: indices are **unstable**. Any mid-array insert (out-of-order `CreatedTime`) shifts later slots; cached integers would need wholesale invalidation. **Do not** key off raw indices for anything long-lived.
- **Stable row identity** (for "find this revision again" when needed): **`(CreatedTime, MessageId)`** — locate the row with **binary search** on the sorted history array (same order key as today). Duplicate pairs should be **vanishingly rare** if `CreatedTime` uses **millisecond** (or finer) precision; **second-level** timestamps are **not** adequate and would collide often. Deliberate uniqueness (extra delta ids, revision counters) is **optional defense in depth** — likely **overkill** until we see real collisions or multi-writer races.
- **Ruthlessly efficient default (hot path)**: per `MessageId`, maintain **`earliestCreatedTime`** and **`latestCreatedTime`** only, updated on each insert by comparing the new row to current bounds (**O(1)** for that id). **Presentation** (below) holds the **latest body** for the line; it is updated when the incoming row becomes the new **latest** (compare `CreatedTime` to `latestCreatedTime`), or when bounds change **earliest** (rare, affects sort position). No need to scan all revisions for typical UI.
- **Heavier option (only if needed)**: a list of **stable keys** `(CreatedTime, MessageId)` per id to walk **all** revisions without scanning full history — only if we build "show edit history" or similar.

### 3. Presentation storage (derived "what we render")

- **Role**: Materialized view consumed by UI: ordered list of **logical** messages (one per `MessageId` for default transcript), each holding **current** body (latest revision) and a **display sort key** (typically **`earliestCreatedTime`** for stable position in the stream).
- **Derivation**: computed from history + per-`MessageId` aggregates (Redux selector with memoization, or maintained slice updated incrementally — **TBD**).
- **This layer** enforces "latest wins" and stable ordering rules without forcing the raw history reducer to pretend each `MessageId` is unique.

## Interaction sketch (refinement later)

- **Ingest**: insert into history (mid-array if needed) -> update **earliest/latest** times for that `MessageId` -> update **presentation** body when the new row is the new **latest** (or adjust **earliest** / sort position when needed).
- **Read path for UI**: components subscribe to **presentation** (or selectors built on it), not necessarily raw history.

### Persistence (`cacheDB` / IndexedDB)

- **Recommendation**: keep storing the **verbatim** message log **as we do today** (same shape as what goes into Redux `history`). That remains the **source of truth** on disk.
- **Implication**: **per-`MessageId` aggregates** and **presentation** are **derived**; after a cold load they must be **reconstructed** from the log (or left empty and filled as messages are replayed). If startup **replays** rows from `cacheDB` through the **same** ingest path / reducer we use for live WebSocket messages, aggregates and presentation **rebuild for free** alongside `history` — no separate "recompute index from log" pass unless we optimize later.
- **Confirmed** (`charcoal-client/src/cacheDB/index.ts`): the `messages` store is **`MessageId` as primary key** (Dexie: first field in `'MessageId,CreatedTime,Target'`), with **`CreatedTime`** and **`Target`** as secondary indexes — **not** `MessageId::Timestamp`. So IndexedDB currently holds **at most one row per `MessageId`**; a revision with the same id and a new `CreatedTime` **overwrites** the prior row on `bulkPut`. Storing a **verbatim multi-revision** log **requires** a schema change (e.g. compound primary key `MessageId` + `CreatedTime`, or a synthetic delta id), plus migration from v1.

## Relationship to server concepts

- **`MessageId` (`MESSAGE#...`)**: identifies a **logical line** in the transcript; revisions reuse it. Safe to **store on** server-side conversation records as **one field** among many ("placeholder message id for description").
- **`conversationId`** (Ephemera): identifies the **coordinated operation**; do not collapse into `MessageId`.

## References

- `charcoal-client/src/slices/messages/AGENT.editable.planning.tasklist.md` - ordered implementation tasks (Dexie first, then aggregates, presentation, UI).
- `charcoal-client/src/slices/messages/AGENT.md` - current architecture, `receiveMessages`, cache.
- `charcoal-client/src/slices/messages/index.ts` - reducer and `receiveMessages`.
- `charcoal-client/src/slices/messages/binarySearch.ts` - current insert/replace logic.
- `lambda/ephemera/conversations/AGENT.planning.md` - server-side conversations registry (orthogonal but complementary).
