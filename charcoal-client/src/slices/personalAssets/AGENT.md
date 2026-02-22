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
| pendingEdits | `{ meta: SchemaMetaTag; edit: StandardFormData }[]` | Edits sent to backend, awaiting RequestIds confirmation |
| inherited | StandardFormData | Data inherited from imports |
| importData | `Record<string, GenericTree<SchemaTag>>` | Import schemata by asset |
| properties | `Record<string, { fileName: string }>` | Asset metadata (e.g. image filenames) |
| loadedImages | `Record<string, PersonalAssetsLoadedImage>` | In-memory image uploads |
| currentWML, draftWML, originalWML | string? | WML text for parse/draft flows |
| serialized | boolean? | Whether current state is serialized |

**Note**: `base` is **not** in PersonalAssetsPublic. It is derived from wmlDataSource and injected at runtime.

**PersonalAssetsInternal**: fetchURL, subscription, error, incrementalBackoff, etc. (SSM internal state)

**PersonalAssetsNodes**: SSM states (INITIAL, INACTIVE, SUBSCRIBE, SUBSCRIBED, SUBSCRIBEBACKOFF, FETCHIMPORTS, FRESH, WMLDIRTY, SCHEMADIRTY, CLEAR, etc.)

### Core Methods

**Public API** (from [index.ts](./index.ts)):

- `addItem({ key, options? })` - Add asset to slice; triggers SSM lifecycle
- `updateStandard(key)(payload)` - **Thunk**. Apply edits; orchestrates base from getWMLBase, dispatches to reducer
- `saveEdit(key)` - Send edit to backend via applyEdit, move to pendingEdits
- `receiveWMLEvent(key)({ header, content })` - Thunk. Handle mtw.wml events: clear pendingEdits by RequestIds, show Merge Conflict toast
- `addImport({ assetId, fromAsset, uuid, tag, addToReferenceList })` - Add import; orchestrates base, dispatches updateStandard
- `getStandardForm(key)(state)`, `getLocalStandardForm(key)(state)`, `getBase(key)(state)` - Selectors (key-scoped)

**Reducers** (from [reducers.ts](./reducers.ts)):

- `updateStandard` - Merges payload.update diffs into edit; uses `payload.base` (from thunk)
- `clearPendingEditsByRequestIds` - Filters pendingEdits by RequestIds
- `saveEdit` - Moves edit to pendingEdits, clears edit

### Configuration

- **multipleSSM** config in [index.ts](./index.ts): `augmentPublicDataForSelect` injects `base: getWMLBase(state, key) ?? EMPTY_BASE` before selectors run
- **EMPTY_BASE**: Fallback when wmlDataSource has no materializedView yet

---

## Integration Points

### Dependencies

- **wmlDataSource** ([../wmlDataSource/](../wmlDataSource/)): Owns `materializedView` (backend WML); personalAssets derives base via `getWMLBase`
- **multipleSSM** ([../stateSeekingMachine/multipleSSM.ts](../stateSeekingMachine/multipleSSM.ts)): SSM factory; `augmentPublicDataForSelect` for base injection
- **lifeLine** ([../lifeLine.ts](../lifeLine.ts)): LifeLinePubSub for mtw.wml StreamEvents; socketDispatch for subscribe/fetch/applyEdit
- **player** slice: `getAssetZone` for Draft vs published (readonly)
- **StandardForm** ([packages/mtw-wml/ts/standardize/](../../../packages/mtw-wml/ts/standardize/AGENT.md)): Merge, diff, toJSON

### Cross-References

- **Workbench**: [charcoal-client/src/components/Workbench/AGENT.md](../components/Workbench/AGENT.md) - Consumes `getStandardForm`, `updateStandard`, `getStatus` via `useWorkbenchAsset`
- **Subscriber Sync Refactor**: [lambda/wml/AGENT.subscriberSync.refactor.planning.md](../../../lambda/wml/AGENT.subscriberSync.refactor.planning.md) - Migration plan; items 2.2/2.3 done (base derived from dataSource)
- **Root AGENT.md**: [AGENT.md](../../../AGENT.md) - Documentation standards, navigation

### API Contracts

- **updateStandard(key)(payload)**: Payload is `UpdateStandardPayload` (setInherited | update | updateLocal | removeComponent). The thunk adds `base` internally; callers do not pass base.
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

**Adding an import**:

```typescript
dispatch(addImport({
    assetId: 'ASSET#myAsset',
    fromAsset: 'ASSET#other',
    uuid: 'ROOM#room1',
    tag: 'Room',
    addToReferenceList: getTopLevelAddToReferenceList
}))
```

**Reading standard form** (with base derived from wmlDataSource):

```typescript
const standardForm = useSelector(getStandardForm(assetId))
```

### Best Practices

- Use the **thunk** `updateStandard(key)(payload)` from index.ts, not `publicActions.updateStandard` directly, unless you orchestrate base yourself (e.g. addImport)
- Do not mutate `edit` or `pendingEdits` outside reducers
- Base is authoritative from wmlDataSource; personalAssets never writes base

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
- [AGENT.subscriberSync.refactor.planning.md](../../../lambda/wml/AGENT.subscriberSync.refactor.planning.md)
- [Standard Form AGENT.md](../../../packages/mtw-wml/ts/standardize/AGENT.md)

---

## Development Notes

### Current State

- Base is derived from wmlDataSource (2.2, 2.3 done)
- subscribeAction replaces fetchAction; no WML fetch; getFetchURL for properties only; wmlDataSource owns subscribe
- clearAction unsubscribes LifeLine listener and delegates mtw.wml unsubscribe to wmlDataSource (2.5 done)
- Client Work Item 2 (personalAssets refactor) complete

### Future Plans

- **fetchAction refactor** (Work Item 2.4): Done. subscribeAction subscribes via wmlDataSource; initial state from Snapshot (sidecar); no direct fetch for WML body
- **clearAction** (2.5): Done. Unsubscribe LifeLine listener; delegate mtw.wml unsubscribe to wmlDataSource (no personalAssets socket unsubscribe)
- **SSM restructure** (2.6): Done. Collapse to Subscribe -> HOLD (until getWMLBase defined) -> FETCHIMPORTS/FRESH

### Technical Debt

- Reducer `updateStandard` and thunk share the name; consider renaming reducer to `updateStandardReducer` for clarity
- `payload.base` in UpdateStandardPayload is internal; documentation could clarify it is thunk-supplied only
