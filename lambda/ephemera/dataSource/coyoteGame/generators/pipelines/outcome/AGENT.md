# Coyote outcome pipeline

This folder owns plan-outcome generation for `mtw.ephemera.coyoteGame`.

Parent docs:

- Package overview: [`../../../AGENT.md`](../../../AGENT.md)

## Scope

The outcome pipeline is triggered by `Await RoadRunner` handling and produces a single player-facing `Outcome:` line (or stub fallback). It consumes:

- Staged room objects (snapshot utilities in [`../../../utilities/`](../../../utilities/)).
- Cached intent record from `internalCache.CoyoteGame.get('intent')` (hypothesis line, optional walkthrough, optional narrative beats structured, optional internal **`gimmick`** spine tag, optional sparse **`tropeSequence`** in canonical order for the Bedrock prompt).

## Key files

- [`generatePlanOutcome.ts`](generatePlanOutcome.ts): Bedrock call wrapper and final parse-to-render output.
- [`buildPlanOutcomePrompt.ts`](buildPlanOutcomePrompt.ts): invariant + dynamic prompt split for caching.
- [`formatPhasePlanForOutcomePrompt.ts`](formatPhasePlanForOutcomePrompt.ts): deterministic **`narrativeBeatsStructured`** outline for the prompt tail; when intent carries **`tropeSequence`**, emits a **`Trope sequence:`** header (sparse committed tropes, canonical order) before linearized beat ids.

## Contracts and boundaries

- This pipeline does not own hypothesis generation; that remains in [`../hypothesis/`](../hypothesis/).
- Cross-pipeline parse contracts that are reused across flows live under [`../../sharedParsers/`](../../sharedParsers/).
- Harness code is separate under [`../../testHarness/`](../../testHarness/) and can pass overrides via `generatePlanOutcome` inputs.

## Tests

- Unit tests are colocated in this folder as `*.test.ts`.
