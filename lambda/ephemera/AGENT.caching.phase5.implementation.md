# Phase 5: Preview UI - Implementation Plan (Cursor-Plan)

**Source**: [AGENT.caching.firstMVP.planning.md](./AGENT.caching.firstMVP.planning.md) Phase 5 (revised).  
**Organization**: Preview is a **separate section that authors navigate down into from the Room**, not an inline accordion inside the Room editor. Breadcrumb flow: Asset > Room > Preview.

**Implementation status: Complete.** The following was implemented: backend RequestId in ReturnValue; lifeLine parse of Lambda `{ statusCode, body }` and re-publish as `LifeLinePubSubData`; WorkbenchAssetEditor route for `preview:*` to RoomPreviewEditor; WorkbenchContainer breadcrumb label "Preview" for synthetic id; RoomEditor Preview entry point (Open Preview when one Lens + at least one Mark); new RoomPreviewEditor (Mark inputs, Generate, result/error, socketDispatchPromise, EphemeraRoomId cast); app.generateRoomPreview.test.ts updated to expect RequestId in body.

---

## 1. Navigation model

- **Entry point**: From the Room editor, show an entry that opens Preview (e.g. "Preview" link or button in the Room view, alongside or near Examples/Guidance).
- **Breadcrumb**: Clicking it **navigates** to Preview so the stack becomes `[Room, Preview]`. The workbench content area then shows the Preview view only (same pattern as navigating to an Example or Guidance).
- **Synthetic view id**: Preview is not a component in `standardForm`. Use a **synthetic breadcrumb id** so the workbench can route to a dedicated Preview editor and know which Room it belongs to. Recommended: `preview:${roomId}` (e.g. `preview:ROOM#uuid`). When the user clicks "Preview" in the Room editor, dispatch `pushBreadcrumb({ id: \`preview:${roomId}\`, kind: 'component', componentId: \`preview:${roomId}\` })`.
- **Routing**: In `WorkbenchAssetEditor`, before or after the existing component-type checks: if `currentComponentId` is a string that matches the Preview synthetic id pattern (e.g. `currentComponentId?.startsWith('preview:')`), parse `roomId` from it and render **RoomPreviewEditor** (or equivalent). Do not look up `currentComponentId` in `standardForm` for this branch.

---

## 2. Room editor: Preview entry point

- **File**: [charcoal-client/src/components/Workbench/RoomEdit/RoomEditor.tsx](charcoal-client/src/components/Workbench/RoomEdit/RoomEditor.tsx)
- **Change**: Add a way to open Preview from the Room (e.g. a "Preview" list item or button). When the Room has at least one Lens with at least one Mark, the entry is enabled; otherwise disable it or hide it and optionally show "Add a Lens with Marks to use Preview."
- **Action**: On click, `dispatch(pushBreadcrumb({ id: \`preview:${universalKey}\`, kind: 'component', componentId: \`preview:${universalKey}\` }))` so the workbench navigates to the Preview view for that Room.

---

## 3. WorkbenchAssetEditor: route to Preview view

- **File**: [charcoal-client/src/components/Workbench/WorkbenchAssetEditor.tsx](charcoal-client/src/components/Workbench/WorkbenchAssetEditor.tsx)
- **Change**: When `currentView === 'component' && currentComponentId` and `currentComponentId` is the synthetic Preview id (e.g. `currentComponentId.startsWith('preview:')`), parse `roomId` (e.g. `currentComponentId.replace(/^preview:/, '')`) and return `<RoomPreviewEditor roomId={roomId} />`. Place this branch so it runs before the `standardForm.byUniversalId[currentComponentId]` lookup (since the synthetic id will not exist in the form).

---

## 4. RoomPreviewEditor (new component)

- **Location**: e.g. [charcoal-client/src/components/Workbench/RoomEdit/RoomPreviewEditor.tsx](charcoal-client/src/components/Workbench/RoomEdit/RoomPreviewEditor.tsx) (or `RoomPreview/` if preferred).
- **Props**: `roomId: ComponentUUID` (EphemeraRoomId).
- **Responsibilities**:
  - Resolve the Room and its single Lens + Marks from `useWorkbenchAsset().standardForm` (same logic as LensEditor: one Lens, then `lens.marks.payload` resolved to `StandardMark[]`). If no Lens or no Marks, show "Add a Lens with Marks to use Preview" and no inputs.
  - **Mark inputs**: One row per Mark (label = `mark.shortName` or "Untitled", value = controlled text input). Hold state in local state (e.g. `useState<Record<string, string>>` keyed by Mark UUID).
  - **Generate button**: Builds `markState: { markValue: [{ mark: markId, value }, ...] }` and `assetStack` from `inheritedByAssetId` + current `AssetId`, then dispatches `socketDispatchPromise({ message: 'generateRoomPreview', RoomId: roomId, markState, assetStack, RequestId }, { service: 'ephemera' })`. Disable while loading; show loading state.
  - **Result area**: On success, show `renderedContent.displayName`, `renderedContent.summary`, `renderedContent.description` (first draft: plain text, e.g. reuse `renderTreeToPlainText`-style logic from LensEditor). On error, show `errorMessage` (and optionally `errorCode`).
- **Breadcrumb**: User can go back via the workbench breadcrumb (pop to Room). No change needed if the stack is already [Room, Preview].

---

## 5. Backend: RequestId in ReturnValue

- **File**: [lambda/ephemera/app.ts](lambda/ephemera/app.ts)
- **Change**: When sending the ReturnValue for `generateRoomPreview`, include the request's `RequestId` in the body so the client can correlate the WebSocket response. Example: `messageBus.send({ type: 'ReturnValue', body: { generateRoomPreview: result, ...(request.RequestId && { RequestId: request.RequestId }) } })`.
- **Done**: Implemented; [app.generateRoomPreview.test.ts](lambda/ephemera/app.generateRoomPreview.test.ts) expects `RequestId: 'request-123'` in the body.

---

## 6. Client: response handling and correlation

- The Ephemera Lambda returns `{ statusCode: 200, body: JSON.stringify(body) }`. The client may receive that object over the WebSocket. The `socketDispatchPromise` subscriber matches on top-level `RequestId`; if the server includes `RequestId` in the merged body, the client may need to **parse `payload.body`** when present and use the parsed object for matching and for the result (so that `RequestId` and `generateRoomPreview` are available).
- **Done**: Option (a) implemented in [charcoal-client/src/slices/lifeLine/index.api.ts](charcoal-client/src/slices/lifeLine/index.api.ts). When a message has `statusCode` and string `body`, we `JSON.parse(payload.body)` and publish the result as `LifeLinePubSubData` so subscribers see top-level `RequestId` and the promise resolves; RoomPreviewEditor then reads `payload.generateRoomPreview` and updates UI.

---

## 7. Asset stack order

- From `useWorkbenchAsset()`: `assetStack = [...inheritedByAssetId.map(({ assetId }) => assetId), AssetId]`. Confirm that `inheritedByAssetId` is ordered base-first (inheritance order). If the selector does not guarantee order, document or adjust so the stack matches the backend’s expectation (base-first, current asset last).

---

## 8. Edge cases

- **No Lens / no Marks**: In Room, disable or hide the Preview entry point; in RoomPreviewEditor, show "Add a Lens with Marks to use Preview" when the Room has no valid Lens or Marks.
- **Loading**: Disable Generate and show a loading indicator while the request is in flight; clear on resolve/reject.
- **RequestId**: Backend includes `RequestId` in the response body; client parses/normalizes as in section 6 so multiple in-flight requests still correlate correctly.

---

## 9. Files summary

| Area | File | Change |
|------|------|--------|
| Planning | [lambda/ephemera/AGENT.caching.firstMVP.planning.md](lambda/ephemera/AGENT.caching.firstMVP.planning.md) | Phase 5 revised to "navigate down into" Preview; status updated to Phase 5 complete. |
| Room entry | [charcoal-client/.../RoomEdit/RoomEditor.tsx](charcoal-client/src/components/Workbench/RoomEdit/RoomEditor.tsx) | **Done.** Preview section with "Open Preview" when one Lens + at least one Mark; push synthetic breadcrumb on click. |
| Breadcrumb | [charcoal-client/.../WorkbenchContainer.tsx](charcoal-client/src/components/Workbench/WorkbenchContainer.tsx) | **Done.** Synthetic id `preview:*` shows label "Preview" and VisibilityIcon. |
| Routing | [charcoal-client/.../WorkbenchAssetEditor.tsx](charcoal-client/src/components/Workbench/WorkbenchAssetEditor.tsx) | **Done.** If `currentComponentId.startsWith('preview:')`, render RoomPreviewEditor with parsed roomId. |
| New | [charcoal-client/.../RoomEdit/RoomPreviewEditor.tsx](charcoal-client/src/components/Workbench/RoomEdit/RoomPreviewEditor.tsx) | **Done.** Mark inputs, Generate, result/error; markState/assetStack; socketDispatchPromise; RoomId cast to EphemeraRoomId; response handling. |
| Backend | [lambda/ephemera/app.ts](lambda/ephemera/app.ts) | **Done.** RequestId in generateRoomPreview ReturnValue body when present. |
| lifeLine | [charcoal-client/.../lifeLine/index.api.ts](charcoal-client/src/slices/lifeLine/index.api.ts) | **Done.** Parse `payload.body` when `statusCode` + string `body`; re-publish as LifeLinePubSubData for RequestId correlation. |
| Test | [lambda/ephemera/app.generateRoomPreview.test.ts](lambda/ephemera/app.generateRoomPreview.test.ts) | **Done.** Expects RequestId in ReturnValue body. |

---

## 10. Deliverable

Authors open a Room in the workbench, click through to **Preview** (breadcrumb: Asset > Room > Preview), enter proposed Mark values, click Generate, and see either cached rendered content (displayName/summary/description as text) or a "no exact match" error. Going back via breadcrumb returns to the Room editor.

**Status: Delivered.**
