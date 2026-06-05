# Client instrumentation (testing & debugging)

This document describes the **patterns** and tools we use in the charcoal client to instrument behavior for debugging and diagnosis. It is updated as we adopt new patterns and add tools.

## Conventions

- **Use `console.log` for instrumentation output.** Do not use `console.debug`. In browser DevTools, `console.debug` is treated as "Verbose" and is often hidden by default; instrumentation logs would not appear until the user enables Verbose level. Using `console.log` ensures logs are visible with default console settings.

- **Render edit/schema/diff data to WML when logging.** JSON for StandardForm, edit payloads, or schema trees is hard to read. When instrumenting flows that touch WML edits (e.g. `updateStandard` diff, `applyEdit` payload), log the **WML** (e.g. `schemaToWML([form.schema])` or the `schema` string already built for the wire) so humans can read what is being sent or merged. Prefer a `schemaWML` / `diffWML` (or similar) field over raw `editJSON` or `components` in logs.

## Patterns

*(Documented as we implement them.)*

### Removing instrumentation

When we remove instrumentation (e.g. after a bug is fixed), we must remove **both**:

1. **The logging** – the `console.log` (or other trace) at the instrumented site(s).
2. **The up-the-tree discrimination that activates it** – anything that gates or triggers that logging:
   - The activation key/constant (e.g. in `scopedInstrumentation.ts`) if it was only used for this flow.
   - Call sites that pass `options={{ instrumentation: ['that-key'] }}` into the pipeline.
   - Props like `instrumentationKey` passed into hooks/components that check `options?.instrumentation?.includes(instrumentationKey)` before logging.

Leaving the key or the options in place without the log means dead config and confusion when someone re-enables a key expecting logs. Remove the key and the options that referenced it so the pipeline is consistent.

## Available tools

### Workbench component / asset-meta session (flush and reconcile)

Logs are gated by activation key `workbench-component-session` (component editors) or `workbench-asset-meta-session` (asset shortName / summary / topLevel). Prefix: `[workbench-component-session] <event>` with a single object payload (copy from DevTools).

**Enable without rebuild** (browser console, then reproduce the bug):

```javascript
sessionStorage.setItem('mtw-instrumentation', '["workbench-component-session"]')
```

For asset-meta fields:

```javascript
sessionStorage.setItem('mtw-instrumentation', '["workbench-asset-meta-session"]')
```

Disable: `sessionStorage.removeItem('mtw-instrumentation')`.

**Enable via provider** (temporary code change): pass `instrumentation={{ instrumentation: ['workbench-component-session'] }}` on `WorkbenchComponentProvider` (or `workbench-asset-meta-session` on `WorkbenchAssetMetaProvider`).

**Events (component session):** `performFlushDispatch`, `performFlushSkipped`, `dispatchFlushApplied`, `performFlushAdvancedLastReceived`, `committedSyncSkipped`, `committedEchoSkipped`, `reconcileStart`, `reconcileDone`, `sessionReset`. Snapshots include `shortName` and `universalKey` where applicable; `reconcileStart` includes `editDiff` and `incomingEqualsLastFlush`.

Implementation: [`workbenchSessionInstrumentation.ts`](src/components/Workbench/foundations/workbenchSessionInstrumentation.ts).

### Scoped instrumentation via options threading (updateStandard)

Thread `options.instrumentation` through the `updateStandard` flow so that instrumentation can be scoped by call-tree. The plumbing is permanent: `UpdateStandardPayload` includes optional `options?: ScopedInstrumentationOptions`; the thunk passes `options` through; the reducer receives it. When debugging a specific flow, pass `options: { instrumentation: ['key'] }` at the call site; add the key to `INSTRUMENTATION_KEYS` in `src/testing/scopedInstrumentation.ts`; add logging in the reducer (or other instrumented sites) gated by `payload.options?.instrumentation?.includes(yourKey)`. Activation and logging are temporary and removed when the bug is fixed; the plumbing remains for future debugging.

### applyEdit instrumentation (saveEdit)

The reducer **aggregates** `payload.options` from every `updateStandard` in the current edit slice: it merges and deduplicates the `instrumentation` arrays into `state.instrumentationOptionsForCurrentEdit`. When `saveEdit` enqueues the edit to `pendingEdits` (before `applyEdit` is sent), it reads `getInstrumentationOptionsForCurrentEdit(key)(state)` and can gate logging (e.g. `console.log` of schema or edit payload) by that aggregate. When creating the pending edit record, the reducer copies the aggregate into `meta.instrumentationOptions` and then clears `state.instrumentationOptionsForCurrentEdit`, so each pending edit carries the options that applied when that edit was enqueued; response handlers can use `pendingEdit.meta.instrumentationOptions` to gate logs. Add keys to `INSTRUMENTATION_KEYS` and gate logs in `saveEdit` (or when clearing pendingEdits by RequestId) the same way as in the reducer.

### receiveWML / resolving pending edits

When a Content Update (or other WML event) arrives, `receiveWMLEvent` runs and dispatches `clearPendingEditsByRequestIds` so pending edits whose `meta.key` is in the event’s `RequestIds` are removed. **Before** clearing, you can inspect which pending edits are being resolved: filter `pendingEdits` by `RequestIds.includes(p.meta.key)`. Any of those entries may have `meta.instrumentationOptions`; if they include a given key (add it to `INSTRUMENTATION_KEYS` when adding instrumentation), you can gate logging of the **return update** (the event’s content, e.g. `content.schema` rendered to WML) for that request. That gives a full pipeline: send (applyEdit log) → resolve (receiveWML log with return WML) when the same instrumentation key was stamped on the pending edit.
