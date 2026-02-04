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

---

## High-Level Steps to Pursue

### Phase 1: Foundation

1. **Implement `splitTaggedChildren`** — **Done (February 2025)**
   - Implemented in schema utils with the same Remove/Replace semantics as `findTaggedChildren`.
   - Returns `{ matched, remainder }`; remainder does not contain nodes that were placed in matched (wrappers are split correctly when they contain both).
   - Unit tests in `packages/mtw-wml/ts/schema/utils/splitTaggedChildren.test.ts` (parity with findTaggedChildren, remainder correctness, Remove/Replace splitting, integration-style pipeline).
   - Util: `packages/mtw-wml/ts/schema/utils/splitTaggedChildren.ts`; exported from schema utils index.

2. **Define the pipeline contract (Phase 1 Step 2)**
   - Introduce the **`StandardizeConsumer`** interface: a `process(children) => remainder` contract; steps side-effect the payload (see "Phase 1 Step 2 (detailed)" under Pipeline Shape above).
   - Implement **`StandardizeConsumerSimple<D extends StandardComponent>`**: constructor takes `{ tag, update }`, uses `splitTaggedChildren`, calls `update` when matched is non-empty, returns remainder.
   - Implement **`processWithConsumers(context, consumers, children)`**: reduces through the consumer list (side-effecting `context`), throws if final remainder is non-empty.
   - Pipeline runs via this shared helper: each payload's `fromSchema` builds its ordered list of consumers and calls `processWithConsumers(this, consumers, node.children)`; the pattern is reused across Room, Feature, Lens, etc.

### Phase 2: Migrate One Component End-to-End

3. **Refactor one component to the pipeline**
   - Choose **StandardRoom** as the first (many tags, no predicate split).
   - Replace the current sequence of `findTaggedChildren` calls with a process-and-remainder pipeline using `splitTaggedChildren`.
   - Add the **remainder check**: after the last step, if `remainder.length > 0`, throw a clear error (e.g. list unconsumed tags).
   - Preserve existing behavior for all valid Room WML; add or adjust tests so that invalid/misplaced tags (e.g. Map inside Room) are rejected with a clear error.

4. **Validate and document**
   - Run full mtw-wml test suite; fix any regressions.
   - Update [AGENT.implementation.md](./AGENT.implementation.md) (or a dedicated subsection) to describe the new fromSchema pattern and the "unconsumed = error" rule.

### Phase 3: Roll Out to Remaining Components

5. **Migrate remaining "simple" components**
   - Components that only use tag-based consumption (e.g. Feature, Knowledge, Example, Character, Message, Moment, Image, Guidance) can be migrated to the same pipeline pattern.
   - For each: define the ordered list of steps, replace `findTaggedChildren` with `splitTaggedChildren` and remainder passing, add final remainder check.
   - Keep tests green and document any component-specific rules (e.g. order of steps).

6. **Migrate components with predicate or multi-tag steps**
   - **Lens / Mark**: First step splits by "is component child" vs "not"; run tag-based steps on the non-component remainder. Ensure reference lists (e.g. Marks inside Lens) still come from the component children.
   - **Map**: Handle "Room with Position" as a step that consumes Room nodes that have Position children; remainder is the rest. Preserve ShortName and Image steps as in current logic.
   - **Example / Guidance**: Handle Mark facets and any tag-tree filtering in step logic; ensure remainder is consistent.

7. **Align base Key/Parent stripping with the pipeline (optional)**
   - The component base already strips Key and Parent before calling `payload.fromSchema`. Optionally document this as the "first two conceptual steps" or leave as-is; either way, the payload's pipeline starts from "children without Key and Parent."

### Phase 4: Cleanup and Hardening

8. **Remove ad-hoc patterns**
   - Once all components use the pipeline, remove any remaining per-component "scan the whole list again" patterns.
   - Consider exporting a small set of shared step builders (e.g. "shortName step," "referenceList step for tag X") to keep component definitions concise and consistent.

9. **Document and cross-reference**
   - Finalize the "fromSchema pipeline" section in component docs; link from [AGENT.md](./AGENT.md) or [AGENT.implementation.md](./AGENT.implementation.md) so future work (e.g. new WML tags or new components) follows the same pattern.
   - If this refactor is tracked in a master roadmap (e.g. [AGENT.development.md](../../../../AGENT.development.md)), add a short pointer and status there.

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
2. Define the pipeline contract and refactor `StandardRoomPayload.fromSchema` to use it (Phase 1–2).
3. Add unconsumed-remainder error and tests; then proceed with remaining components (Phases 3–4).
