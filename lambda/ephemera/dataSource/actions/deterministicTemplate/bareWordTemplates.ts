import { makePatternTemplate } from './patternTemplate'

/**
 * Bare-word fast-path templates, mirroring discriminateIntent/
 * deterministicChecks.ts's existing bare-word behavior exactly: case-insensitive,
 * whole-line match, `predict` has no `p` alias.
 *
 * `help`/`home` also carry closed paraphrase lexicons (Sub-iteration 2, iteration 7,
 * 2026-07-20) -- the bare forms below stay redundant with deterministicChecks.ts's
 * pre-classify fast path (unchanged, still the actual producer for bare input); the
 * paraphrase options are what this registry's post-classify wiring (see index.ts's
 * matchNonObjectManipulationTemplate) actually adds coverage for, since
 * deterministicChecks.ts never recognizes these longer phrasings and lets them fall
 * through to classify/Command. `look` deliberately stays bare-word-only: open-ended
 * paraphrases like "peruse the room" are free-form enough that a closed lexicon isn't
 * the right tool -- that's LLM-fallback territory (Sub-iteration 3-adjacent, not yet
 * built), not a deterministic template.
 */
export const lookTemplate = makePatternTemplate(
    [{ type: 'templateText', options: ['look', 'l'] }],
    { type: 'LookRoom', confidence: 1 }
)

export const helpTemplate = makePatternTemplate(
    [{ type: 'templateText', options: ['help', 'help me', 'i need help', 'show help'] }],
    { type: 'Help', confidence: 1 }
)

export const homeTemplate = makePatternTemplate(
    [{ type: 'templateText', options: ['home', 'go home', 'head home', 'return home', 'head back home'] }],
    { type: 'Home', confidence: 1 }
)

export const predictTemplate = makePatternTemplate(
    [{ type: 'templateText', options: ['predict'] }],
    { type: 'PredictHypothesis', confidence: 1 }
)

/**
 * Coyote Game wait-state paraphrase lexicon (Sub-iteration 2, 2026-07-20).
 * Unlike look/help/home, `wait` has no pre-classify bare-word producer today --
 * deterministicChecks.ts never checked for it -- so this template is genuinely
 * new coverage for both the bare form and its paraphrases, not just the
 * paraphrases. Lexicon confirmed with the user: bare `wait`, plus
 * `wait for the roadrunner` / `wait for road runner` / `wait for the bird`.
 */
export const awaitRoadRunnerTemplate = makePatternTemplate(
    [{ type: 'templateText', options: ['wait', 'wait for the roadrunner', 'wait for road runner', 'wait for the bird'] }],
    { type: 'AwaitRoadRunner', confidence: 1 }
)
