# personalAssets Slice - Agent Navigation Guide

## Overview

### Purpose

The **personalAssets** slice manages per-asset WML editing state for the authoring Workbench. It owns optimistic edits (`edit`, `pendingEdits`), derives the backend "base" view from the WML dataSource, and coordinates the fetch/subscribe lifecycle for open assets. It is the primary data source for the Workbench editing UI.

### Context

personalAssets sits between the [Workbench](../components/Workbench/AGENT.md) (form-based editing UI) and the [wmlDataSource](../wmlDataSource/index.ts) (canonical backend view). It uses the [multipleSSM](../stateSeekingMachine/multipleSSM.ts) pattern: each asset is a separate state machine instance (byId keyed by assetId) with an SSM-driven lifecycle (INITIAL -> SUBSCRIBE -> SUBSCRIBED -> FETCHIMPORTS -> FRESH, etc.). The slice does **not** own the backend WML view; base is derived from `wmlDataSource.subscribedStreams[assetId]?.materializedView` via `augmentPublicDataForSelect`.

### Key Concepts

- **base**: The canonical backend WML view for an asset. **Derived** from wmlDataSource, not stored in personalAssets. Injected by `augmentPublicDataForSelect` for selectors and by the `updateStandard` thunk for the reducer.
- **edit**: The current in-memory edits (StandardFormData delta) since last save. Stored in slice.
- **pendingEdits**: Edits that have been sent to the backend (applyEdit) but not yet confirmed via Content Update RequestIds.
- **inherited**: Standard form data inherited from imports (from other assets).
- **StandardForm / StandardFormData**: WML representation; see [Standard Form](../../../packages/mtw-wml/ts/standardize/AGENT.md).
- **Local vs merged StandardForm**: **`getLocalStandardForm`** (base + edit + pendingEdits) holds this asset's **edit-layer** WML --- `ref={0}` top-level import stubs, negative refs, etc. Workbench orphan GC and **`previewOrphanClosure`** use the **local** form only. **`getStandardForm`** merges inherited import ancestry with local edits for **display**; inherited refs do **not** count as local references for Workbench normalize. See [consistency AGENT.md](../components/Workbench/foundations/consistency/AGENT.md#stored-wml-vs-displayed-ui).
- **updateStandard (thunk vs reducer)**: The public `updateStandard(key)(payload)` in [index.ts](./index.ts) is a **thunk** that orchestrates base from getWMLBase and dispatches. The reducer `updateStandard` in [reducers.ts](./reducers.ts) is internal; it receives base via the action payload.

---

## Core Purpose

### Primary Function

Manage per-asset editing state and lifecycle so the Workbench can:

- Load assets (fetch URL, parse WML, subscribe to mtw.wml)
- Apply optimistic edits via `updateStandard`
- Persist edits via `saveEdit` (applyEdit over WebSocket)
- Clear `pendingEdits` when the backend confirms via Content Update RequestIds
- Handle Merge Conflict toasts

### Key Responsibilities

- **Lifecycle**: SSM-driven subscribe (SUBSCRIBE -> SUBSCRIBED -> FETCHIMPORTS -> FRESH), clear, and error/backoff states
- **Optimistic state**: `edit`, `pendingEdits`; diff-based merge via `updateStandard` reducer
- **Base derivation**: Base comes from wmlDataSource; selectors receive it via `augmentPublicDataForSelect`, reducer via thunk-supplied `payload.base`
- **RequestIds clearing**: `receiveWMLEvent` thunk listens to mtw.wml events, extracts RequestIds, dispatches `clearPendingEditsByRequestIds`
- **Merge Conflict toast**: Shown when Merge Conflict event carries RequestIds matching pendingEdits

---

## Technical Details

### Data Structures

**PersonalAssetsPublic** ([baseClasses.ts](./baseClasses.ts)):

| Field | Type | Description |
|-------|------|-------------|
| edit | StandardFormData | Current in-memory edits (delta since last save) |
| pendingEdits | `{ meta: PendingEditMeta; edit: StandardFormData }[]` | Edits sent to backend, awaiting RequestIds confirmation |
| inherited | StandardFormData | Data inherited from imports |
| importData | `Record<string, GenericTree<SchemaTag>>` | Import schemata by asset |
| properties | `Record<string, { fileName: string }>` | Asset metadata (e.g. image filenames) |
| loadedImages | `Record<string, PersonalAssetsLoadedImage>` | In-memory image uploads |
| serialized | boolean? | Whether current state is serialized |

**Note**: `base` is **not** in PersonalAssetsPublic. It is derived from wmlDataSource and injected at runtime.

**PersonalAssetsInternal**: subscription, error, incrementalBackoff, etc. (SSM internal state)

**PersonalAssetsNodes**: SSM states (INITIAL, INACTIVE, SUBSCRIBE, SUBSCRIBED, SUBSCRIBEBACKOFF, FETCHIMPORTS, FRESH, SCHEMADIRTY, CLEAR, etc.)

### Core Methods

**Public API** (from [index.ts](./index.ts)):

- `addItem({ key, options? })` - Add asset to slice; triggers SSM lifecycle
- `updateStandard(key)(payload)` - **Thunk**. Apply edits; orchestrates base from getWMLBase, dispatches to reducer
- `saveEdit(key)` - Send edit to backend via applyEdit, move to pendingEdits
- `receiveWMLEvent(key)({ header, content })` - Thunk. Handle mtw.wml events: clear pendingEdits by RequestIds, show Merge Conflict toast
- `addImportToDraft(draft, { fromAsset, uuid, tag })` - Pure helper (re-exported from [addImportToDraft.ts](./addImportToDraft.ts)). Mutates a draft to add or update an imported component. Callers combine it with `updateStandard` from `useWorkbenchAsset` (or the `updateStandard` thunk) and optional `getTopLevelAddToReferenceList` / custom descriptors to place the new reference. See Usage Patterns.
- `assureDefaultSituationFromPrimitives(draft, fromAsset?)` - Pure helper: ensures draft has SITUATION#DEFAULT imported from primitives; mutates draft, returns true if it made a change. See below.
- `getStandardForm(key)(state)`, `getLocalStandardForm(key)(state)`, `getBase(key)(state)` - Selectors (key-scoped)

**Reducers** (from [reducers.ts](./reducers.ts)):

- `updateStandard` - Merges payload.update diffs into edit; uses `payload.base` (from thunk)
- `clearPendingEditsByRequestIds` - Filters pendingEdits by RequestIds
- `saveEdit` - Moves edit to pendingEdits, clears edit

### assureDefaultSituationFromPrimitives

- **What it does**: Ensures the given StandardForm draft has a `SITUATION#DEFAULT` component imported from the primitives asset (so situation facets referencing it can be edited). Mutates the draft in place; returns `true` if the draft was modified (component added or import updated), `false` if it already had the correct import.
- **When to use it**: Before editing default situation facets (e.g. default description) in Room edit, so that the component exists and is marked as from primitives. Supports the two-tier Room edit model (default render "above the fold," Lens/Guidance/Situations "below the fold").
- **Usage pattern (Option 2)**: Call it at the start of the `update` callback inside `updateStandard(assetId)({ type: 'update', update: (draft) => { ... } })`. Use the boolean return to decide whether to dispatch `fetchImports(assetId)` after dispatching `updateStandard`. The component may appear with fallback shortName ("Untitled") until import defaults arrive; that eventual consistency is expected.

Defined in [assureDefaultSituationFromPrimitives.ts](./assureDefaultSituationFromPrimitives.ts); tests in [assureDefaultSituationFromPrimitives.test.ts](./assureDefaultSituationFromPrimitives.test.ts).

### Configuration

- **multipleSSM** config in [index.ts](./index.ts): `augmentPublicDataForSelect` injects `base: getWMLBase(state, key) ?? EMPTY_BASE` before selectors run
- **EMPTY_BASE**: Fallback when wmlDataSource has no materializedView yet

---

## Integration Points

### Dependencies

- **wmlDataSource** ([../wmlDataSource/](../wmlDataSource/)): Owns `materializedView` (backend WML); personalAssets derives base via `getWMLBase`
- **multipleSSM** ([../stateSeekingMachine/multipleSSM.ts](../stateSeekingMachine/multipleSSM.ts)): SSM factory; `augmentPublicDataForSelect` for base injection
- **lifeLine** ([../lifeLine.ts](../lifeLine.ts)): socketDispatch for applyEdit
- **streamEventPubSub** ([../dataSource/streamEventPubSub/](../dataSource/streamEventPubSub/)): Pre-deserialized mtw.wml StreamEvents for receiveWMLEvent
- **player** slice: `getAssetZone` for Draft vs published (readonly)
- **StandardForm** ([packages/mtw-wml/ts/standardize/](../../../packages/mtw-wml/ts/standardize/AGENT.md)): Merge, diff, toJSON

### WML dataSource integration

- **Subscribe/unsubscribe ownership**: wmlDataSource owns mtw.wml subscribe/unsubscribe. personalAssets triggers via `subscribeToStreams([id])` / `unsubscribeFromStreams([id])`; personalAssets does **not** send subscribe/unsubscribe messages itself.
- **Same-tick re-render**: One StreamEvent arrives. wmlDataSource updates `materializedView`; personalAssets clears `pendingEdits` by RequestIds. Both run in the same tick; components see consistent base and pendingEdits in one re-render.
- **Merge Conflict**: personalAssets keeps a StreamEventPubSub subscription that receives pre-deserialized mtw.wml events and runs toast logic + `clearPendingEditsByRequestIds`. No dataSource-dispatched Merge Conflict action.

### Deprecated: Image properties (fetch)

As of the properties deprecation, personalAssets no longer fetches properties via `message: 'fetch'`.
Image metadata (filenames) is stubbed as `{}`. Character icons and ImageHeader display broken until the
image uuid-as-filename refactor. To restore: (1) Add source for properties (new API or derived from WML
image uuid); (2) Populate properties in subscribeAction or equivalent; (3) `useLibraryImageURL` will
resume working once `properties[key]` is set. See subscribeAction deprecation comment in index.api.ts.

### Cross-References

- **Workbench**: [charcoal-client/src/components/Workbench/AGENT.md](../components/Workbench/AGENT.md) - Consumes `getStandardForm`, `updateStandard`, `getStatus` via `useWorkbenchAsset`. Component editors batch field edits through `useWorkbenchComponent` session flush; this slice's `updateStandard` reducer diff semantics are unchanged.
- **wmlDataSource**: [../wmlDataSource/AGENT.md](../wmlDataSource/AGENT.md) - Canonical backend WML view; owns subscribe/unsubscribe
- **Root AGENT.md**: [AGENT.md](../../../AGENT.md) - Documentation standards, navigation

### API Contracts

- **updateStandard(key)(payload)**: Payload is `UpdateStandardPayload` (setInherited | update | updateLocal | removeComponent). The thunk adds `base` internally; callers do not pass base.

  **Workbench consistency (local edit path):** Workbench authoring uses **`type: 'updateLocal'`** on the local draft for eager **materialize** ([`materializeComponentInAsset`](../components/Workbench/foundations/consistency/materializeComponentInAsset.ts)) and session **flush** ([`applyWorkbenchFlush`](../components/Workbench/foundations/consistency/applyWorkbenchFlush.ts), [`applyAssetMetaFlush`](../components/Workbench/foundations/consistency/applyAssetMetaFlush.ts) via session hooks). **`normalizeWorkbenchDraft`** runs **only** inside those flush helpers --- not on every `updateStandard` dispatch. See [consistency AGENT.md](../components/Workbench/foundations/consistency/AGENT.md).

  **WML vs Workbench orphan policy:** Generic WML merge retains unreferenced components **with content** (supports `ref={0}` editing). Workbench **`normalizeWorkbenchDraft`** removes such bodies when **`!isReferencedInAssetLayer`** on the **local** form. The reducer **`removeComponent`** branch accepts **`cascade?: boolean`** (default **`true`**); explicit Workbench **Purge** uses [`purgeComponentInAsset`](../components/Workbench/foundations/consistency/purgeComponentInAsset.ts) with the author's rehome/cascade choice. List rows and site-specific deletes do not call **`removeComponent`** today.
- **Selectors**: All key-scoped; e.g. `getStandardForm(assetId)(state)`. Return undefined if asset not in slice.
- **receiveWMLEvent**: Guards on `header.dataSourceKey === 'mtw.wml'` and `RequestIds`; no-op if missing.

### System Relationships

```
Workbench (useWorkbenchAsset)
    -> updateStandard, getStandardForm, getLocalStandardForm
        -> personalAssets (thunk + selectors)
            -> wmlDataSource (getWMLBase for base)
            -> lifeLine (applyEdit, subscribe)
```

---

## Usage Patterns

### Common Scenarios

**Editing a component** (from Workbench):

```typescript
const { updateStandard } = useWorkbenchAsset()
updateStandard({
    type: 'update',
    update: (draft) => {
        draft.byUniversalId['EXAMPLE#base']._payload._displayName = new StandardRender(['New Name'])
        return draft
    }
})
```

**Adding an import** (Workbench pattern: `addImportToDraft` inside `updateStandard`; `useWorkbenchAsset` already dispatches intent and heartbeat):

```typescript
// addImportToDraft, getTopLevelAddToReferenceList from personalAssets/index
const { updateStandard } = useWorkbenchAsset()
updateStandard({
    type: 'update',
    update: (draft) => {
        const ref = addImportToDraft(draft, {
            fromAsset: 'ASSET#other',
            uuid: 'ROOM#room1',
            tag: 'Room'
        })
        const descriptor = getTopLevelAddToReferenceList(draft)
        if (ref && descriptor) descriptor.setReferenceList(descriptor.referenceList.assureItem(ref))
        return draft
    }
})
```

**Reading standard form** (with base derived from wmlDataSource):

```typescript
const standardForm = useSelector(getStandardForm(assetId))
```

### Best Practices

- Use the **thunk** `updateStandard(key)(payload)` from index.ts, not `publicActions.updateStandard` directly, unless you orchestrate base yourself (e.g. tests or advanced tooling)
- Do not mutate `edit` or `pendingEdits` outside reducers
- Base is authoritative from wmlDataSource; personalAssets never writes base

### Local key assignment tests (`reducers.test.ts`)

Tests under **`local key assignment`** validate the reducer **diff/merge** path when a component gains a local key via `updateStandard`. They intentionally separate expectations:

- **`edit`**: minimal delta (usually a `Room` stub with `key=(...)` only).
- **`standard` / `calculated`**: display WML where universal exit/map targets may resolve to the new local key via `StandardForm.schema` mappings.

That is **not** the same as merge-time stored retarget of all references; see **`standardForm.keyChangesViaMerge.test.ts`** in mtw-wml for `<Key>` Replace merge behavior (exits, map positions, situation facet prose links).

### Error Handling

- `FETCHERROR`, `SUBSCRIBEBACKOFF`: SSM handles retries with incremental backoff
- Merge Conflict: Toast shown when `receiveWMLEvent` sees Merge Conflict with matching RequestIds

---

## Navigation Tips

### Getting Started

1. **Read [baseClasses.ts](./baseClasses.ts)** - Types (`PersonalAssetsPublic`, `PersonalAssetsNodes`)
2. **Read [index.ts](./index.ts)** - Public API, multipleSSM config, thunks
3. **Read [reducers.ts](./reducers.ts)** - updateStandard reducer logic (diff/merge)
4. **Read [selectors.ts](./selectors.ts)** - getBase, getLocalStandardForm, getStandardForm
5. **Read [index.api.ts](./index.api.ts)** - SSM actions (subscribeAction, clearAction, etc.)

### Key Files

| File | Purpose |
|------|---------|
| [index.ts](./index.ts) | Slice creation, public API, thunks |
| [baseClasses.ts](./baseClasses.ts) | Types |
| [reducers.ts](./reducers.ts) | Reducers |
| [selectors.ts](./selectors.ts) | Selectors (base derived via augmenter) |
| [index.api.ts](./index.api.ts) | SSM actions (fetch, clear, fetchImports, etc.) |

### Related Documentation

- [Workbench AGENT.md](../components/Workbench/AGENT.md)
- [wmlDataSource AGENT.md](../wmlDataSource/AGENT.md)
- [Standard Form AGENT.md](../../../packages/mtw-wml/ts/standardize/AGENT.md)

---

## Development Notes

### Current State

- Base derived from wmlDataSource; subscribeAction triggers wmlDataSource subscribe; clearAction delegates mtw.wml unsubscribe to wmlDataSource
- Properties (image metadata) deprecated and stubbed as `{}` until image uuid-as-filename refactor

### Future Plans

- **Restore image properties**: When image uuid-as-filename refactor lands, add properties source and populate in subscribeAction; useLibraryImageURL will resume

### Technical Debt

- Reducer `updateStandard` and thunk share the name; consider renaming reducer to `updateStandardReducer` for clarity
- `payload.base` in UpdateStandardPayload is internal; documentation could clarify it is thunk-supplied only
