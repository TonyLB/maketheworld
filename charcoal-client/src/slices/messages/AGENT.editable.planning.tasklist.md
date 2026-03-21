*Status: DRAFT TASK LIST - refine as we implement. Full design: `AGENT.editable.planning.md`.*

## How to use this file

- Tasks are **ordered for dependency risk**: **Dexie first** — it has **no** upstream dependency on Redux aggregates or presentation, and unblocks a **verbatim** local log that matches server `message_delta` semantics (`DeltaId`-style uniqueness per revision).
- Mark items done by checking boxes or moving completed work to a **Done** section.

---

## 1. Dexie / `cacheDB.messages` schema (do first)

- [ ] Choose primary key for multi-revision rows: e.g. **compound** `[MessageId+CreatedTime]` or **synthetic** `deltaKey` mirroring server `${CreatedTime}::${MessageId}` (aligns with `lambda/ephemera/publishMessage` / Dynamo).
- [ ] Add Dexie **version bump** + **migration** from v1 (single `MessageId` PK): copy or drop legacy rows per product decision.
- [ ] Preserve **indexed access** for rehydration: today `where("Target").equals(characterId)` in `activeCharacters/index.api.ts` — keep **`Target`** (or equivalent) indexable so load remains "bucket for character, then replay."
- [ ] Update **`cacheMessages`** / **`bulkPut`** call sites to write rows compatible with the new PK (no silent overwrite of prior revision).
- [ ] **Tests** or manual checklist for migration + `where("Target")` load path.

---

## 2. Redux history + per-`MessageId` aggregates (indexes)

- [ ] Add state for **`earliestCreatedTime` / `latestCreatedTime`** (or equivalent) per `MessageId` per `Target` — shape TBD (nested maps vs normalized store).
- [ ] Extend **ingest** (`receiveMessages` or dedicated handler): after each message applied to sorted `history`, **update aggregates** for touched `MessageId` (**O(1)** compare to bounds).
- [ ] Handle **idempotent** duplicate `(CreatedTime, MessageId)` if it ever arrives (replace in history; aggregates unchanged unless content semantics require it).
- [ ] Unit tests for aggregate updates across insert / mid-array insert / same-id revision.

---

## 3. Presentation storage (parallel derived view)

- [ ] Add **presentation** slice or selector-only materialization: one logical row per `MessageId` with **latest body** + **display sort key** (`earliestCreatedTime`).
- [ ] Derive updates from ingest + aggregates (incremental preferred; full memoized reduce acceptable for v1 prototype).
- [ ] Tests: two revisions same `MessageId` -> **one** presentation row with latest content; sort position stable when only latest changes.

---

## 4. Cold load / rehydration

- [ ] On character activation, load from `cacheDB` as today (**by `Target`**), then **replay** messages through the **same** ingest path used for WebSocket so **history + aggregates + presentation** rebuild together.
- [ ] Confirm **server sync** path still merges into the same pipeline (no duplicate logic).

---

## 5. Redirect UI to presentation

- [ ] Identify selectors / components that currently read **raw** `Message[]` for the main transcript; switch default path to **presentation** (or selectors built on it).
- [ ] Keep escape hatches for **debug / audit** views that may still read full **history** (optional).

---

## 6. Polish and follow-ups

- [ ] Update `AGENT.md` cross-links when behavior stabilizes.
- [ ] Optional: revision-history UI (needs heavier index of all `(CreatedTime, MessageId)` per id) — **defer** until product asks.

---

## References

- `charcoal-client/src/slices/messages/AGENT.editable.planning.md` - requirements and three-layer model.
- `charcoal-client/src/cacheDB/index.ts` - current v1 schema.
- `charcoal-client/src/slices/activeCharacters/index.api.ts` - `cacheDB.messages.where("Target")` load path.
