*Status: DRAFT TASK LIST - refine as we implement. Full design: `AGENT.editable.planning.md`.*

## How to use this file

- Tasks are **ordered for dependency risk**: **Dexie first** — it has **no** upstream dependency on Redux aggregates or presentation, and unblocks a **verbatim** local log that matches server `message_delta` semantics (`DeltaId`-style uniqueness per revision).
- Mark items done by checking boxes or moving completed work to a **Done** section.

---

## 1. Dexie / `cacheDB.messages` schema (do first)

**Easy path (implemented):** Dexie **v2** uses synthetic PK **`deltaPk`** = ``${CreatedTime}::${MessageId}`` with indexes **`Target`**, **`MessageId`**, **`CreatedTime`**. There is **no** staging migration: upgrading from v1 **drops** existing `messages` rows (same effect as clearing that store); the app **re-fetches** from the server / WebSocket. If an upgrade error appears in dev, delete IndexedDB **`maketheworlddb`** once. `clientSettings` and `characterSync` are unchanged.

- [x] Choose primary key for multi-revision rows: e.g. **compound** `[MessageId+CreatedTime]` or **synthetic** `deltaKey` mirroring server `${CreatedTime}::${MessageId}` (aligns with `lambda/ephemera/publishMessage` / Dynamo).
- [x] Add Dexie **version bump** + **migration** from v1 (single `MessageId` PK): copy or drop legacy rows per product decision.
- [x] Preserve **indexed access** for rehydration: today `where("Target").equals(characterId)` in `activeCharacters/index.api.ts` — keep **`Target`** (or equivalent) indexable so load remains "bucket for character, then replay."
- [x] Update **`cacheMessages`** / **`bulkPut`** call sites to write rows compatible with the new PK (no silent overwrite of prior revision).
- [x] **Tests** or manual checklist for migration + `where("Target")` load path.

---

## 2. Redux history + per-`MessageId` aggregates (indexes)

**Implemented:** The `messages` slice holds **`history`** plus **`aggregates`**: `Record<Target, Record<MessageId, { earliestCreatedTime, latestCreatedTime }>>`. `receiveMessages` updates bounds on **new** inserts only (`mergeMessageIdAggregate`); **`exactMatch`** replaces the row and leaves aggregates unchanged. Tests live in `index.test.ts` (second revision, out-of-order same id, idempotent replace).

- [x] Add state for **`earliestCreatedTime` / `latestCreatedTime`** (or equivalent) per `MessageId` per `Target` — shape TBD (nested maps vs normalized store).
- [x] Extend **ingest** (`receiveMessages` or dedicated handler): after each message applied to sorted `history`, **update aggregates** for touched `MessageId` (**O(1)** compare to bounds).
- [x] Handle **idempotent** duplicate `(CreatedTime, MessageId)` if it ever arrives (replace in history; aggregates unchanged unless content semantics require it).
- [x] Unit tests for aggregate updates across insert / mid-array insert / same-id revision.

---

## 3. Presentation storage (parallel derived view)

**Implemented:** `presentation` branch plus ingest-time updates and tests (`index.test.ts`). Redirecting the main transcript UI to `presentation` remains section 5.

**Decision:** See **`AGENT.editable.planning.md` section 3 ("Decision")** — we are implementing **`presentation` as Redux state** (same `Message[]`-per-`Target` shape as `history`, collapsed to one row per `MessageId`, updated in `receiveMessages`), not selector-only derivation. Step 5 will switch `getMessagesByRoom` (etc.) to read from **`presentation`** instead of **`history`**.

- [x] Add **`presentation`** in the `messages` slice (parallel to `history`): one logical row per `MessageId` with **latest body** + stable order by **`earliestCreatedTime`** / first-seen (per planning doc).
- [x] Derive updates from ingest + aggregates (incremental preferred; full memoized reduce acceptable for v1 prototype).
- [x] Tests: two revisions same `MessageId` -> **one** presentation row with latest content; sort position stable when only latest changes.

---

## 4. Cold load / rehydration

**Implemented:** `fetchAction` in `activeCharacters/index.api.ts` dispatches **`receiveMessages`** after loading from `cacheDB` (same reducer as live traffic). Server deltas arrive via WebSocket **`cacheMessages`** -> **`receiveMessages`** (`lifeLine/index.api.ts`). No separate rebuild pass.

- [x] On character activation, load from `cacheDB` as today (**by `Target`**), then **replay** messages through the **same** ingest path used for WebSocket so **history + aggregates + presentation** rebuild together.
- [x] Confirm **server sync** path still merges into the same pipeline (no duplicate logic).

---

## 5. Redirect UI to presentation

**Implemented:** `getMessagesByRoom` and `getRecentlyVisited` use `getPresentation` in [`selectors.ts`](selectors.ts). `getMessages` remains the `history` selector. [`ThreadView.js`](../../components/Threads/ThreadView.js) imports `getPresentation` for future thread UI.

- [x] Identify selectors / components that currently read **raw** `Message[]` for the main transcript; switch default path to **presentation** (or selectors built on it).
- [x] Keep escape hatches for **debug / audit** views that may still read full **history** (optional).

---

## 6. Polish and follow-ups

- [ ] Update `AGENT.md` cross-links when behavior stabilizes.
- [ ] Optional: revision-history UI (needs heavier index of all `(CreatedTime, MessageId)` per id) — **defer** until product asks.

---

## References

- `charcoal-client/src/slices/messages/AGENT.editable.planning.md` - requirements and three-layer model.
- `charcoal-client/src/cacheDB/index.ts` - current v1 schema.
- `charcoal-client/src/slices/activeCharacters/index.api.ts` - `cacheDB.messages.where("Target")` load path.
