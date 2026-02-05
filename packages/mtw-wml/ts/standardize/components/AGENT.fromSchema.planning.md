# fromSchema Process-and-Remainder Rearchitecture – Planning Document

**Status**: Planning  
**Created**: February 2025  
**Purpose**: High-level plan for refactoring StandardComponent WML schema parsing from repeated full-list scans to a process-and-remainder pipeline.

**Document Status**: This is a planning document. Implementation should follow the steps described here; details may evolve as we learn from implementation. See [AGENT.implementation.md](./AGENT.implementation.md) for current component implementation patterns.

---

## Overview

Component constructors that accept WML schema (e.g. `StandardRoom`, `StandardFeature`) currently populate each property by scanning the same full child list repeatedly via `findTaggedChildren`. This leads to redundant work, silent ignores of unknown tags, and ad-hoc per-component logic that has drifted over time. This plan describes a rearchitecture to a **process-and-remainder** pipeline: each step consumes only the data relevant to one (or a few) properties and passes the **remainder** to the next step; any unconsumed data at the end is treated as an error.

---

## Current State

### Pattern in Use

- Payload `fromSchema(node)` receives `node.children` (after the component base has stripped Key and Parent via `SchemaTagTree`).
- For each property (e.g. ShortName, Exit, Lens, Feature), the code calls `findTaggedChildren({ children: node.children, tag: 'X' })` over the **same** list.
- Example: `StandardRoomPayload.fromSchema` performs seven full passes (ShortName, Exit, Lens, Feature, Example, Guidance, Character) over `node.children`.

### Problems

1. **Repeated scans**: The same children are inspected many times.
2. **Silent failures**: Unknown or misplaced tags (e.g. `<Map>` inside `<Room>`) are ignored; there is no signal when schema or nesting is wrong.
3. **Split-child complexity**: Any case where one WML child's content would feed multiple properties would require ad-hoc handling; the current design doesn't support it cleanly.
4. **Drift**: Older components use older patterns; the system is hard to uplift uniformly.

---

## Target Design: Process-and-Remainder Pipeline

### Core Idea

- Treat schema parsing as a **sequence of steps**. Each step:
  1. Takes the current **children** (initially `node.children`, then the previous step's remainder).
  2. **Splits** that list into "matched" (data relevant to this step) and **remainder** (everything else).
  3. **Updates** the component from the matched data (e.g. set `this._shortName`, `this._exits`, etc.).
  4. **Returns** the remainder for the next step.
- After the last step, **remainder must be empty**. If not, treat as an error (e.g. throw with "Unconsumed child tags: …") so unknown or invalid schema is never silently ignored.

### New Primitive: `splitTaggedChildren`

- **Role**: Like `findTaggedChildren`, but return both the nodes that semantically match a tag **and** the rest.
- **Signature** (conceptually): `splitTaggedChildren({ children, tag }) => { matched: GenericTree<SchemaTag>, remainder: GenericTree<SchemaTag> }`.
- **Semantics**: Must respect Remove/Replace wrappers the same way `findTaggedChildren` does: "matched" is the same filtered view as today; "remainder" is the same list with those matched parts removed (splitting inside wrappers when a wrapper contains both matching and non-matching content).
- **Location**: Implement alongside existing schema utils (e.g. `packages/mtw-wml/ts/schema/utils/`), with tests mirroring `findTaggedChildren.test.ts` and adding remainder assertions.

### Pipeline Shape

- Each component's `fromSchema` (or a shared helper it uses) runs a **list of steps**.
- A step is defined by: which tag(s) or predicate it consumes, and how it maps matched nodes to payload fields.
- Components that need a "split by predicate" first (e.g. Lens/Mark: component vs non-component children) can have an initial step that partitions by predicate and passes the appropriate slice as the remainder for the tag-based steps.
- **Order of steps** is fixed and explicit, giving a single contract for "what this component accepts."

#### Phase 1 Step 2 (detailed): Consumer interface, simple consumer class, and runner

Before implementing the pipeline in components, we define the following contract and utilities:

1. **`StandardizeConsumer` interface**  
   Consumer stages in the pipeline implement this interface (e.g. classes that can be instantiated and used as steps).
   - **`process(children: GenericTree<SchemaTag>): GenericTree<SchemaTag>`**  
     Accepts the incoming list of schema elements (children) and returns the **remainder** after this step has consumed what it needs. The step is responsible for side-effecting the component (e.g. setting a property on `this`); the runner passes the component context when invoking the step.

2. **`StandardizeConsumerSimple<D extends StandardComponent>` class**  
   A generic class that implements `StandardizeConsumer` for the common case: consume one tag, update one property.
   - **Constructor**: `(this: D, options: { tag: SchemaTag['tag'], update: (this: D, nodes: GenericTree<SchemaTag>) => void })`
   - **Behavior**:
     - Uses `splitTaggedChildren({ children, tag: options.tag })` to obtain `{ matched, remainder }`.
     - If `matched` is non-empty, calls `options.update.call(this, matched)` so the component sets the property (e.g. `this._shortName = ...`).
     - Returns `remainder` (to be passed to the next step).

3. **`processWithConsumers` utility**  
   Runs the pipeline and enforces "no unconsumed children."
   - **Signature**: `processWithConsumers<T>(context: T, consumers: StandardizeConsumer[], children: GenericTree<SchemaTag>): void`
   - **Behavior**:
     - Reduces over the list of consumer instances: start with `children`; for each consumer, call `consumer.process(currentChildren)` to get the next remainder, and pass that remainder to the next consumer. Each consumer is expected to side-effect `context` (e.g. the payload instance) when it processes its matched nodes; the runner may need to bind or pass `context` when creating or invoking consumers so that `this` is correct.
     - After the last consumer, the final remainder must be empty. If not, throw an error (e.g. list unconsumed tags) so that unknown or invalid schema is never silently ignored.

This design allows StandardRoom (and other "simple" components) to define an ordered list of `StandardizeConsumerSimple` instances (one per tag/property) and call `processWithConsumers(this, consumers, node.children)` from `fromSchema`. Components with custom steps (e.g. predicate-based split) can implement `StandardizeConsumer` directly and plug into the same runner.

**Implementation**: [fromSchemaPipeline.ts](./fromSchemaPipeline.ts) (interface, class, `processWithConsumers`); [fromSchemaPipeline.test.ts](./fromSchemaPipeline.test.ts) (unit tests).

---

## High-Level Steps to Pursue

### Phase 1: Foundation

1. **Implement `splitTaggedChildren`** — **Done (February 2025)**
   - Implemented in schema utils with the same Remove/Replace semantics as `findTaggedChildren`.
   - Returns `{ matched, remainder }`; remainder does not contain nodes that were placed in matched (wrappers are split correctly when they contain both).
   - Unit tests in `packages/mtw-wml/ts/schema/utils/splitTaggedChildren.test.ts` (parity with findTaggedChildren, remainder correctness, Remove/Replace splitting, integration-style pipeline).
   - Util: `packages/mtw-wml/ts/schema/utils/splitTaggedChildren.ts`; exported from schema utils index.

2. **Define the pipeline contract (Phase 1 Step 2)** — **Done (February 2025)**
   - **`StandardizeConsumer`** interface: `process(children) => remainder` (see "Phase 1 Step 2 (detailed)" under Pipeline Shape above).
   - **`StandardizeConsumerSimple<D extends StandardComponent>`**: constructor takes `(context, { tag, update })`, uses `splitTaggedChildren`, calls `update` when matched is non-empty, returns remainder.
   - **`processWithConsumers(context, consumers, children)`**: reduces through the consumer list (side-effecting `context`), throws if final remainder is non-empty (error message lists unconsumed tags).
   - Pipeline runs via this shared helper: each payload's `fromSchema` builds its ordered list of consumers and calls `processWithConsumers(this, consumers, node.children)`; the pattern is reused across Room, Feature, Lens, etc.
   - Util: `packages/mtw-wml/ts/standardize/components/fromSchemaPipeline.ts`; tests: `fromSchemaPipeline.test.ts`.

### Phase 2: Migrate One Component End-to-End — **Done (February 2025)**

**Summary:** StandardRoom migrated to the process-and-remainder pipeline; remainder check in place; unconsumed-tag tests added; no-op consumers for Position, Grant, DisplayName preserve backward compatibility; full test suite green; AGENT.implementation.md updated with pipeline pattern.

3. **Refactor one component to the pipeline** — **Done**
   - **StandardRoom** refactored: ordered consumers (ShortName, Exit, Lens, Feature, Example, Guidance, Character, Position, Grant, DisplayName), `processWithConsumers(this, consumers, node.children)`; remainder check throws with unconsumed tag names.
   - Preserved existing behavior for all valid Room WML; invalid/misplaced tags (e.g. Map inside Room) are rejected with a clear error.

4. **Validate and document** — **Done**
   - Full mtw-wml test suite passing; regressions fixed (added no-op consumers for Grant, Edit, DisplayName where tests expected silent ignore).
   - [AGENT.implementation.md](./AGENT.implementation.md) updated with "fromSchema: process-and-remainder pipeline" subsection and unconsumed = error rule.

### Phase 3: Roll Out to Remaining Components

5. **Migrate remaining "simple" components** — **Done (February 2026)**
   - Simple components that only use tag-based consumption were migrated to the same pipeline pattern as `StandardRoom`.
   - **Migrated components (Phase 3 Step 5 scope):**
     - `StandardFeature` (tags: `ShortName`, `Example`)
     - `StandardKnowledge` (tags: `ShortName`, `Example`)
     - `StandardCharacter` (tags: `ShortName`, `Pronouns`, `DisplayName`, `Image`)
     - `StandardMessage` (tags: `ShortName`, `Description`, `Room`)
     - `StandardMoment` (tags: `ShortName`, `Message`)
     - `StandardImage` (tags: `ShortName`)
   - For each of the above:
     - Defined an ordered list of consumer steps and replaced `findTaggedChildren`-style scans with `processWithConsumers(this, consumers, node.children)`.
     - Ensured the final remainder is empty; unknown or unexpected child tags now surface as `Unconsumed child tags: …` errors (subject to schema-layer validation).
     - Kept existing behavior for all valid WML (round-trips and merge/diff tests remain green).

6. **Migrate components with predicate or multi-tag steps (Lens / Mark)** — **Done (February 2026)**
   - **Lens / Mark**
     - `StandardLens` and `StandardMark` now use the standard pipeline pattern: `StandardizeConsumerStandardLiteral` for `ShortName`, `StandardizeConsumerRender` for `Description`, and `StandardizeConsumerReferenceList` for `Mark` (Lens only).  
     - No additional "split components from non-components" step is required, since `splitTaggedChildren` and the consumers already respect Remove/Replace semantics and avoid recursing into nested components.  
     - As a side-effect of enabling the remainder check, `StandardExample` tests that pass Mark *facets* (Marks with `<Match>` payloads) now fail with `Unconsumed child tags` errors when those facet payloads are fed through the Mark *component* parser. We are treating this as a **deliberate signal** to drive TDD for facet-aware pipelines (e.g. deciding how facet `Match` payloads are parsed vs. left to higher-level facet handling, and whether `remainder` should be threaded into `processComponents` for Example/Guidance).

7. **Integrate two-remainder pipeline with processComponents**
   - **Goal**: Allow components that have ReferenceList or FacetList consumers to pass a **return remainder** (nodes that should be recursed into by `processComponents`) alongside the existing **parsing remainder** (what is left to run past the rest of the pipeline). This unblocks Map (Room+Position facets) and Example/Guidance (Mark facets) without special-case hooks.
   - **Observation**: Only component tags (Room, Feature, etc.) ever produce entries in the flat component list. Tags like ShortName are purely local; ReferenceList and FacetList consumers are the ones that "produce" nodes that `processComponents` must recurse into. So the boundary is at the consumer: some consumers contribute to a **return remainder** that is passed to `processComponents` for recursion; the rest only whittle the parsing remainder.
   - **Two remainders**:
     - **Parsing remainder**: Unchanged from today. Starts as `children`; each consumer returns the next parsing remainder; must be empty at end of pipeline (unconsumed = error).
     - **Return remainder**: Starts empty. Only ReferenceList and (when added) FacetList consumers add to it. For **ReferenceList**: each matched tag (e.g. Feature, Example) is added in full so `processComponents` can recurse and create the child component. For **FacetList** (e.g. Position under Map): each matched "Room with Position" yields facet data for the FacetList and a **Room node without Position** (same node, children = remainder after stripping Position) added to the return remainder so `processComponents` builds `StandardRoom` from the rest. Literal/Render/Simple consumers never add to the return remainder.
   - **Contract**: (a) Parsing remainder must be empty after the last consumer. (b) The aggregated return remainder is what `fromSchema` returns and what `processComponents` uses (instead of raw `item.children`) when recursing.
   - **Order**: WML is treated as order-independent for this purpose. Return remainder is built in consumer order; the only theoretical order sensitivity would be overlapping edits on different-typed siblings in non-standard WML, which we do not need to support.
   - **Implementation outline** (order of work; to be refined when implementing):
     - **7a. Add component-level `fromSchema` everywhere (first)**  
       Add instance method `fromSchema(node): GenericTree<SchemaTag>` on the component base and ensure every component has it (base implements the shared behavior; component classes inherit or override as needed). It does Key/Parent stripping and explicitParent handling, calls `this._payload.fromSchema(nodeWithoutParentAndKey)`, and returns the payload’s return value (once payload returns remainder; until then returns `[]`). The constructor’s schema branch delegates to `this.fromSchema(node)` and ignores the return. Allow a default-construction path (e.g. `props === undefined` → return early after `this._payload = new Base()`) so the factory can do “construct, then call fromSchema.” Roll this out across all component implementations so the API is in place before changing payload return values. No behavior change yet for remainder; just the component-level entry point and constructor refactor.
     - **7b. Two-remainder pipeline and return values (after 7a)**  
       Consumer interface returns both parsing remainder and return-remainder addition (e.g. `{ parsingRemainder, returnRemainderAddition }`). Simple consumers return `returnRemainderAddition: []`. `processWithConsumers` (or equivalent) maintains both accumulators and returns the aggregated return remainder so payload `fromSchema` can return it. Payload `fromSchema` signature: returns `GenericTree<SchemaTag>` (return remainder); components without reference/facet consumers return `[]`. Then `component.fromSchema` simply returns the payload’s return value. `standardComponentFactory` and `processComponents`: when recursing, use “construct (default), call `component.fromSchema(item)`” and use the return value as child schema instead of `item.children`.
   - **Default construction for “component then fromSchema”**: The component constructor already does `this._payload = new Base()` first, so the payload’s default construction is already reused. We only need a constructor path that leaves the component in that state (e.g. `props === undefined` → return early after assigning the payload) so the factory can do `const c = new StandardRoom(undefined); const remainder = c.fromSchema(node); return { component: c, remainder }`. No separate “empty” payload path—reuse the existing default.
   - **Gaps / to be decided**: Exact consumer method signature and runner API; whether to add `StandardizeConsumerFacetList` in this step or in Step 8.

8. **Migrate Map and Example / Guidance (facet-aware pipelines)**
   - **Map**: Handle "Room with Position" as a step that consumes Room nodes that have Position children; remainder is the rest. Preserve ShortName and Image steps as in current logic. Rely on Step 7 return remainder so Room-without-Position is passed to `processComponents` for `StandardRoom` creation; remove no-op Position consumer from StandardRoom when Map is the only legal parent for Position.
   - **Example / Guidance**: Handle Mark facets and any tag-tree filtering in step logic; ensure remainder is consistent. Because of their facet/Mark complexity and the failing tests around Mark facets with `<Match>` payloads, migration is driven by those tests and by the Step 7 return-remainder integration.

9. **Align base Key/Parent stripping with the pipeline (optional)**
   - The component base already strips Key and Parent before calling `payload.fromSchema`. Optionally document this as the "first two conceptual steps" or leave as-is; either way, the payload's pipeline starts from "children without Key and Parent."

### Phase 4: Shift Validation from Schema to Standardize

10. **Relax schema-level child validation**
   - Today, the schema converters (e.g. `schema/converters/components.ts`) attempt to enforce per-component child tag legality when building `Schema*Tag` nodes (e.g. rejecting `<Map>` under `<Message>`). This logic is clumsy compared to what the process-and-remainder pipeline can express.
   - Adjust the schema layer so that component converters:
     - Continue to validate **properties/attributes** and overall tag shape (e.g. required keys, UUID formats).
     - Stop trying to deeply validate **child tag contents** beyond basic structural well-formedness. Children should be passed through as a generic `GenericTree<SchemaTag>` without per-component tag whitelists.
   - The goal is that “is this tag allowed here?” becomes a **Standardize concern** enforced by `fromSchema` pipelines, not by the schema parser.

11. **Centralize semantic child validation in pipelines**
   - For each component with a `fromSchema` pipeline (Room, Feature, Knowledge, Character, Message, Moment, Image, and future Lens/Map/Example/Guidance/Mark):
     - Treat the ordered consumer list as the single source of truth for “which child tags are legal here.”
     - Rely on `processWithConsumers`’s final remainder check to flag any unknown or misplaced child tags as `Unconsumed child tags: …`.
   - Where we previously duplicated simple tag validity rules in the schema converters (e.g. disallowing certain tags as children), remove or relax those checks once the corresponding component has a robust pipeline and unconsumed-tag tests.
   - **Revisit unit tests that were previously constrained by schema validation** (e.g. the “illegal child tag” tests for Character, Message, Moment, Image) and re-enable or extend them so they construct now-schema-legal but semantically invalid child combinations, asserting that the Standardize pipeline (not the schema layer) throws the appropriate unconsumed-tag errors.

12. **Simplify and document the division of responsibility**
   - Update schema-layer documentation to clarify that:
     - Schema parsing is responsible for **syntactic correctness** and property-level validation.
     - Component payloads (`fromSchema` pipelines) are responsible for **semantic correctness** of child structures (which tags are accepted, in what combinations).
   - Add notes to `AGENT.implementation.md` and relevant schema docs pointing back to this Phase 4, so future changes add new child-validation rules at the Standardize layer rather than reintroducing tight schema-level constraints.
   - **Typeguard usage rubric** going forward:
     - Keep typeguards that express **structural shape** of schema nodes (e.g. `isSchemaMessage`, `isSchemaDescription`, `isSchemaImage`, `isSchemaOutputTag`) and use them where we need to safely manipulate typed trees (building `StandardRender`, handling `Image` payloads, etc.).
     - Keep root-level typeguards in `fromSchema` as cheap assertions that the payload was called with the correct `Schema*Tag` (good error messages, low complexity).
     - Prefer removing or relaxing typeguard-based checks whose only purpose is to enforce **which child tags are allowed under a parent** at the schema layer; those rules should instead be encoded in the component’s consumer pipeline and enforced via the unconsumed-remainder check.
     - When auditing existing code, treat “is this node structurally a X?” uses of typeguards as **still valuable**, and “is X allowed under Y?” uses as **legacy** candidates to be moved into the Standardize layer.

### Phase 5: Cleanup and Hardening

13. **Remove ad-hoc patterns**
   - Once all components use the pipeline and schema-level child validation has been simplified, remove any remaining per-component "scan the whole list again" patterns.
   - Consider exporting a small set of shared step builders (e.g. "shortName step," "referenceList step for tag X") to keep component definitions concise and consistent.

14. **Document and cross-reference**
   - Finalize the "fromSchema pipeline" section in component docs; link from [AGENT.md](./AGENT.md) or [AGENT.implementation.md](./AGENT.implementation.md) so future work (e.g. new WML tags or new components) follows the same pattern.
   - If this refactor is tracked in a master roadmap (e.g. [AGENT.development.md](../../../../AGENT.development.md)), add a short pointer and status there.
   - As a follow-on, **register a ticket to refactor `extractStandardRender` and related render parsing** so that more of the wrapper/edit interpretation for rich-text fields (`Description`, `DisplayName`, `Summary`, etc.) lives inside the `StandardRender` layer (or a closely related helper) rather than in ad-hoc schema utilities. This should happen after the fromSchema pipeline rollout and schema/Standardize responsibility shift are complete, so we have a stable baseline to refactor against.

---

## Success Criteria

- **Correctness**: All existing valid WML parses the same as today; no behavior change for valid input.
- **Fail-fast**: Any WML that contains child tags not handled by the component's pipeline results in a clear error (no silent ignore).
- **Single pass per child**: Each child is only considered in steps until it is consumed; no repeated full-list scans.
- **Maintainability**: Adding a new property or tag is done by adding (or reusing) a pipeline step and updating the step list; the pattern is the same across components.
- **Tests**: All current tests pass; new tests cover remainder semantics and unconsumed-tag errors.

---

## Integration Points

- **Schema utils**: [`packages/mtw-wml/ts/schema/utils/findTaggedChildren.ts`](../../schema/utils/findTaggedChildren.ts), [`packages/mtw-wml/ts/schema/utils/splitTaggedChildren.ts`](../../schema/utils/splitTaggedChildren.ts) – `splitTaggedChildren` implemented alongside `findTaggedChildren`.
- **Component base**: [`packages/mtw-wml/ts/standardize/components/component.ts`](./component.ts) – continues to strip Key/Parent and call `payload.fromSchema(nodeWithoutParentAndKey)`; payloads implement the pipeline internally.
- **Payloads**: All `*Payload` classes in this directory that implement `fromSchema` are migration targets.
- **Related docs**: [AGENT.implementation.md](./AGENT.implementation.md) (implementation patterns), [AGENT.md](./AGENT.md) (overview). Optional: [AGENT.development.md](../../../../AGENT.development.md) for roadmap tracking.

---

## Risks and Mitigations

- **Remove/Replace splitting**: Correctly splitting inside Remove/Replace nodes is the trickiest part. Mitigation: implement and test against the same cases as `findTaggedChildren`, plus explicit remainder tests for wrapped content.
- **Order sensitivity**: Pipeline order is fixed; changing it could change which nodes are consumed by which step. Mitigation: document step order as part of each component's contract; tests should lock intended behavior.
- **Regression**: Large refactor could introduce subtle bugs. Mitigation: migrate one component first (Room), keep tests green, then roll out incrementally with tests for remainder and errors.

---

## Next Steps

1. ~~Implement and test `splitTaggedChildren` (Phase 1, step 1).~~ Done.
2. ~~Define the pipeline contract (Phase 1, step 2).~~ Done.
3. ~~Refactor `StandardRoomPayload.fromSchema` to use the pipeline (Phase 2).~~ Done.
4. Proceed with remaining components (Phases 3–4):  
   - **Completed (Phase 3 Step 5):** migrate Feature, Knowledge, Character, Message, Moment, Image to the process-and-remainder pipeline.  
   - **Completed (Phase 3 Step 6):** migrate Lens and Mark to the pipeline.  
   - **Upcoming (Phase 3 Step 7):** integrate two-remainder pipeline with processComponents (return remainder from fromSchema; processComponents recurses on it).  
   - **Upcoming (Phase 3 Step 8):** migrate Map and Example/Guidance (facet-aware pipelines).
