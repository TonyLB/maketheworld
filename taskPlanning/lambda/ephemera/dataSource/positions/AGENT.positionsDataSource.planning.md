# Positions DataSource Planning (`mtw.ephemera.positions`)

**Status:** In progress. **Slice 0 shipped.** **Durable docs landed** (Phase 0 documentation). Next: **slice 1** --- `Character Navigate` cutover (implementation) after reviewing [`AGENT.concepts.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md) target vs shipped sections.

## Purpose

Track the initiative to grow `mtw.ephemera.positions` into ephemera's authority for **positions in play**, from slice 0 presence ingress through movement cutover and toward graph-shaped play state.

**Dispose this file** when the initiative completes. Steady-state truth lives in [`lambda/ephemera/dataSource/positions/`](../../../../../../lambda/ephemera/dataSource/positions/) siblings (not here).

## Durable documentation (read first)

| Doc | Role |
| --- | --- |
| [`positions/AGENT.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.md) | Package entry |
| [`positions/AGENT.concepts.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md) | Shipped vs **target** mental models; graduation rule |
| [`positions/AGENT.contract.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) | Normative rules **enforced today** |
| [`positions/AGENT.implementation.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md) | Slice 0 code map |
| [`positions/AGENT.navigation.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.navigation.md) | Cross-area links |

**Do not** duplicate concepts or contracts in this task plan --- link and track **graduation** (move text from concepts Target -> Shipped; add contract clauses when a slice ships).

## Getting started

1. [`taskPlanning/AGENT.md`](../../../../AGENT.md) --- durability ladder; task plan vs package docs
2. [`positions/AGENT.concepts.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md) --- ambition before coding
3. [`positions/AGENT.contract.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) --- what is binding now
4. [`lambda/ephemera/dataSource/AGENT.md`](../../../../../../lambda/ephemera/dataSource/AGENT.md) --- DataSource index

## Initiative scope (summary)

| In scope | Out of scope (separate tracks) |
| --- | --- |
| Character play position; movement cutover; graph-shaped play state over time | WML Position facet x/y overhaul ([`AGENT.positionSubsystemOverhaul.planning.md`](../../../../packages/mtw-wml/standardize/AGENT.positionSubsystemOverhaul.planning.md)) |
| Graduating concepts into contract as slices land | Area **authored** topology authoring UI (Workbench AreaEdit) |

Full boundaries: [`positions/AGENT.concepts.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md), [`positions/AGENT.navigation.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.navigation.md).

## Slice sequence (implementation)

| Slice | Goal | Doc graduation |
| --- | --- | --- |
| **0** (done) | `mtw.connections.characters` presence ingress | Contract + implementation + concepts Shipped section |
| **1** | `Character Navigate` -> positions; retire imperative `MoveCharacter` from actions | Extend contract; update implementation; note in concepts Shipped |
| **2** | Unify connect path; shared move core | Contract + implementation |
| **3** | Retire `disconnectMessage` / legacy `Disconnect Character` | Contract non-ownership; slim parent event docs |
| **4+** | Room play graphs, object placement, stream outbounds | Major concepts Target -> Shipped moves |

Open design questions for slice 1: listed in task plan history --- resolve in concepts or a short design note **before** implementation PR.

---

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. Mark nested lines `[X]` as each sub-step lands.

- [X] **Phase 0 --- document before further implementation**
  - [X] Create [`positions/AGENT.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.md) entry + sibling links
  - [X] Draft [`positions/AGENT.concepts.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md) (Shipped vs Target; graduation rule)
  - [X] Draft [`positions/AGENT.contract.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) (slice 0 only)
  - [X] Draft [`positions/AGENT.implementation.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md) + [`AGENT.navigation.md`](../../../../../../lambda/ephemera/dataSource/positions/AGENT.navigation.md)
  - [X] Slim this task plan to process + slices (link out architecture)
  - [X] Point parent [`dataSource/AGENT.md`](../../../../../../lambda/ephemera/dataSource/AGENT.md) and [`lambda/ephemera/AGENT.md`](../../../../../../lambda/ephemera/AGENT.md) at package docs

- [X] **Slice 0 --- presence ingress (code)**
  - [X] DataSource skeleton + `mtw.connections.characters` subscribe
  - [X] Disconnect handler + connect bridge
  - [X] Unit tests

- [ ] **Slice 1 --- player movement cutover**
  - [ ] Resolve slice 1 open questions (record in concepts or contract draft PR notes)
  - [ ] Subscribe positions to `Character Navigate`
  - [ ] Extract move execution core; parity with `moveCharacter`
  - [ ] Remove imperative `MoveCharacter` from actions
  - [ ] Update contract + implementation + concepts (graduate shipped model)
  - [ ] Parity tests (actions + moveCharacter baselines)

- [ ] **Slice 2 --- connect unify + move core**
  - [ ] Unify connect with positions-owned move (or document retained bridge)
  - [ ] Graduate contract/concepts as needed

- [ ] **Slice 3 --- legacy disconnect retirement**
  - [ ] Remove `disconnectMessage` overlap; retire `Disconnect Character` ingress
  - [ ] Integration test for positions receive path

- [ ] **Close initiative**
  - [ ] Run verification matrix
  - [ ] Slim bridge notes in [`actions/AGENT.md`](../../../../../../lambda/ephemera/dataSource/actions/AGENT.md)
  - [ ] Delete this planning file

---

## Verification

From repo root:

```bash
npm --prefix lambda/ephemera run test -- --watchAll=false \
  dataSource/positions/ \
  dataSource/actions/index.test.ts \
  moveCharacter/index.test.ts
```

**Slice 1 gate:** add navigate -> positions tests; confirm actions tests pass without imperative `MoveCharacter`.

---

## Progress

| Milestone | Status |
| --- | --- |
| Slice 0 code | Done |
| Phase 0 durable docs (`positions/AGENT.*.md`) | Done |
| Slice 1: navigate cutover | Not started |
| Slice 2--3: unify + legacy retirement | Not started |
| Initiative close (delete this file) | Not started |
