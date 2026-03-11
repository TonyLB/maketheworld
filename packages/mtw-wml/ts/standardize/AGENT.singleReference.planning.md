# Optional Single Reference – Planning

**Status**: Stub / design in progress  
**Created**: March 2026  

This document captures design intent and open questions for a **code pattern for handling an optional single reference** in StandardComponent payloads: a slot whose *semantic* is "zero or one" reference (e.g. Room → Lens). The data shape might stay as-is (`lens?: StandardReference` or existing `ReferenceList`); the open work is how we *handle* that slot consistently—merge, diff, parsing, serialization—and whether the current shapes are sufficient or need to change.

---

## Getting Started

1. **Understand project foundations**
   - Read the root `AGENT.md` (project overview) and `packages/mtw-wml/ts/standardize/components/AGENT.md` to align on StandardComponent, ReferenceList, and how components reference each other.
   - Focus on how Room, Feature, Example, Guidance, and Lens are modeled and how references and facets are used.

2. **Read this planning document end-to-end**
   - Start with the Overview and Problem statement to understand why SingleReference exists as a pattern, not just a type.
   - Pay attention to the SingleReference diff envelope (0 or 1 positive, 0 or 1 negative) and the decision to keep data shape and handling concerns separate.

3. **Review the current Room + Lens implementation**
   - Open `components/dataTypes/room.ts` and `components/room.ts` to see how `lenses?: ReferenceListData` and `_lenses: ReferenceList` are currently defined and used.
   - Skim the Room editor and Lens editor in the client (`charcoal-client/src/components/Workbench/RoomEdit`) to see how "zero/one/many lenses" behavior is surfaced in the UI.

4. **Study ReferenceList behavior**
   - Read `keys/referenceList.ts` and `keys/dataTypes/reference.ts` to understand `StandardReference`, `ReferenceListData`, and how `merge` and `diff` work today for general lists.
   - Note where list-shaped merge/diff semantics already encode positive vs negative references (e.g. `invert`, `ref` values, and `diff`).

5. **Look at existing single-ish patterns**
   - Check for other places where a ReferenceList is used but semantics are "0 or 1" (for example, any slots that the client or tests already treat as single).
   - This helps validate that the SingleReference pattern is reusable beyond Room.lenses.

6. **Plan SingleReference implementation**
   - Use the Design space and Open questions sections to decide how `SingleReference extends ReferenceList` should behave (constructor invariants, `value` getter/setter, merge/diff overrides).
   - Sketch how existing codepaths (StandardRoom, StandardForm, client editors) will adopt the new pattern without breaking round-trip invariants.

7. **Run and extend tests**
   - Run the mtw-wml test suite (see root `AGENT.md` for commands) before changing anything.
   - Add focused tests for SingleReference behavior: construction, merge/diff envelope, application to StandardRoom.lenses, and round-tripping through StandardForm and schema.

---

## 1. Overview

### Purpose

- Define a **code pattern** for "this component optionally references **at most one** instance of another component" (e.g. Room → Lens): how we handle merge, diff, parsing, and serialization for that slot.
- Decide whether the right data shape is `lens?: StandardReference`, the existing `ReferenceList`, or something else—and document how to support it consistently.
- Clarify behavior when merging or diffing (e.g. base has LensA, incoming has LensB) so the invariant "at most one" is respected and the machinery (merge/diff) has a clear contract.

### Context

- **StandardComponent** data today uses **ReferenceList** for any parent→child reference collection (features, examples, lenses, etc.).
- Some of those relationships are semantically **single optional**: we look for one child of a given tag and accept zero or one; finding two or more is invalid.
- **StandardRoom.lenses** is the canonical example: we expect either one Lens or no Lens per Room; multiple Lenses are currently represented in the same structure as "many" and then treated as an error/warning in the client.

### Key concepts

- **ReferenceList**: Current type for 0..n references; see [`keys/referenceList.ts`](keys/referenceList.ts) and [`keys/dataTypes/reference.ts`](keys/dataTypes/reference.ts).
- **StandardReferenceData / ReferenceListData**: Serialization format for references; `ReferenceListData` is an array of `StandardReferenceData`.
- **SingleReference (pattern)**: The convention that a given reference slot has cardinality 0 or 1 (e.g. Room → Lens). The *data* might be stored as `lens?: StandardReference` or as a `ReferenceList` of length ≤1; the pattern is how we *handle* it (merge, diff, parse, emit). A SingleReference field is always optional (empty component must remain valid); document that wherever the pattern is applied.

---

## 2. Problem statement

Today we model "Room has an optional single Lens" as:

- **Data**: `StandardRoomData.lenses?: ReferenceListData` (array of references).
- **Runtime**: `StandardRoomPayload._lenses: ReferenceList` with `payload` array; length may be 0, 1, or >1.
- **Semantics**: The domain expects 0 or 1; 2+ is invalid. The client (e.g. LensEditor) explicitly handles "multiple lenses" as a warning state and does not allow full editing.

This leads to:

- **Semantic mismatch**: The type system and serialization allow n references; only 0 and 1 are valid.
- **Scattered validation**: Call sites (e.g. Room editor) must enforce "at most one" and special-case multiple.
- **Unclear contract**: New single-reference relationships would have no standard pattern; they would again be modeled as ReferenceList with ad hoc checks.

We want a **single-reference handling pattern** so that:

- Merge, diff, fromSchema, and serialization all behave in a defined way for "at most one" slots (e.g. replace-on-merge, diff as "remove A / add B").
- The data shape—whether `lens?: StandardReference` or `ReferenceList`—is chosen deliberately and documented; support for that shape does not end at storage.
- Editors and other consumers can rely on the invariant and on consistent merge/diff semantics.

---

## 3. Current state

- **StandardRoom**: [`components/room.ts`](components/room.ts) – `_lenses: ReferenceList`; fromJSON/fromSchema accept arrays; toJSON/schema emit arrays. No enforcement of length ≤ 1 at payload level.
- **Room data type**: [`components/dataTypes/room.ts`](components/dataTypes/room.ts) – `lenses?: ReferenceListData`.
- **Client**: [`charcoal-client/.../RoomEdit/LensEditor.tsx`](charcoal-client/src/components/Workbench/RoomEdit/LensEditor.tsx) – treats `room.lenses.payload` as a list; documents "One lens" vs "Multiple lenses" (warning) vs "Zero lenses"; see also [`AGENT.lensEditor.refactor.planning.md`](../charcoal-client/src/components/Workbench/RoomEdit/AGENT.lensEditor.refactor.planning.md).
- **ReferenceList**: [`keys/referenceList.ts`](keys/referenceList.ts) – class with `_items: StandardReference[]`, `toJSON()`, `payload`, merge/diff, etc. No notion of "single slot."

Other components may have similar "actually 0 or 1" relationships; Room → Lens is the one currently documented and used in the client.

---

## 4. Design space: handling, not just shape

The question is not only "what type do we store?" but "how do we handle that slot everywhere it touches the system?"

- **Data shape (open)**: Possibly `lens?: StandardReference` (one optional reference); possibly keep **ReferenceList** (array of length 0 or 1). Either may be the right shape; the pattern for *handling* it is what we need to define. If we keep ReferenceList, we still need a documented convention that this list is "single-reference" (at most one) and that merge/diff/parsing respect that.

- **Preferred implementation**: Introduce a `SingleReference` class that **extends `ReferenceList`**:
  - Enforce a payload length of 0 or 1 (constructor and setters clamp or error on more than one positive entry).
  - Expose a `value` getter/setter that returns `StandardReference | undefined` instead of an array.
  - Override `merge` and `diff` to implement the SingleReference diff envelope (0 or 1 positive, 0 or 1 negative) on top of the existing list-shaped machinery.
  - Provide a small helper/factory (e.g. `toSingleReference`) that can safely convert an existing `ReferenceList` or `ReferenceListData` into a `SingleReference`, surfacing an error if there are multiple positives.

- **Merge**: When we merge an incoming component into a base, and both have a single-reference slot (e.g. Room.lenses): base has LensA, incoming has LensB. What do we do? Replace (result = LensB)? That is a clear rule, but the *mechanism* may still be list-shaped (merge two ReferenceLists of length 1). We need a defined rule and consistent implementation.

- **Diff**: The difference between "Room with LensA" and "Room with LensB" is naturally expressed as **two operations**: remove LensA, add LensB. So the *diff representation* may be a two-item reference list (removals + additions). That suggests we might **have to** support a list-like or ReferenceList-shaped notion for diff (and possibly merge) even when the semantic is "at most one"—otherwise we cannot represent "swap A for B." Open question: does that mean we *must* keep ReferenceList (or a list-shaped diff) for single-reference slots, accepting that the type obscures the semantic, and instead document the pattern in one place?

### SingleReference diff envelope (0 or 1 positive, 0 or 1 negative)

For a SingleReference slot, we can describe its diff/merge behavior in terms of **positive** vs **negative** references:

- **Positive**: "add/set this reference" (e.g. +B).
- **Negative**: "remove this reference if it is present" (e.g. -A).

Envelope constraint for a SingleReference slot:

- At most **one positive** reference in the diff for that slot.
- At most **one negative** reference in the diff for that slot.

Intended semantics (given a base value and a diff for that slot):

- No positive, no negative: no-op.
- Negative only (-A): clear the slot if the current value is A (open question: no-op vs error if base is not A).
- Positive only (+B): set the slot to B, regardless of the current value.
- Negative A and positive B (-A, +B): replace A with B (canonical "swap" case).
- Anything else (2+ positives or 2+ negatives): invalid for a SingleReference slot; should be rejected or surfaced as an error.

This gives us a **small, explicit envelope** for what a valid diff on a SingleReference slot may contain, even if the underlying representation for diff stays list-shaped (ReferenceList or similar). Implementation detail (open): where we enforce the envelope (diff construction, diff application, or both) and how strictly we treat mismatches (hard error vs soft no-op).

- **fromSchema / serialization**: How we parse "at most one" child and emit it (one element vs array-of-one) is orthogonal to merge/diff; we can still enforce 0-or-1 at parse and emit, regardless of whether the runtime type is `StandardReference | undefined` or a ReferenceList of length ≤1.

---

## 5. Integration points

- **StandardComponent / payloads**: Any component that today uses a ReferenceList for a single-optional reference (starting with Room.lenses).
- **fromSchema**: [`components/fromSchemaPipeline.ts`](components/fromSchemaPipeline.ts) – consumers and return remainder; need a consistent way to accept at most one reference and surface exactly one child for processComponents when present (whether we keep ReferenceList or use `StandardReference`).
- **Data types / ReferenceList**: [`keys/dataTypes/reference.ts`](keys/dataTypes/reference.ts), [`keys/referenceList.ts`](keys/referenceList.ts) – may stay as-is, with single-reference semantics documented and enforced in merge/diff/parse; or we introduce a narrower shape and define how it participates in merge/diff.
- **Client**: Room editor and LensEditor – once the type is "single reference," UI can assume 0 or 1 and simplify branching.

---

## 6. Open questions

- **Naming (decided)**: Use **`SingleReference`** as the *pattern name* (and for any runtime/type we introduce). In documentation, clarify that a SingleReference field is **always optional**: components must be valid when completely empty, so the field may be omitted or empty (zero references); "single" means at most one when present, not that the field is required.

- **Data shape**: Is the right storage `lens?: StandardReference` or the existing **ReferenceList**? If ReferenceList: we accept that the type is list-shaped and document the single-reference *semantic* and handling pattern (merge = replace, diff = remove-one/add-one, parse = at most one). If `StandardReference | undefined`: we need to ensure merge/diff and fromSchema can work with that shape (e.g. diff may still produce a list-shaped delta).

- **Merge**: When merging a component that has a single-reference slot, and the incoming value is a different reference (e.g. base has LensA, incoming has LensB): do we always **replace**? How do we express that in the existing merge API (e.g. ReferenceList.merge), and do we need a dedicated single-reference merge convention?

- **Diff**: Diff between "Room with LensA" and "Room with LensB" is naturally "remove LensA, add LensB"—a two-item list. Does that mean we *must* support ReferenceList (or list-shaped diff) for single-reference slots so that diff/merge machinery can represent swap, even though it lends to confusion about the underlying "at most one" meaning? If yes, the pattern is: same list type, documented single-reference semantics and handling rules.

- **WML round-trip**: One `<Lens key=... />` child vs array-of-one in JSON; and where we enforce "at most one" (parse, emit, or both).

---

## 7. Navigation tips

- **Key files**:  
  - [`packages/mtw-wml/ts/standardize/keys/referenceList.ts`](keys/referenceList.ts)  
  - [`packages/mtw-wml/ts/standardize/keys/dataTypes/reference.ts`](keys/dataTypes/reference.ts)  
  - [`packages/mtw-wml/ts/standardize/components/dataTypes/room.ts`](components/dataTypes/room.ts)  
  - [`packages/mtw-wml/ts/standardize/components/room.ts`](components/room.ts)  
  - [`packages/mtw-wml/ts/standardize/components/fromSchemaPipeline.ts`](components/fromSchemaPipeline.ts)
- **Related docs**:  
  - [Standard Components AGENT.md](components/AGENT.md) – component classes and reference properties  
  - [AGENT.implementation.md](components/AGENT.implementation.md) – Reference and ReferenceList description  
  - [Room LensEditor refactor planning](../charcoal-client/src/components/Workbench/RoomEdit/AGENT.lensEditor.refactor.planning.md) – current Lens UI and cardinality handling

---

## 8. Next steps

1. Decide **data shape** for SingleReference slots: `lens?: StandardReference` vs keep ReferenceList; confirm that `SingleReference extends ReferenceList` is the preferred implementation pattern and document optionality (empty = valid).
2. Sketch and implement the `SingleReference` class (constructor invariants, `value` getter/setter, `merge`/`diff` overrides that enforce the diff envelope) plus a helper to convert from `ReferenceList`.
3. Define and test **diff** behavior end-to-end: "remove A, add B" representation, including validation of the 0-or-1 positive / 0-or-1 negative envelope when diffs are constructed and applied.
4. Specify fromSchema and serialization behavior for SingleReference slots (at most one child; how emitted in JSON and WML) and implement or document.
5. Apply the pattern (and, if introduced, the `SingleReference` class) to StandardRoom.lenses (and any other single-reference slots); update client code to rely on the invariant and documented behavior.
6. Document the SingleReference *handling pattern* (including the diff envelope and the `SingleReference extends ReferenceList` pattern) in AGENT.implementation.md and link from this doc.
