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

## Optional regression searches (Room vs Example)

After changes to Room standardization, Example association, or test fixtures, these **repo-root** **`rg`** commands help spot accidental reintroduction of **Room-owned** **`.examples`** usage or large **`<Room>`** / **`<Example>`** pairings in tests. Adjust roots if you are only touching one package. **`Feature`** / **`Knowledge`** tests **should** still match **`.examples`**; for **`packages/mtw-wml`** the only expected **`.examples`** hits are usually **`feature.test.ts`** / **`knowledge.test.ts`**.

**Fixture tip:** When authoring Room prose in **`packages/mtw-wml`** tests, prefer **`<Situation uuid=(DEFAULT)>`** so the default situation facet matches primitives (**universal id** **`SITUATION#DEFAULT`**). Use **`<Render>`** under Room only when the case is explicitly about wire **`render`** shape.

```bash
rg "\.examples\b" packages/mtw-wml --glob "*.test.ts"
rg "<Room[^>]*>[\s\S]{0,200}<Example" packages/mtw-wml --glob "*.test.ts" --multiline
rg "examples:\s*\[|examples:\s*\{" lambda/assets lambda/ephemera charcoal-client --glob "*.{test.ts,test.tsx}"
rg "tag:\s*'Room'" lambda/assets lambda/ephemera --glob "*.test.ts" -n
```

