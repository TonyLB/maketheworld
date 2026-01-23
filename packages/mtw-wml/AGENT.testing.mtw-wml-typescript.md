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
  - `npm run build` in `charcoal-client` should not report errors from `../packages/mtw-wml/...` (front-end errors are handled separately.

