import type { ParseCommandResult } from '../baseClasses'
import { words, type FixedWordElement } from './deterministicTemplate'
import type { GranuleToken } from './granuleTokens'
import { matchPattern } from './patternTemplate'

/**
 * An intent row: a pattern of fixed words with no span, and the result it answers. It captures
 * nothing, so its result is a constant, and it answers as a result, not an attempt: its words are
 * no other template's and it has no referent to pool with other readings.
 */
export type IntentTemplate = { pattern: readonly FixedWordElement[]; result: ParseCommandResult }

/**
 * The intent rows, read on the fast path ahead of the object templates, over the same tokens
 * (`plan/planSkeleton.ts` `COMMAND_GRANULES`). `look` stays bare: open-ended paraphrases like
 * "peruse the room" are no closed lexicon's to list. `predict` has no `p` alias; its paraphrases
 * are classify's (a `WorldQuestion`).
 */
export const INTENT_TEMPLATES: readonly IntentTemplate[] = [
    { pattern: [words('look', 'l')], result: { type: 'LookRoom', confidence: 1 } },
    { pattern: [words('help', 'help me', 'i need help', 'show help')], result: { type: 'Help', confidence: 1 } },
    { pattern: [words('home', 'go home', 'head home', 'return home', 'head back home')], result: { type: 'Home', confidence: 1 } },
    { pattern: [words('predict')], result: { type: 'PredictHypothesis', confidence: 1 } },
    // Coyote Game's wait state; lexicon confirmed with the user.
    { pattern: [words('wait', 'wait for the roadrunner', 'wait for road runner', 'wait for the bird')], result: { type: 'AwaitRoadRunner', confidence: 1 } },
]

/** The result of the first intent row that reads the whole command, if any. */
export function matchIntentTemplate(tokens: readonly GranuleToken[], intents: readonly IntentTemplate[] = INTENT_TEMPLATES): ParseCommandResult | undefined {
    return intents.find(({ pattern }) => matchPattern(pattern, tokens).length > 0)?.result
}
