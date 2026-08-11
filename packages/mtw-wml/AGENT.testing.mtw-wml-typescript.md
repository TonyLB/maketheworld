## TypeScript strictness for `mtw-wml`

- **Config**: `ts/` is compiled with `strict: true`, `noImplicitAny: true`, `isolatedModules: true`, and `skipLibCheck: true` (see `tsconfig.json`).
- **Goal**: All public APIs in `mtw-wml` should be safe under both the library’s own config and the stricter `charcoal-client` config.
- **Re-exports**:
  - Use `export type` for type-only symbols from barrels (especially under `standardize/components/*` and `standardize/keys/*`) to keep `isolatedModules` happy.
  - Runtime values (`class`es, functions, constants) should continue to use normal `export`/`export { ... }`.
- **Implicit anys**:
  - Do not introduce new implicit anys in `ts/`. When in doubt, prefer specific domain types (`SchemaTag`, `StandardFormSubsetRequest`, `StandardReferenceData`, etc.) or `unknown` plus type guards.
- **Expected checks**:
  - `npx tsc -p packages/mtw-wml/tsconfig.json --noEmit` should pass.
  - `npm run build` in `charcoal-client` should not report errors from `../packages/mtw-wml/...` (front-end errors are handled separately).

## Optional regression searches (Room / Feature / Knowledge)

After changes to Room/Feature/Knowledge standardization or test fixtures, these **repo-root** **`rg`** commands help spot regressions. Adjust roots if you are only touching one package.

**Fixture tips:**

- **Room, Feature, Knowledge prose:** Use **`<Situation uuid=(DEFAULT)>`** (or a bare **`uuid=(myKey)`** for entity ids) under the parent. WML **`uuid=(...)`** is unprefixed; JSON / **`byUniversalId`** use **`SITUATION#...`**. Do **not** use **`<Example>`** in new fixtures (tag removed).
- **Feature / Knowledge:** Expect **`toJSON().situations`**, not **`examples`**. No **`.examples`** hits in **`feature.test.ts`** / **`knowledge.test.ts`**.
- **Room wire:** Use **`<Render>`** under Room only when the case is explicitly about ephemera **`render`** shape.
- **Marks:** Author on **`Situation`** components via **`SituationEditor`** / marks facets, not **`<Example>`**.

```bash
rg "\.examples\b" packages/mtw-wml --glob "*.test.ts"
rg "<Room[^>]*>[\s\S]{0,200}<Example" packages/mtw-wml --glob "*.test.ts" --multiline
rg "examples:\s*\[|examples:\s*\{" lambda/assets lambda/ephemera charcoal-client --glob "*.{test.ts,test.tsx}"
rg "tag:\s*'Room'" lambda/assets lambda/ephemera --glob "*.test.ts" -n
```

## Optional regression searches (Area)

After changes to Area, `StandardLudicGraph`, or related WML/schema wiring:

```bash
npm --prefix packages/mtw-wml run test -- --watchAll=false --testPathPattern="area|ludicGraph"
npx tsc -p packages/mtw-wml/tsconfig.json --noEmit
rg "ComponentTag|'Area'|AREA#" packages/mtw-wml packages/mtw-base --glob "*.{ts,tsx}"
rg "<LudicGraph" packages/mtw-wml packages/mtw-base --glob "*.{ts,tsx,md}"
rg "self-reference|selfReference" packages/mtw-wml/ts/standardize/components --glob "*area*"
```

**Fixture tips:**

- **WML:** Flat participant children under `<Area>`; do not introduce a `<LudicGraph>` wrapper.
- **JSON:** Expect **`ludicGraph: { nodes }`** only; omit when empty.
- **Universal keys:** `AREA#...` in JSON; `<Area uuid=(...) />` in WML for universal-key wire form.

