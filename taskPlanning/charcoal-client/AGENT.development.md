# Developing charcoal-client (notes for task planning)

Use this file when working from **`taskPlanning/charcoal-client/`** plans. It points to the canonical testing documentation and gives **exact commands** for this package (Vitest, not Jest).

## Canonical documentation

- **[`charcoal-client/AGENT.testing.md`](../../charcoal-client/AGENT.testing.md)** --- Vitest, React Testing Library, `jsdom`, MUI testing patterns. Start with **Core Testing Commands**.
- **[`AGENT.md`](../AGENT.md)** (repo root) --- **Testing Patterns**: client uses `npm test` (watch) and **`npm run test:single`** for a one-shot full run; packages often use Jest. Do not assume `--testPathPattern` (Jest); the client uses Vitest.
- **[`charcoal-client/AGENT.md`](../../charcoal-client/AGENT.md)** --- Client architecture (authoring vs play, major subsystems).

## Commands (run from `charcoal-client/`)

The package `test` script runs Vitest. Prefer changing into the package directory first:

```bash
cd charcoal-client

# Watch mode (default)
npm test

# Single run (all tests) --- preferred; defined in package.json as vitest run
npm run test:single

# One file or directory (pass paths after --)
npm run test:single -- src/slices/lifeLine/socketDispatchConversation.test.ts
npm run test:single -- src/slices/lifeLine

# Equivalent if you invoke Vitest directly
npx vitest run
npx vitest run src/slices/lifeLine
```

**Do not** use Jest flags such as `--testPathPattern` unless you have wired Jest for this package; they will fail with Vitest.

## Linking from task plans

Task planning documents in this folder should **link here** for "how to run tests" instead of embedding runner-specific commands that drift from [`AGENT.testing.md`](../../charcoal-client/AGENT.testing.md).
