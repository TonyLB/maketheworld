# Task plan: charcoal-client TypeScript build errors

**Status:** In progress --- Workbench/Maps/WML selectors slice done (`check`, `build`, `test:single` green). Remaining: **Close out** row when the full initiative is verified and merged.

See [`taskPlanning/AGENT.md`](../AGENT.md) for how task plans relate to durable docs and when to delete this file after merge.

## Getting Started

1. Skim [`taskPlanning/AGENT.md`](../AGENT.md) once for durability, checkbox conventions, and content split.
2. For tests and commands for this package, use [`charcoal-client/AGENT.development.md`](AGENT.development.md) and canonical **[`charcoal-client/AGENT.testing.md`](../../charcoal-client/AGENT.testing.md)**. If anything conflicts, prefer `charcoal-client/AGENT.testing.md` for Vitest behavior.
3. **Working directory:** `charcoal-client/` for npm scripts below.
4. **Baseline (before / during work):** reproduce the failure so the checklist matches reality:

   ```bash
   cd charcoal-client
   npm run check
   npm run build
   ```

   `check` runs `tsc --noEmit --skipLibCheck`; `build` runs `tsc && vite build` (stricter than dev server or Vitest alone).

## Goal

Eliminate TypeScript errors reported by `tsc` so `npm run check` and `npm run build` succeed, unblocking a final client artifact. Errors cluster into: MUI resolution/imports, renamed character fields (`Name` to `DisplayName`), map/ephemera and map editor shapes, Virtuoso props, import dialog tag union, `StandardRoom` payload cast, and display-name selector narrowing.

## Decisions

- **Material UI:** Pin `@mui/material` and `@mui/icons-material` to **`7.3.4`**, and `@mui/system` to **`7.3.3`** (npm does not publish `@mui/system@7.3.4`; `7.3.3` matches `@mui/material@7.3.4` dependency range). Use exact versions in `charcoal-client/package.json` and root `overrides` (and add a root dependency on `@mui/system` so the package hoists for `tsc`). Theme APIs use the `@mui/material` barrel where needed for TypeScript `isolatedModules` with MUI 7. Watching MUI release notes and scheduling deliberate version bumps is **out of scope** for this task; handle that as a separate initiative when needed.
- **react-virtuoso:** Pin to **`1.11.1`** (matches the current range in [`charcoal-client/package.json`](../../charcoal-client/package.json): `^1.11.1`). Fix the `GroupedVirtuoso` / React types mismatch at that version (props, assertion, or local typing); do **not** treat upgrading to Virtuoso 2.x or later as part of this task unless a pin-only fix is impossible.
- **`build:dev` / script churn:** Adding, documenting, or redirecting a `build:dev` script is **out of scope**. Use existing `npm run build` and `npm run check` in `charcoal-client/`.

## Progress

| Area | Notes |
| --- | --- |
| MUI / theme imports | Done: **7.3.4** material + icons, **7.3.3** system; root hoists `@mui/system`; theme hooks use `@mui/material` barrel (styles subpath + `isolatedModules` was unreliable). |
| Character `DisplayName` (library, player, UI) | Done: guest helper in `slices/player`, `CharacterSelection`, `Home` use `DisplayName` per `mtw-interfaces`. |
| `MessagePanel` / ephemera `info` | Done: `MessagePanel` no longer destructures `info.Name`; `EphemeraCharacterInPlay` uses top-level `DisplayName`. |
| `VirtualMessageList` / react-virtuoso | Done: exact **`1.11.1`** in `package.json` + root `overrides`; `VirtualMessageList.tsx`: typed MUI `List` wrapper, pointer-capture props, `ref` assertion for Virtuoso 1.11 / React 18. |
| Workbench import handler | Done: `TopLevelEditor` `handleImportSelect` uses `SchemaImportMapping['type']` (includes `Lens`). |
| `MapController` positions | Done: workbench `MapController` uses `shortName` on `MapContextPosition` (matches `Maps/Controller/index`). |
| `receiveMapEphemera` | Done: `extractMapDataFromStandardForm` returns map `shortName`, not undefined `name`. |
| `buildGenerationContextSubset` | Done: trim uses `StandardRoomPayload` cast and clears `_inlineRefs` (not `_examples`). |
| `contentHeaders/selectors` | Done: `getComponentDisplayName` handles `StandardLiteral` + optional `plainString` fallback. |

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. Mark nested lines `[X]` as you finish them.

- [X] **MUI:** Pin `@mui/material` and `@mui/icons-material` to **7.3.4** and `@mui/system` to **7.3.3**; align root `overrides` and add root `@mui/system` for hoisting; reinstall. Import `Theme`/`useTheme`/`styled`/`keyframes`/`createTheme`/`ThemeProvider`/`StyledEngineProvider` from `@mui/material` (see **Decisions**). Touched: `App.tsx`, `CharacterStyleWrapper`, `DraggableTree/useTreeStyles`, `Maps/Edit` theme hooks, `Onboarding/TutorialPopover`, `SignIn`, `Spinner`, `Workbench/workbenchTheme`, plus `components.test.tsx` for consistency.
- [X] **Characters:** Rename `Name` to `DisplayName` where types are `LibraryCharacter` or `AssetClientPlayerCharacter` (`CharacterSelection`, `Home`, `slices/player` guest helper). Use `DisplayName` for `EphemeraCharacterInPlay` in `MessagePanel` (no `info.Name`).
- [X] **Virtuoso:** Set `react-virtuoso` to **`1.11.1`** in `package.json` (exact); fix `GroupedVirtuoso` typing in `VirtualMessageList.tsx` at that version (e.g. pointer-capture props, narrow assertion, or `ComponentProps` helper). Defer deliberate Virtuoso upgrades.
- [X] **Workbench:** Widen `handleImportSelect` in `TopLevelEditor.tsx` to `SchemaImportMapping['type']` and handle `Lens` in `addImportToDraft` path if needed.
- [X] **Maps:** In `MapController.tsx`, set `shortName` on position objects (not `name`). In `receiveMapEphemera.ts`, return `shortName` not `name` in `extractMapDataFromStandardForm`.
- [X] **WML / selectors:** Fix `buildGenerationContextSubset.ts` cast to match `StandardRoom` payload. Narrow `getComponentDisplayName` in `contentHeaders/selectors.ts` for `displayName.plainString`.
- [ ] **Close out:** Run Verification; update this plan's checkboxes and Progress table; remove this file after merge per [`taskPlanning/AGENT.md`](../AGENT.md).

## Verification

Run from `charcoal-client/`:

```bash
npm run check
npm run build
npm run test:single
```

`check` and `build` must pass with no TS errors. Tests should stay green for touched areas (message, player, maps, workbench slices as applicable).

## Reference (no substitution for package docs)

- Character shapes: [`packages/mtw-interfaces/ts/library.ts`](../../packages/mtw-interfaces/ts/library.ts), [`packages/mtw-interfaces/ts/asset.ts`](../../packages/mtw-interfaces/ts/asset.ts), [`packages/mtw-interfaces/ts/ephemera.ts`](../../packages/mtw-interfaces/ts/ephemera.ts) (`EphemeraClientMessageEphemeraUpdateCharacterInPlayActive`).
- Map types: [`charcoal-client/src/slices/activeCharacters/baseClasses.ts`](../../charcoal-client/src/slices/activeCharacters/baseClasses.ts), [`charcoal-client/src/components/Maps/Controller/baseClasses.ts`](../../charcoal-client/src/components/Maps/Controller/baseClasses.ts).
