# personalAssets Slice - Agent Navigation Guide

## Overview

### Purpose

The **personalAssets** slice manages per-asset WML editing state for the authoring Workbench. It owns optimistic edits (`edit`, `pendingEdits`), derives the backend "base" view from the WML dataSource, and coordinates the fetch/subscribe lifecycle for open assets. It is the primary data source for the Workbench editing UI.

### Context

personalAssets sits between the [Workbench](../components/Workbench/AGENT.md) (form-based editing UI) and the [wmlDataSource](../wmlDataSource/index.ts) (canonical backend view). It uses the [multipleSSM](../stateSeekingMachine/multipleSSM.ts) pattern: each asset is a separate state machine instance (byId keyed by assetId) with an SSM-driven lifecycle (INITIAL -> SUBSCRIBE -> SUBSCRIBED -> FETCHIMPORTS -> FRESH, etc.). The slice does **not** own the backend WML view; base is derived from `wmlDataSource.subscribedStreams[assetId]?.materializedView` via `augmentPublicDataForSelect`.

### Key Concepts

- **base**: The canonical backend WML view for an asset. **Derived** from wmlDataSource, not stored in personalAssets. Injected by `augmentPublicDataForSelect` for selectors and by the `updateStandard` thunk for the reducer.
- **edit**: The current in-memory edits (StandardFormData delta) since last save. Stored in slice.
- **pendingEdits**: In-flight outbound edits. Each row is enqueued **optimistically** when `saveEdit` runs (before `applyEdit` is sent); confirmed when a stream Content Update clears it by `RequestId`.
- **inherited**: Standard form data inherited from imports (from other assets).
- **StandardForm / StandardFormData**: WML representation; see [Standard Form](../../../packages/mtw-wml/ts/standardize/AGENT.md).
- **Local vs merged StandardForm**: **`getLocalStandardForm`** (base + edit + **effective** pending overlay) holds this asset's **edit-layer** WML --- `ref={0}` top-level import stubs, negative refs, etc. Effective pending excludes rows whose `meta.key` is in wmlDataSource confirmed RequestIds and rows older than 3 minutes (`getEffectivePendingEdits`); raw `pendingEdits` remains for the saving indicator. Workbench **Purge** and site-local disassociate simulation use the **local** form only. **`getStandardForm`** merges inherited import ancestry with local edits for **display**. See [consistency AGENT.md](../components/Workbench/foundations/consistency/AGENT.md#stored-wml-vs-displayed-ui).
- **Terminology (avoid overloaded "local")**:

| Term | Meaning |
| --- | --- |
| **Edit-layer** | `getLocalStandardForm` / `updateLocal` baseline: this asset's WML only (`base + effectivePendingEdits + edit`), no `inherited` folded in. |
| **Merged view** | `getStandardForm`: `inherited.merge(localStandardForm)` --- display and component session **`committed` / `working`**. |
| **Session working copy** | In-memory `working` in `useWorkbenchComponent` / `useWorkbenchAssetMeta` --- not the same as edit-layer or `updateLocal`. |

- **updateStandard (thunk vs reducer)**: The public `updateStandard(key)(payload)` in [index.ts](./index.ts) is a **thunk** that orchestrates base from getWMLBase and dispatches. The reducer `updateStandard` in [reducers.ts](./reducers.ts) is internal; it receives base via the action payload.

---

## Core Purpose

### Primary Function

Manage per-asset editing state and lifecycle so the Workbench can:

- Load assets (fetch URL, parse WML, subscribe to mtw.wml)
- Apply optimistic edits via `updateStandard`
- Persist edits via `saveEdit` (optimistic enqueue to `pendingEdits`, then `applyEdit` over WebSocket)
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
| pendingEdits | `{ meta: PendingEditMeta; edit: StandardFormData }[]` | In-flight outbound edits (optimistic enqueue; cleared by stream RequestIds) |
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
- `saveEdit(key)` - **Thunk**. Enqueues `edit` to `pendingEdits` (optimistic), sends `applyEdit` with client `requestId`, reverts on wire failure if the pending row still exists
- `receiveWMLEvent(key)({ header, content })` - Thunk. Handle mtw.wml events: clear pendingEdits by RequestIds, show Merge Conflict toast
- `addImportToDraft(draft, { fromAsset, uuid, tag })` - Pure helper (re-exported from [addImportToDraft.ts](./addImportToDraft.ts)). Mutates a draft to add or update an imported component. Callers combine it with `updateStandard` from `useWorkbenchAsset` (or the `updateStandard` thunk) and optional `getTopLevelAddToReferenceList` / custom descriptors to place the new reference. See Usage Patterns.
- `assureDefaultSituationFromPrimitives(draft, fromAsset?)` - Pure helper: ensures draft has SITUATION#DEFAULT imported from primitives; mutates draft, returns true if it made a change. See below.
- `getStandardForm(key)(state)`, `getLocalStandardForm(key)(state)`, `getBase(key)(state)`, `getEffectivePendingEdits(key)(state)`, `getPendingEdits(key)(state)` - Selectors (key-scoped); `getPendingEdits` is raw storage, `getEffectivePendingEdits` is for merge views

**Reducers** (from [reducers.ts](./reducers.ts)):

- `updateStandard` - Merges payload.update diffs into edit; uses `payload.base` (from thunk)
- `clearPendingEditsByRequestIds` - Filters pendingEdits by RequestIds
- `saveEdit` - Moves edit to pendingEdits, clears edit (invoked **before** `applyEdit` send)
- `revertSaveEdit` - On `applyEdit` wire failure: if a pending row for `requestId` still exists, remove it and merge its snapshot back into `edit`; no-op if stream already cleared the row

### Optimistic persist flow (`saveEdit`)

1. Guard: exit if `edit` is empty.
2. Generate client `requestId` (`uuidv4()`).
3. Dispatch `saveEdit` reducer (enqueue pending, clear `edit`).
4. Build WML from the new pending row snapshot (not from `state.edit`, which is now cleared).
5. `await socketDispatchPromise({ message: 'applyEdit', RequestId: requestId, ... })`.
6. On reject: dispatch `revertSaveEdit({ requestId })` only when the pending row still exists.

The WebSocket ack confirms delivery; it does **not** enqueue pending. Stream Content Updates clear pending by `RequestId` and bump `base` via wmlDataSource.

**Race fix:** Previously pending was enqueued **after** ack. Stream could arrive first, update `base`, and leave the same content in `edit` with no matching pending row --- `getLocalStandardForm` then merged duplicate overlays (e.g. doubled `shortName`). Optimistic enqueue ensures every client-originated `RequestId` has a pending row before send.

**In-flight edits during rollback:** `revertSaveEdit` merges the pending snapshot **into** current `edit`, not replace --- the user may have typed into a fresh `edit` while save was in flight.

**Saving indicator:** `useWorkbenchAsset` sets `saving: pendingEdits.length > 0`, so the indicator appears at enqueue (before WS RTT completes).

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
- **Same-tick re-render**: One StreamEvent arrives. wmlDataSource updates `materializedView`; personalAssets clears `pendingEdits` by RequestIds. **`registerPersonalAssetsWmlStreamHandlers`** uses `StreamEventPubSub.subscribeFirst` at store init so pending clears **before** wmlDataSource merges Content Update onto base (avoids `base + pending` double overlay).
- **Merge Conflict**: Global `StreamEventPubSub.subscribeFirst` handler (`wmlStreamHandlers.ts`, registered at store init) runs toast logic + `clearPendingEditsByRequestIds` before wmlDataSource applies Content Update. No dataSource-dispatched Merge Conflict action.

### Deprecated: Image properties (fetch)

As of the properties deprecation, personalAssets no longer fetches properties via `message: 'fetch'`.
Image metadata (filenames) is stubbed as `{}`. Character icons and ImageHeader display broken until the
image uuid-as-filename refactor. To restore: (1) Add source for properties (new API or derived from WML
image uuid); (2) Populate properties in subscribeAction or equivalent; (3) `useLibraryImageURL` will
resume working once `properties[key]` is set. See subscribeAction deprecation comment in index.api.ts.

### Cross-References

- **Workbench**: [charcoal-client/src/components/Workbench/AGENT.md](../components/Workbench/AGENT.md) - Consumes `getStandardForm`, `updateStandard`, `getStatus` via `useWorkbenchAsset`. Component editors batch field edits through `useWorkbenchComponent` session flush; opcode choice is documented in [updateStandard perspectives (Workbench)](#updatestandard-perspectives-workbench) below.
- **wmlDataSource**: [../wmlDataSource/AGENT.md](../wmlDataSource/AGENT.md) - Canonical backend WML view; owns subscribe/unsubscribe
- **Root AGENT.md**: [AGENT.md](../../../AGENT.md) - Documentation standards, navigation

### API Contracts

- **updateStandard(key)(payload)**: Payload is `UpdateStandardPayload` (setInherited | update | updateLocal | removeComponent). The thunk adds `base` internally; callers do not pass base. Workbench opcode rules: [updateStandard perspectives (Workbench)](#updatestandard-perspectives-workbench).

### updateStandard perspectives (Workbench)

Both **`update`** and **`updateLocal`** persist via the same `mergeToEdit` into `state.edit`; the difference is **which draft the diff is computed against** ([`reducers.ts`](./reducers.ts)).

| Caller intent | Payload | Diff baseline | Notes |
| --- | --- | --- | --- |
| Display-shaped / inherited overlays | `update` | Merged `standardForm` | **Component session flush**; ad hoc edits that match author display |
| Edit-layer only | `updateLocal` | `localStandardForm` | **Materialize** ([`materializeComponentInAsset`](../components/Workbench/foundations/consistency/materializeComponentInAsset.ts)), **asset-meta flush** ([`applyAssetMetaFlush`](../components/Workbench/foundations/consistency/applyAssetMetaFlush.ts)); no inherited fold-in |
| Remove body from this asset | `removeComponent` | vs `localStandardForm` | **Purge** only; list-row remove and site disassociates **must not** use this |

**Why component flush uses `update`:** Component session **`working`** / **`committed`** come from **`getStandardForm`** (merged). Flushing with **`updateLocal`** and wholesale assign on the edit-layer baseline produced wrong merged display under inheritance (e.g. plain literal **concat** across inherited and local `shortName` --- `"LobbyLobby in the pitch-black"`). **`type: 'update'`** runs `standardForm.diff(modified)` so the persist delta matches author display. Regression: [`reducers.test.ts`](./reducers.test.ts) inherited shortName gate.

**Why asset-meta flush stays `updateLocal`:** Asset-meta session **`working`** is built from **local** `committed` only ([`useWorkbenchAssetMeta`](../components/Workbench/foundations/WorkbenchAssetMeta/useWorkbenchAssetMeta.tsx)); asset `ShortName` / `Summary` / `_topLevel` are not layered through import inheritance the way component bodies are.

**Deferred `type: 'batch'`:** Not in the reducer union today. Reserved as a **future fallback** if multi-step baselines (e.g. ordered `updateLocal` then merged persist) are required; the 2026-06 spike showed **`update`** alone fixes the inherited shortName bug class.

**Purge vs `removeComponent`:** List-row **remove** and site **disassociate** only drop a reference at one site; bodies stay on the local draft until explicit **Purge**. Purge dispatches via [`purgeComponentInAsset`](../components/Workbench/foundations/consistency/purgeComponentInAsset.ts) with author choice **rehome** (`cascade: false`) or **cascade** (`cascade: true`, reducer default for non-Workbench callers). See [consistency AGENT.md](../components/Workbench/foundations/consistency/AGENT.md).

**WML vs Workbench body retention:** Generic WML merge retains unreferenced components **with content** (supports `ref={0}` editing). Workbench list **remove** leaves bodies on the local draft until **Purge**.
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
