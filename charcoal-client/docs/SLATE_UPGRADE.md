# Slate Upgrade Guide

This doc outlines upgrading `slate`, `slate-react`, and `slate-history` to the newest stable versions, and what to watch for in this codebase.

## 1. Current state

- **Current versions** (charcoal-client): `slate ^0.94.0`, `slate-react ^0.90.0`, `slate-history ^0.86.0`
- **Goal**: Move to latest stable so the upcoming “init once + diff + Transforms” sync is implemented on the target API.

## 2. Get latest versions

From `charcoal-client/` run:

```bash
npm view slate version
npm view slate-react version
npm view slate-history version
```

Use the same major/minor for all three when the registry lists them (e.g. 0.103.x or 0.120.x). If `slate-history` is behind, use its latest that matches the major of `slate`.

**Current bump in package.json**: `slate` and `slate-react` at `^0.123.0`, `slate-history` at `^0.113.1` (slate-history’s latest is behind slate/slate-react).

## 3. Upgrade steps

1. **Bump dependencies**  
   In `charcoal-client/package.json`, set:
   - `slate` to the latest (e.g. `^0.103.0` or whatever `npm view` reported)
   - `slate-react` to the same as `slate`
   - `slate-history` to the same as `slate` (or the latest compatible version)

2. **Install**
   ```bash
   cd charcoal-client && npm install
   ```

3. **Typecheck**
   ```bash
   npm run check
   ```

4. **Tests**
   ```bash
   npm run test:single
   ```

5. **Fix breakages** using the “APIs to check” section below and the per-package changelogs:
   - [slate CHANGELOG](https://github.com/ianstormtaylor/slate/blob/main/packages/slate/CHANGELOG.md)
   - [slate-react CHANGELOG](https://github.com/ianstormtaylor/slate/blob/main/packages/slate-react/CHANGELOG.md)
   - [slate-history CHANGELOG](https://github.com/ianstormtaylor/slate/blob/main/packages/slate-history/CHANGELOG.md)

## 4. Files that use Slate (audit list)

- **Workbench (primary editor surface)**  
  - `src/components/Workbench/StandardRenderEditor.tsx` – Slate setup, `useSlate`, `Slate`, `Editable`, `withHistory`, `withReact`, `createEditor`, `Transforms`, `Editor`, `Range`, `Element`
  - `src/components/Workbench/LinkDialog.tsx` – `useSlate`, `ReactEditor`, `Editor`, `Transforms`, `Element`, `Range`
  - `src/hooks/useUpdatedSlate.ts` – `Editor`, `Transforms`, `Range`, `Descendant` (this hook will be replaced by the Transforms-based sync)

- **Editor (shared Slate utilities)**  
  - `src/components/Editor/baseClasses.ts` – `BaseEditor`, `Selection`, `ReactEditor`, `declare module 'slate'` CustomTypes
  - `src/components/Editor/StandardRenderEditor/descendantsToRender.ts` – `Descendant`
  - `src/components/Editor/StandardRenderEditor/descendantsFromRender.ts` – Slate node handling
  - `src/components/Editor/StandardRenderEditor/constrainedWhitespace.ts` – `Transforms`, `Editor`, `Text`
  - `src/components/Editor/StandardRenderEditor/components.tsx` – `RenderElementProps`, `RenderLeafProps`, `useSlate`, `Editor`, `Node`, `NodeEntry`, `Element`, `Range`, `Transforms`

- **Tests**  
  - `src/components/Editor/StandardRenderEditor/descendantsToRender.test.ts`
  - `src/components/Editor/StandardRenderEditor/components.test.tsx` – `createEditor`, `Node`, `Element`, `Transforms`, `Slate`, `withReact`
  - `AGENT.testing.slate.md` – references to Slate APIs

- **Other**  
  - `src/lib/slateUtils/InlineChromiumBugfix.tsx` – Slate DOM/selection workaround

## 5. APIs to check after upgrading

- **`Node`**  
  Newer Slate often deprecates or removes the generic `Node` in favor of `Element` and `Text`.  
  - `Node.children` → may become `Editor.nodes` or equivalent.  
  - `Node.string` → may become `Text.string` or stay on `Node`; check types.  
  - Used in: `Editor/StandardRenderEditor/components.tsx` (`Node.children`, `Node.string`), `decorateFactory` (`NodeEntry`, `Node.children`).

- **`Editor.isBlock`**  
  Used in `components.tsx` inside `withParagraphBR`. If removed or renamed, switch to the replacement (e.g. `Element.isElement` + block check).

- **`Editor.normalize(editor, { force: true })`**  
  Used in `useUpdatedSlate.ts`. Confirm signature and behavior in the new version.

- **`Transforms.select` / `Editor.range` / `Editor.end`**  
  Used in `useUpdatedSlate.ts`. Check for renames or argument changes.

- **`declare module 'slate'` and `CustomTypes`**  
  In `Editor/baseClasses.ts`. Slate 0.61+ uses CustomTypes; ensure `Editor`, `Element`, `Text` extensions still match the new type definitions.

- **`withHistory`, `withReact`, `createEditor`**  
  Ensure they still compose the same way and that `slate-history` is compatible with the new `slate` and `slate-react` versions.

- **`Editable` / `Slate`**  
  Check for prop renames (e.g. `readOnly` vs `readonly`) and any new required props.

## 6. After the upgrade

Once the app and tests pass on the new versions:

1. Implement the **proper Slate sync**: init editor from `value` once, then only apply a **diff** between current editor state and desired state using **Slate Transforms** (no more overwriting `editor.children` in `useUpdatedSlate`).
2. Remove or replace the `lastSyncedRef` workaround in `useUpdatedSlate.ts` with the Transforms-based sync.

This keeps Slate’s internal state and CRDT-style behavior intact and avoids flicker and lost input.
