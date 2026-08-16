# Membership-host kernel: teaching storage about Object, Feature, and Area hosts

**Status: MK0 landed 2026-08-16 (grounding only, no code). Blocked on nothing upstream, blocks nothing downstream yet --- the gap fails loud, not silently.** Next step is [MK1](#recommended-order): resolve MD-1 --- one plain shared shape for Character/Object/Feature/Area, Room layered on top as the documented exception, per MK0's findings below.

**This is an implementation plan** ([`taskPlanning/AGENT.md`](../../../../AGENT.md)), not the design-stage variant --- there is exactly one open fork blocking the slices below, not a phase of open questions outnumbering steps, and the evidence needed is a close read of existing code, not a built corpus.

## Why this plan exists

[LP0](AGENT.ludicGraphPorts.planning.md#recommended-order) widened `EphemeraMembershipHostId` (`Room | Character | Object | Feature | Area`) so that grounding, guards, and Dynamo key templates admit all five kinds as membership hosts. It **deliberately did not** teach the two places that actually read and write a host's stored membership graph about the three new kinds --- that was flagged as a `KNOWN GAP` and left throwing, on the user's explicit call (2026-08-16): *"leave it throwing, document it... treat teaching the kernel/cache about Object/Feature storage as a gap owned by a later slice rather than blocking this one."* This plan is that later slice.

**The two sites, both still Room/Character-only:**

- [`hostDataCategory`/`graphFromMeta`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/index.ts) --- dispatches `isEphemeraRoomId(hostId) ? 'Meta::Room' : 'Meta::Character'` when reading/writing a host's `Meta::*` record via `MultiKeyUpdate`. An Object-, Feature-, or Area-hosted `transferMembership`/`establishRelation` step now grounds and type-checks, then throws at commit: `MultiKeyUpdate fetch missing footprint host`.
- [`assertForwardHostId`](../../../../../lambda/ephemera/internalCache/ludicGraphCache.ts) --- the play-position cache gateway, which only accepts `EphemeraRoomId | EphemeraCharacterId` and throws `Positions cache requires forward host ROOM# or CHARACTER#` for anything else.

Both carry a `KNOWN GAP (LP0, 2026-08-16)` comment pointing back to LP0; once this plan exists, those comments should point here instead (see [MK6](#recommended-order)).

**What is loud, not silent, and why that matters for sequencing.** Nothing is currently mis-stored --- the throw happens before any write. That means this plan is not blocking anything shipped today; it can be sequenced on its own schedule rather than being an incident to clear.

## Getting Started

1. **Read the framework once:** [`taskPlanning/AGENT.md`](../../../../AGENT.md) for durability and content split.
2. **Command authority is [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md).** If any command here conflicts with it, follow that file.
3. **Runner and context.** `lambda/ephemera` is Jest-based, `npm run test` (not `npm test`), from the package root:
   ```bash
   cd lambda/ephemera && npm run test -- --watchAll=false dataSource/positions/ludicGraph/
   ```
4. **Baseline before editing** --- should pass unchanged:
   ```bash
   cd lambda/ephemera && npm run test -- --watchAll=false dataSource/positions/ludicGraph/ internalCache/ludicGraphCache
   ```
5. **`npx tsc --noEmit` is not sufficient** --- `lambda/ephemera`'s `*.integration.test.ts` files sit outside `tsconfig`. Run the real suite before calling a slice done.
6. **Read the code this changes before changing it:** [`ludicGraph/AGENT.md`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/AGENT.md), then `fromRoomMeta`/`fromCharacterMeta`/`hostDataCategory`/`graphFromMeta` in [`ludicGraph/index.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/index.ts), then [`ludicGraphCache.ts`](../../../../../lambda/ephemera/internalCache/ludicGraphCache.ts) end to end (it is short).
7. **Read LP0's own record of this gap** ([the bullet](AGENT.ludicGraphPorts.planning.md#recommended-order) under LP0, dated 2026-08-16) --- it names the exact throw messages and call sites, no need to re-derive them.

## Open decisions (implementation --- plan only)

| # | Decision | Blocks | Options | Recommendation |
| --- | --- | --- | --- | --- |
| **MD-1** | Does each host kind get a bespoke `Meta::<Type>`/cache-envelope implementation (following the existing Room/Character precedent, which already diverge from each other), or is there enough shared shape across Object/Feature/Area/Room/Character to justify one generic membership-host **serde interface** that all five satisfy? | MK2--MK5 (every per-type storage slice) | (a) Bespoke per type, unified only by a shared **interface** (method signatures each type implements) with independent bodies; (b) one generic serde engine parameterized over host kind, with per-type differences expressed as config/data rather than code; (c) one shared plain implementation for the host kinds with no reconstruction source, plus Room as a documented special case built on top of it, rather than N-bespoke or one-fits-all | **Leaning (c), grounded in MK0 --- still Open, not locked.** `fromCharacterMeta` is a plain `record.ludicGraph ?? { nodes: [], edges: [] }` read with no fallback; `fromRoomMeta`'s `seedFromActiveCharacters` fallback is the only host-side irregularity found, and it is Room-specific. Object/Feature/Area have no connect/disconnect lifecycle and so no obvious second data source to reconstruct from --- they should be as plain as Character. **One plain shared shape for Character/Object/Feature/Area, Room layered on top as the documented exception**, not five bespoke branches and not one engine forced to also swallow Room's fallback |

## Recommended order

Pending work uses `- [ ]` and completed work uses `- [X]`; nested bullets carry their own boxes.

- [X] **MK0. Ground the Open Decision --- read the shipped Room/Character storage code and record what's essential versus incidental about its shape.** **Findings, 2026-08-16:**
  - **Confirmed: `fromCharacterMeta` is plain.** `record.ludicGraph ?? { nodes: [], edges: [] }` --- a direct read with a trivial empty default, no reconstruction from any second source. As a **host**, Character is regular, not irregular.
  - **Confirmed: `fromRoomMeta`'s `seedFromActiveCharacters` fallback is the one host-side irregularity that exists**, and it is Room-specific --- reconstructs the graph itself from `Meta::Room.activeCharacters` when `ludicGraph` is absent.
  - **A real independent tracking mechanism for Characters was found and then ruled out of scope.** `Meta::Character.RoomStack` (resolved in [`resolveCharacterRoomId.ts`](../../../../../lambda/ephemera/dataSource/positions/membership/resolveCharacterRoomId.ts)) answers *where is this character contained* --- play membership via `ludicGraph` adjacency when connected, the trimmed eviction ladder when not --- which is **Character-as-member of a Room**, a different question from **Character-as-host of its own `ludicGraph`**. `resolveCharacterRoomId` never reads or writes `Meta::Character.ludicGraph`, `hostDataCategory`, or `graphFromMeta`. It is real, but it is orthogonal to this plan.
  - **Conclusion carried to MD-1:** among the five host kinds, only Room has a second data source its graph can be reconstructed from. Character, and presumably Object/Feature/Area (none of which have a connect/disconnect lifecycle at all), have no such source and should share one plain shape.
- [ ] **MK1. Resolve MD-1**, using MK0's findings. Record the verdict on the row (do not remove it silently --- this decision is exactly the kind of thing this plan exists to make discussable before being built).
- [ ] **MK2. Object-hosted storage.** `Meta::Object` record shape for a hosted `ludicGraph`, plus the `hostDataCategory`/`graphFromMeta` branch and cache-gateway support. Shape follows MK1's verdict.
- [ ] **MK3. Feature-hosted storage.** Same, for `Meta::Feature`.
- [ ] **MK4. Area-hosted storage.** Same, for `Meta::Area`. Area has no existing `Meta::Area` record of any kind yet (unlike Object/Feature, which already have Meta records for other purposes) --- check whether this slice also needs to establish that record's baseline shape, or whether it already exists for other reasons.
- [ ] **MK5. Widen `assertForwardHostId`** (or replace it with whatever MK1 decided) so the play-position cache gateway accepts all five host kinds, not just Room/Character.
- [ ] **MK6. Retire the two `KNOWN GAP (LP0, 2026-08-16)` comments**, replacing them with either normal doc comments (if fully closed) or an updated gap note pointing at whichever sub-slice remains (if partially closed). Update LP0's own bullet in [`AGENT.ludicGraphPorts.planning.md`](AGENT.ludicGraphPorts.planning.md) to link here instead of describing the gap inline.
- [ ] **MK7. Update this document's checkboxes, Progress, and Verification** as the last step, after tests pass.

## Verification

Per-slice, from `lambda/ephemera` unless stated:

```bash
cd lambda/ephemera && npm run test -- --watchAll=false dataSource/positions/ludicGraph/ internalCache/ludicGraphCache
cd lambda/ephemera && npm run test -- --watchAll=false dataSource/positions/
```

Full suite before calling any slice done (integration tests sit outside `tsconfig`, so `tsc --noEmit` is not sufficient):

```bash
cd lambda/ephemera && npm run test -- --watchAll=false
```

## Progress

| Slice | Status | Next |
| --- | --- | --- |
| **MK0** (grounding) | **Done 2026-08-16.** Character-as-host is plain; Room's `activeCharacters` fallback is the lone irregularity; `RoomStack` is real but out of scope (Character-as-member, not host) | --- |
| **MK1** (decide MD-1) | Not started | Lock the shared-plain-shape-plus-Room-exception verdict, or find a reason to depart from it |
| **MK2--MK5** (per-type storage + cache) | Not started, blocked on MK1 | --- |
| **MK6--MK7** (cleanup + governance) | Not started | --- |
