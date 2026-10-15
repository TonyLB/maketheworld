# WML relational edges: a written form for every edge kind

**Status: opened 2026-10-15, not started. Next step: [Slice 0](#recommended-order), then [OD-1](#open-decisions-implementation--plan-only)--[OD-3](#open-decisions-implementation--plan-only).** An implementation plan, per [`taskPlanning/AGENT.md`](../../../AGENT.md). It expects to grow a lot of open decisions as the work is dug into; the ones below are the ones visible on day one.

## Goal

Give WML text a way to write **relational edges**: every `LudicEdgeKind` other than `Navigation`, which already has `<Exit>`. First on the **wire** (ephemera's deliveries to the client), then for **authoring**.

**Why now: the wire loses edges, silently.** Every delivery is WML text: the server builds a `StandardForm` and prints it with `schemaToWML` (for example [`objectRenderWmlFromCacheRecord.ts`](../../../../lambda/ephemera/dataSource/perception/objectRenderWmlFromCacheRecord.ts)). The graph handed to it carries relational edges (`toWireLudicGraphFull` in [`wireProjection.ts`](../../../../lambda/ephemera/dataSource/positions/ludicGraph/wireProjection.ts) maps them), but `StandardLudicRelationalEdge.schemaNode()` returns `undefined` ([`ludicEdge.ts`](../../../../packages/mtw-wml/ts/standardize/keys/edges/ludicEdge.ts)), so they are dropped at print, with no error. What survives:

- **Membership**, because membership is the node list ([primer section 1, clause 2](../../../../lambda/ephemera/dataSource/positions/AGENT.ludicNetwork.md)), printed as nested references.
- **`Navigation`**, as `<Exit>`.

What is lost: every `Custom` edge, and every **hosting kind**. `Cup -On-> Tray` is an edge, not a node, so the client cannot tell a cup on a tray from a cup in it. Ports and presence nodes are not printed either. Each new kind widens the hole; [`ConnectedTo`](../../../lambda/ephemera/dataSource/positions/AGENT.connectedTo.planning.md) is the next one.

**Why for authoring too:** all authoring goes through WML, and authors will need to state relations nesting cannot (a lamp under a table, a rope's two ends).

**Payoff, stated at the observable output:** ephemera delivers a room in which a cup is `On` a tray and a lamp is `Custom('under')` a table. The client parses the delivered WML text and its `StandardForm` holds both edges, kind and label intact. Then (Slice 5) one client surface shows something it could not show before.

## Getting Started

1. **Read [`taskPlanning/AGENT.md`](../../../AGENT.md)** once, for how implementation plans work.
2. **Read [primer section 6, *Lifting a shape into WML*](../../../../lambda/ephemera/dataSource/positions/AGENT.ludicNetwork.md#6-lifting-a-shape-into-wml).** It governs this plan: *take the type contract, defer the behavior*, and *wire-lift and author-lift are two costs that move independently*, with [`assetWirePolicy.ts`](../../../../packages/mtw-wml/ts/standardize/assetWirePolicy.ts) as the per-structure seam between them. Primer sections 1--2 give the graph model (membership is the node list; edges say *how*).
3. **Read [`AGENT.edges.md`](../../../../packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md)**, especially *The heterogeneous edge list (shipped)* and *Endpoint wrapper (planned abstraction)*: the edge types already exist, round-trip tested, with no tag.
4. **The relation-kind rules:** [`positions/AGENT.contract.md`, *Relation kinds*](../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#relation-kinds). Hosting kinds persist **only** as the member's own edge to its host's root, never between siblings. [OD-1](#open-decisions-implementation--plan-only) turns on this.
5. **Where tags are defined:** the tag union in [`mtw-base/ts/schema/tagType.ts`](../../../../packages/mtw-base/ts/schema/tagType.ts), schema types and guards in [`components.ts`](../../../../packages/mtw-base/ts/schema/components.ts), legal-contents lists in [`index.ts`](../../../../packages/mtw-base/ts/schema/index.ts), and the WML converters/printers in [`mtw-wml/ts/schema/converters/components.ts`](../../../../packages/mtw-wml/ts/schema/converters/components.ts). `<Exit>`/`<From>`/`<To>` is the worked example through all four.
6. **Testing:** [`AGENT.testing.mtw-wml-typescript.md`](../../../../packages/mtw-wml/AGENT.testing.mtw-wml-typescript.md). `npm --prefix packages/mtw-wml run test -- --watchAll=false`, and `npx tsc -p packages/mtw-wml/tsconfig.json --noEmit` (WML tests are transpile-only, so tsc is not optional). Ephemera: [`lambda/ephemera/AGENT.testing.md`](../../../../lambda/ephemera/AGENT.testing.md). Client: `npm run build` in `charcoal-client`.
7. **Baseline before any edit:** all three green.

## Recommended order

Pending work uses `[ ]` and completed work `[X]`; mark nested lines `[X]` as each is done.

**Phase A is the wire-lift; Phase B is the author-lift.** Phase A ships edges to the client with asset mode refusing them. Phase B is not sliced yet; it is sliced when Phase A's decisions have settled.

### Phase A: the wire

- [ ] **Slice 0. Inventory, no code.** Record in [Progress](#progress):
  - [ ] Every server path that prints a graph into a delivery (start from `grep -rn "ludicGraph" lambda/ephemera/dataSource/perception lambda/ephemera/internalCache --include='*.ts'`, and every `schemaToWML` caller in ephemera).
  - [ ] Every client reader of a parsed `ludicGraph` ([`roomHeaderContents.ts`](../../../../charcoal-client/src/slices/messages/roomHeaderContents.ts), AreaEdit, others).
  - [ ] Every server-side workaround that precomputes what an edge would have carried (`hostedNodeNameStubs`, the header's one level of contents). Not to remove here; to know what Slice 5 could replace.
  - [ ] Confirm the hole with a failing test: a `StandardForm` holding a `Custom` edge, printed and re-parsed, loses it. This test is the one Slices 1--2 turn green.
- [ ] **Slice 1. Syntax for peer and topology edges** (`Custom`, `Bearing`), per [OD-2](#open-decisions-implementation--plan-only) and [OD-3](#open-decisions-implementation--plan-only).
  - [ ] Tag(s) in `mtw-base`: tag union, schema type, guard, legal contents under every host tag (Room, Object, Feature, Character, Area). All five, because the contract makes all five legal persist targets.
  - [ ] Converter and printer in `mtw-wml/ts/schema`, parsing all three terminal arms (component reference, `{owner, port}`, `{presence}`), plus `edgeId`/`chainId` when present. The lift rule: every arm of the type is parsed and round-trip tested, whether or not a writer produces it yet.
  - [ ] WML-text round-trip tests, one per arm.
- [ ] **Slice 2. Standardize.**
  - [ ] `StandardLudicRelationalEdge.schemaNode()` emits the Slice 1 tag; each host component ingests it into `ludicGraph.edges`. Components are mode-blind (primer section 6), so this is one parse path.
  - [ ] **Asset mode refuses relational edges** in `assetWirePolicy.ts`, in the style of its `LG-7` room-objects refusal. This is the author-lift deferred structure by structure, not a judgment on authoring: Phase B lifts it.
  - [ ] Slice 0's failing test goes green; `StandardForm` round trip in `ephemeraWire` mode; asset-mode refusal test.
- [ ] **Slice 3. Hosting kinds**, per [OD-1](#open-decisions-implementation--plan-only). The client can tell `On` from `In` from `PartOf`, and a member with no hosting edge still reads as `In` (the primer's default).
- [ ] **Slice 4. The wire payoff.** A cross-lambda integration test in the house convention (a real serializer round trip into a real, leaf-mocked consumer): ephemera builds the [Goal](#goal)'s room, prints it, the client's parse yields both edges. Covers [OD-4](#open-decisions-implementation--plan-only)'s terminal case.
- [ ] **Slice 5. First client reader**, per [OD-5](#open-decisions-implementation--plan-only). Shows something the client could not show before, read from the delivered graph rather than precomputed on the server.

### Phase B: authoring (unsliced)

Sliced once Phase A ships. Its known questions are [OD-6](#open-decisions-implementation--plan-only)--[OD-8](#open-decisions-implementation--plan-only). The primer names the cost: author-lift drags in asset-stack merge, identity across cache runs, and retraction.

## Not in scope

- **Printing ports and presence nodes** as structures of their own. Their wire-lift is LG-6's, recorded in [`standardize/AGENT.md`](../../../../packages/mtw-wml/ts/standardize/AGENT.md). This plan prints only edges that *reference* them; [OD-4](#open-decisions-implementation--plan-only) covers the reference whose target is missing.
- **Changing `<Exit>`.** `Navigation` keeps its tag and its Area-scoped rules.
- **Removing server-side workarounds** (`hostedNodeNameStubs`, precomputed contents). Slice 0 lists them; their removal belongs to whichever consumer replaces them.

**Coordination with the ConnectedTo plan.** Its Slice 0 adds `ConnectedTo` to WML's kind union, which `edgeToWire`'s types require; it needs nothing printed. Once both plans ship, the printer here is kind-agnostic and would carry `ConnectedTo` too. That is a wire-lift of a **Prototype** kind, which the lift rule forbids for an unsettled layer. Carrying it on the wire is transient, so retracting it later costs nothing; **authoring** `ConnectedTo` waits until that plan graduates.

## Open decisions (implementation --- plan only)

Plan-only: decisions made in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in the WML docs ([`AGENT.edges.md`](../../../../packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md), [`components/AGENT.implementation.md`](../../../../packages/mtw-wml/ts/standardize/components/AGENT.implementation.md)) and remove the row here.

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| **OD-1** | **How hosting kinds are written: on the nested reference, or as edge tags.** The user's call. Membership is already written by nesting, and the contract stores a hosting edge only as the member's own edge to its host's **root**. So the kind can be a property of the nested reference (`<Object key=(cup) on />`-like), giving one spelling per fact, with no mark meaning `In`. The alternative is explicit edge tags, with nesting as sugar for `-In->`, giving two spellings of one fact. A third option, edge tags only, would retire nesting as the authoring fast path. Leaning the nested reference, pending a check that no stored hosting edge ever lands on a port rather than the root | Slice 3 | Open, the user's call |
| **OD-2** | **Tag shape for non-hosting kinds:** one generic tag with a `kind` (and `Custom`'s label), or one tag per kind as `<Exit>` is for `Navigation`. Per-kind tags make every new kind a schema change in `mtw-base`; a generic tag makes kind a string the parser must validate against the union | Slice 1 | Open |
| **OD-3** | **Terminal syntax.** A component reference can reuse `<From>`/`<To>` string bodies (legal key or universal id), per *Endpoint wrapper (planned abstraction)* in `AGENT.edges.md`. The `{owner, port}` and `{presence}` arms have no written form. Authors probably never write them; the wire must | Slice 1 | Open |
| **OD-4** | **What the client does with a `{presence}` terminal** whose presence node is not printed. An unprintable `{owner, port}` terminal already has a rule: *an unresolvable port address reads as its owner* ([coarsening](../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md#wholes-parts-and-ports)). A bare presence id has no owner to coarsen to. Candidates: the server coarsens it to the graph's root before printing; or this plan pulls in LG-6's presence-node wire-lift | Slice 4 | Open |
| **OD-5** | **Which client surface reads a delivered edge first.** Candidates: an object's contents line that distinguishes `On` from `In` ("a tray, with a cup on it"); a room header line for a `Custom` relation ("a lamp, under the table"). Pick the one whose server-side workaround Slice 0 finds costliest | Slice 5 | Open |
| **OD-6** | **Which kinds are authorable.** The contract has no deterministic authoring for `PartOf`, and `Custom` comes only from the LLM Plan fallback at play time. Authoring is a different path, so neither fact settles it | Phase B | Open |
| **OD-7** | **Edge identity across asset-stack merge.** Today non-`Navigation` edges match structurally (kind, endpoints, label). An author editing a label with `Replace` needs an identity that survives the edit, as `<Exit uuid=(...)>`'s does. Candidates: an authored `edgeId`, or structural identity with Remove-then-add for edits | Phase B | Open |
| **OD-8** | **Authored edges onto play-time structure.** An author cannot name a presence binding or a minted port: their identities are minted at play time, and the primer warns that minting at merge time doubles them. Whether authored edges are limited to component terminals, or need a stable derived identity for the others | Phase B | Open |

## Verification

Per slice:

- `npx tsc -p packages/mtw-wml/tsconfig.json --noEmit`, and the same for `packages/mtw-base` when Slice 1 touches it.
- `npm --prefix packages/mtw-wml run test -- --watchAll=false`.
- Slices 2--5: the full ephemera suite (`npm run test -- --watchAll=false` from `lambda/ephemera/`) and `npm run build` in `charcoal-client`, since a schema change reaches both.
- Slice 2: Slice 0's failing round-trip test is green, and asset mode refuses a relational edge.
- Slice 4: the integration test asserts on the client's parsed `StandardForm`, not on the server's pre-print graph.

## Progress

| Slice | State | Notes and files touched |
| --- | --- | --- |
| 0 | Not started | --- |
| 1 | Not started | --- |
| 2 | Not started | --- |
| 3 | Not started | --- |
| 4 | Not started | --- |
| 5 | Not started | --- |

## When this plan finishes

The tag syntax, terminal forms and asset-mode policy move into [`AGENT.edges.md`](../../../../packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md) (replacing its *Bearing and every Membership/Peer kind ... have no WML surface tag* paragraph) and [`packages/mtw-wml/ts/AGENT.md`](../../../../packages/mtw-wml/ts/AGENT.md)'s tag list. The same sentence in [`components/AGENT.implementation.md`](../../../../packages/mtw-wml/ts/standardize/components/AGENT.implementation.md) is corrected. Primer section 6 gets the edge lift as its second worked example. Then this file is deleted, after a grep for inbound links.
