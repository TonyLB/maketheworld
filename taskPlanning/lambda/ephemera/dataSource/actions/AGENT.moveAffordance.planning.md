# Move Affordance Planning (`mtw.ephemera.actions`)

**Status:** In progress. Scoped to movement affordance parsing plus event emission and imperative execution parity (`event + imperative`) in `mtw.ephemera.actions`; eventual subscriber cutover is deferred to a later `mtw.ephemera.positions` initiative.

## Purpose

Coordinate and refine the work to extend command parsing with character movement affordances in the `mtw.ephemera.actions` pipeline, while preserving current behavior through an explicit `event + imperative` bridge.

This task plan is task-scoped and should be deleted or archived after the movement affordance initiative is complete.

## Scope and boundaries

### In scope for this plan

- Define and ship movement affordance parsing in `actions` parse flow.
- Prefer deterministic parsing for obvious exit commands (for example `east`, `go east`) when exits are known.
- Decide and document how Step A prompt context should include exits and target room short names.
- Add or refine stream contracts for movement events consumed by downstream systems.
- Preserve present user-visible movement behavior by pairing stream emission with imperative movement execution in this task.

### Out of scope for this plan

- Broad redesign of all parse intents.
- Non-movement affordance expansions.
- Defining or implementing `mtw.ephemera.positions` (including subscriber-based movement ownership).
- Long-term steady-state architecture docs (those belong in code-adjacent `AGENT.md` files and should be linked from here).

## Getting started

Follow the root getting-started pattern and skim the task-planning rules before implementation:

1. Task-planning conventions: [`taskPlanning/AGENT.md`](../../../AGENT.md)
2. Root workflow pattern: [`AGENT.md` "Getting Started pattern for complex tasks"](../../../../../AGENT.md#getting-started-pattern-for-complex-tasks)
3. DataSource index: [`lambda/ephemera/dataSource/AGENT.md`](../../../../../lambda/ephemera/dataSource/AGENT.md)
4. Actions package guide: [`lambda/ephemera/dataSource/actions/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.md)
5. Existing parse implementation and contract:
   - [`lambda/ephemera/dataSource/actions/baseClasses.ts`](../../../../../lambda/ephemera/dataSource/actions/baseClasses.ts)
   - [`lambda/ephemera/dataSource/actions/parseCommand.ts`](../../../../../lambda/ephemera/dataSource/actions/parseCommand.ts)
   - [`lambda/ephemera/dataSource/actions/buildParseCommandIntentClassificationPrompt.ts`](../../../../../lambda/ephemera/dataSource/actions/buildParseCommandIntentClassificationPrompt.ts)
   - [`lambda/ephemera/dataSource/actions/parseCommandIntentClassification.ts`](../../../../../lambda/ephemera/dataSource/actions/parseCommandIntentClassification.ts)
   - [`lambda/ephemera/dataSource/actions/index.ts`](../../../../../lambda/ephemera/dataSource/actions/index.ts)
   - [`lambda/ephemera/dataSource/actions/publishedEvents.ts`](../../../../../lambda/ephemera/dataSource/actions/publishedEvents.ts)
6. Legacy movement parsing and imperative movement baseline:
   - [`lambda/ephemera/parse/index.ts`](../../../../../lambda/ephemera/parse/index.ts)
   - [`lambda/ephemera/parse/executeAction.ts`](../../../../../lambda/ephemera/parse/executeAction.ts)
   - [`lambda/ephemera/moveCharacter/index.ts`](../../../../../lambda/ephemera/moveCharacter/index.ts)

## Current observations to anchor design

- `actions` already emits `Character Navigate` when parse returns `Navigation` and target is a valid room exit.
- Current `actions` parse Step A prompt does not include movement intent labels yet.
- Legacy parse already has deterministic exit matching for `exact exit name` and `go <exit name>`.
- Imperative movement execution currently runs via message bus `MoveCharacter`, and no active DataSource subscriber for `Character Navigate` to execute movement was confirmed during initial review.

## Decisions locked for this task

- Use `event + imperative` movement handling for this task's implementation scope.
- Use deterministic-first movement parsing with Step A LLM fallback for natural-language movement phrasing.
- For LLM fallback, parse to an exit label/alias intent and resolve `toRoomId` server-side from current-room exits; do not trust model-provided room ids.
- Step A movement (LLM) uses JSON `type: "NavigationIntent"` with single slot key `exitCandidate`; **`NavigationIntent` is not** final `ParseCommandResult` **`Navigation`**. After server-side resolution, `parseCommand` returns `{ type: 'Navigation', targetId, confidence }` as today. Rationale: raw model payloads and resolved navigation stay visually and structurally distinct in logs, guards, and prompts.
- Start Step A movement fallback context with exit names only; evaluate before adding destination room short names.
- Keep `Character Navigate` event emission in actions so downstream systems can subscribe later.
- Emit minimal movement event payload as `characterId`, `fromRoomId`, and `toRoomId` after exit validation/resolution.
- Do not add extra movement payload fields in this task; defer until concrete `mtw.ephemera.positions` requirements exist.
- Bridge to imperative movement execution now for behavioral parity and immediate functionality.
- Defer event-only subscriber cutover to a later task that defines `mtw.ephemera.positions` and subsumes imperative `moveCharacter` functionality.

Durable-doc linkage for this phase:

- Mirror these locked decisions in [`lambda/ephemera/dataSource/actions/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.md) when implementation lands.
- Keep `mtw.ephemera.positions` ownership/cutover details in the later positions task plan and final durable docs, not this task-scoped file.

## Key design questions to resolve

No open design questions remain for **Phase 1**.

**Phase 3 (Step A movement)** has not yet locked the implementation choices below. Resolve each item (edit this doc: pick an option, note rationale, and flip the line to **Resolved**) before treating Phase 3 as ready for a detailed implementation plan. Some items re-open tradeoffs already touched in [Decisions locked for this task](#decisions-locked-for-this-task) (for example exit-only context vs destination short names); that is intentional so Phase 3 can supersede or narrow earlier wording where needed.

## Phase 3 Step A: explicit decisions (pre-implementation)

These are the decisions a planning pass would otherwise have to improvise. Tackle them in order or in parallel, but do not assume they are decided until recorded here.

### P3-1 Model JSON `type` for movement at Step A

- **Question:** What exact string should the model emit for the movement intent?
- **Candidates:** (a) `"Navigation"` (matches final `ParseCommandResult.type` after resolution), (b) a Step-A-only label such as `"NavigationIntent"` or `"Movement"` so logs and raw JSON never look like a fully resolved `Navigation` with `targetId`.
- **Why it matters:** Prompt text, interpreter branches, and error messages must stay aligned; mixing the same `type` string for two shapes (with vs without `targetId`) risks confusion unless naming is very strict.

**Resolved:** **`NavigationIntent`** (exact string, case-sensitive). Same literal in the Step A prompt vocabulary and in `interpretParseCommandIntentClassificationBody`. Final pipeline output for a successful move remains **`Navigation`** with **`targetId`** set only after server-side exit resolution.

### P3-2 Internal TypeScript shape after Step A (before server resolution)

- **Question:** Should `IntentClassificationResult` gain a distinct variant (for example `NavigationIntent` with `exitLabel` / `exitCandidate` + `confidence`) separate from final `ParseCommandResult` `{ type: 'Navigation', targetId, confidence }`?
- **Candidates:** (a) Yes, always separate Step-A output from final navigation result, (b) No, reuse one type with optional `targetId` (generally discouraged given "do not trust model room ids").
- **Why it matters:** Type guards and exhaustiveness checks stay honest; `parseCommand` has a clear place to run server-side resolution.

**Resolved:** **Yes (option a).** Add `IntentClassificationResult` variant **`{ type: 'NavigationIntent', exitCandidate, confidence }`** using the same **`type`** discriminant as the model (**`NavigationIntent`**). Do not put **`targetId`** on this variant. **`ParseCommandResult`** keeps **`Navigation`** only for post-resolution results (including deterministic navigation today).

### P3-3 JSON field name for the exit label / alias from the model

- **Question:** Canonical property name in the model JSON object (alongside `type` and `confidence`).
- **Candidates:** `exitCandidate`, `exitLabel`, `exitName`, `normalizedExit`, or other; pick one and document it in the prompt as normative.
- **Why it matters:** Interpreter validation and prompt examples must use a single name; renames later break Bedrock behavior in the field.

**Resolved:** Use **`exitCandidate`** as the canonical Step A movement slot key. `NavigationIntent` JSON shape is `{ "type": "NavigationIntent", "exitCandidate": "<string>", "confidence": <number> }` (subject to other validation decisions such as forbidden fields in P3-6).

### P3-4 When the Step A prompt advertises movement

- **Question:** Under what conditions does the classification prompt include the movement intent and the exit list?
- **Candidates:** (a) Only when `roomExits.length > 0`, (b) always, with prose when the list is empty, (c) other gating (for example only when deterministic branch did not fire—note that is already implicit whenever Bedrock runs).
- **Why it matters:** If the model can emit movement when no exits exist, you need a defined downstream behavior (see P3-5).

**Resolved:** **Option (b)**. Always include movement as an available Step A intent (`NavigationIntent`), even when the exit list is empty. When exits are available, include them in prompt context. When exits are not available (or empty), include explicit prompt text that movement may still be classified by intent, but destination validity is resolved server-side after parse.

### P3-5 Model emits movement JSON when movement was not in the prompt

- **Question:** If the prompt did not offer movement (for example no exits), and the model still returns a movement-shaped object, what should `interpretParseCommandIntentClassificationBody` / `parseCommand` do?
- **Candidates:** (a) `Error` with a specific message, (b) coerce to `Unknown`, (c) ignore movement fields and fall through to generic invalid JSON handling.
- **Why it matters:** Keeps prompt, interpreter, and runtime behavior aligned with P3-4.

**Resolved:** Return parse **`Error`** when server-side resolution of `NavigationIntent` fails (for example no current room, no matching exit, or ambiguous match), with stable `errorMessage` values that `index.ts` can map to tailored user-facing copy. This intentionally preserves intent recognition while keeping authoritative exit validation in server logic.

### P3-6 Forbidden model fields for movement at Step A

- **Question:** Which keys, if present on an otherwise movement-shaped object, must hard-fail validation to preserve "do not trust model-provided room ids"?
- **Candidates:** At minimum any of `targetId`, `toRoomId`, `roomId`, `destinationId`; confirm whether `fromRoomId` should also be rejected.
- **Why it matters:** Security and contract clarity; mirrors the Step A Acme rule that rejects `orders` in the intent object.

**Resolved:** Hard-fail validation if any room-id-like routing field is present on `NavigationIntent`, including `targetId`, `toRoomId`, `roomId`, `destinationId`, or `fromRoomId` (and similarly named id-routing aliases if encountered). Step A movement contract is intent plus `exitCandidate` plus `confidence` only. Treat presence of these fields as a contract breach / leakage signal and return parse `Error`.

### P3-7 Server-side resolution failures (ambiguous or no match)

- **Question:** After Step A returns an exit label, if normalization and matching against `roomExits` yields zero matches or more than one distinct `targetId`, what is the `ParseCommandResult`?
- **Candidates:** (a) `Error` with a stable machine-oriented `errorMessage`, (b) `Unknown`, (c) `Unimplemented`, (d) user-visible copy only at `index.ts` while parse returns a different type.
- **Why it matters:** `index.ts` already branches on `isParseCommandErrorResult` vs navigation; OOC messaging may need to stay consistent with deterministic failure behavior.

**Resolved:** **Option (a)**. Return parse **`Error`** with stable machine-oriented `errorMessage` when `NavigationIntent` cannot resolve to exactly one destination from current `roomExits`. This includes at least: (1) no current room context, (2) zero matching exits ("no such exit"), and (3) ambiguous match across multiple distinct targets. `index.ts` maps these error cases to tailored user-facing movement failure copy.

### P3-8 Code structure: shared exit resolution with deterministic branch

- **Question:** Should deterministic navigation and Step-A movement resolution share one helper (same normalization and matching rules), or stay as separate implementations?
- **Candidates:** (a) Single shared `resolveExitLabelToTargetId` (or similar) used by both paths, (b) duplicate logic with tests required to keep them in sync, (c) shared normalize only.
- **Why it matters:** Drift between deterministic and LLM-resolved movement is a common source of bugs.

**Resolved:** **Option (a)**. Use a single shared resolver helper (for example `resolveExitLabelToTargetId`) for both deterministic navigation and `NavigationIntent` post-validation. Shared helper owns normalization and match semantics; callers decide confidence source and whether failure maps to deterministic fall-through or explicit parse `Error`.

### P3-9 Destination room short names in the Step A prompt (reconciles with Phase 1 checklist)

- **Question:** Phase 3 checklist calls for "exits and destination short names" in prompt construction. Earlier locked text said start with exit names only and add destination short names later only if needed. What do we ship for Phase 3?
- **Candidates:** (a) Exit labels only for Phase 3; defer short names to a follow-up, (b) Include short names in Phase 3 whenever we can resolve them, (c) Include short names only when they differ from exit label or exceed a clarity threshold (define).
- **Why it matters:** Extra context changes model behavior and implementation cost (`getRoomExitTargetsForCharacter` / render lookups per destination).

**Resolved:** **Option (a)**. Ship Phase 3 with exit labels only in Step A movement context. Defer destination short names to a follow-up slice after initial `NavigationIntent` behavior is validated.

### P3-10 Source of truth for destination short name (if P3-9 includes it)

- **Question:** How is each destination label obtained for the prompt table?
- **Candidates:** (a) `internalCache.ComponentRender.get` per distinct `toRoomId`, (b) reuse an existing helper such as `seamRoomLabelFromEphemeraRoomId` only, (c) WML or meta elsewhere; define fallback when short name is missing.
- **Why it matters:** Latency, testability, and consistency with what the player sees elsewhere.

**Resolved:** Deferred / not applicable for this Phase 3 slice because P3-9 chose exit-label-only prompt context.

### P3-11 Prompt tie-breaks: movement vs other same-tier intents

- **Question:** When the line could be read as movement and as Acme order, full-room look, or await-road-runner, what is the precedence or tie-break prose in the Step A prompt?
- **Candidates:** Extend the existing "tie-breaks" section with explicit movement vs B/C/D rules; optionally add 1-2 golden examples in this doc (not necessarily in code).
- **Why it matters:** Reduces oscillation in Bedrock output between `AcmeOrder` and movement for borderline phrasing.

**Resolved:** Add explicit prompt tie-break order for ambiguous lines when confidence is not a meaningful separator: **(1) AcmeOrder, (2) LookRoom, (3) AwaitRoadRunner, (4) NavigationIntent**. Movement should be selected only when higher-priority intents are not central to the utterance.

### P3-12 Confidence on resolved `Navigation`

- **Question:** Should final `{ type: 'Navigation', targetId, confidence }` use Step A `confidence` unchanged, or apply a rule (for example cap at 1, multiply by a resolution factor, or set to 1 after deterministic match of the label)?
- **Why it matters:** Downstream may eventually weight confidence; today it should be defined so tests have a stable expectation.

**Resolved:** Deterministic navigation matches keep confidence **`1`**. For LLM-driven movement, successful `NavigationIntent` resolution preserves Step A confidence unchanged on final `{ type: 'Navigation', targetId, confidence }` (no additional multiplier or normalization factor).

### P3-13 Interpreter API shape

- **Question:** Does `interpretParseCommandIntentClassificationBody` take an explicit flag (for example `allowNavigationIntent: boolean`) keyed off P3-4, or does it always parse movement JSON and leave rejection to `parseCommand`?
- **Candidates:** (a) Flag parameter keeps prompt and interpreter in lockstep, (b) Single interpreter path with rejection later.
- **Why it matters:** AGENT.md already asks to keep prompt enum and interpreter aligned; the mechanism should be deliberate.

**Resolved:** **Option (b)**. Keep a single interpreter path: always parse and validate `NavigationIntent` JSON shape in `interpretParseCommandIntentClassificationBody` (no `allowNavigationIntent` flag). Acceptance still depends on server-side resolution in `parseCommand`.

## Recommended order

Use `[ ]` for pending and `[X]` for complete. Mark nested lines `[X]` as each sub-step lands.

- [X] Phase 1 - contract and decision checkpoint
  - [X] Confirm movement intent boundary and fallback strategy (deterministic first, Step A LLM fallback for natural-language movement phrasing).
  - [X] Decide prompt context fields for movement (start with exit labels only; add destination short names later only if needed).
  - [X] Lock movement payload contract (`characterId`, `fromRoomId`, `toRoomId`) with server-side exit validation/resolution.
  - [X] Confirm no additional movement payload fields for this task (avoid overengineering until `mtw.ephemera.positions` requirements are concrete).
  - [X] Lock temporary dual-path behavior as event + imperative for this task.
  - [X] Record decisions in this plan and link lasting outcomes to durable docs.

- [X] Phase 2 - deterministic movement parse branch
  - [X] Add deterministic short-circuit parsing for direct exit commands in `parseCommand` pipeline.
  - [X] Reuse room-exit context source in actions flow (single source of truth for available exits).
  - [X] Keep behavior explicit for invalid exits and no-room cases.
  - [X] Add focused unit tests for deterministic matching variants and edge cases.

- [ ] Phase 3 - optional Step A movement intent support
  - [X] Resolve [Phase 3 Step A: explicit decisions](#phase-3-step-a-explicit-decisions-pre-implementation) (P3-1 through P3-13) in this document before implementation planning.
  - [ ] Extend Step A prompt/types/interpretation with movement intent label if Phase 1 selects LLM fallback.
  - [ ] Pass selected movement context (exits and, per P3-9, destination short names) into prompt construction.
  - [ ] Ensure type guards and parse result union remain aligned.
  - [ ] Add tests covering model output validation and fallback behavior for movement intent.

- [ ] Phase 4 - actions handler and downstream execution
  - [ ] Ensure actions handler emits movement event contract needed by downstream systems.
  - [ ] Implement imperative movement execution bridge for parity in this task.
  - [ ] Add tests proving both event emission and imperative movement execution behavior.

- [ ] Phase 5 - handoff notes and docs
  - [ ] Document deferred cutover target (`mtw.ephemera.positions`) and explicit non-goals in durable docs.
  - [ ] Update durable docs in `lambda/ephemera/dataSource/actions/AGENT.md` and related package docs.
  - [ ] Mark this plan complete and remove/archive when no longer needed.

## Verification

Run from `lambda/ephemera/` unless noted otherwise.

- Targeted parser and actions tests:
  - `npm run test -- --runInBand dataSource/actions/parseCommand.test.ts dataSource/actions/index.test.ts`
- Movement path tests:
  - `npm run test -- --runInBand moveCharacter/index.test.ts`
- Build check:
  - `npm run build`
- Optional broader confidence sweep after substantial wiring:
  - `npm test`

## Progress

| Milestone | Status |
| --- | --- |
| Create movement affordance task plan | Done |
| Phase 1 contract decisions | Done |
| Deterministic movement parse branch | Done |
| Step A movement support (if selected) | Not started |
| Event plus imperative movement bridge | Not started |
| Handoff docs for later positions cutover | Not started |
