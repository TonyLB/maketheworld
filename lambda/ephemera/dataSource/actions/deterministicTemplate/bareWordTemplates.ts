import { makePatternTemplate } from './patternTemplate'
import type { DeterministicTemplate, DeterministicTemplateMatch } from './deterministicTemplate'

/**
 * Four bare-word fast-path templates, mirroring discriminateIntent/
 * deterministicChecks.ts's existing bare-word behavior exactly: case-insensitive,
 * whole-line match, `predict` has no `p` alias.
 */
export const lookTemplate = makePatternTemplate(
    [{ type: 'templateText', options: ['look', 'l'] }],
    { type: 'LookRoom', confidence: 1 }
)

export const helpTemplate = makePatternTemplate(
    [{ type: 'templateText', options: ['help'] }],
    { type: 'Help', confidence: 1 }
)

export const homeTemplate = makePatternTemplate(
    [{ type: 'templateText', options: ['home'] }],
    { type: 'Home', confidence: 1 }
)

export const predictTemplate = makePatternTemplate(
    [{ type: 'templateText', options: ['predict'] }],
    { type: 'PredictHypothesis', confidence: 1 }
)

/**
 * Ordered, first-match-wins; agnostic to which factory produced each entry
 * (a future non-pattern-driven implementation could sit in this same array).
 */
export const deterministicTemplateRegistry: DeterministicTemplate[] = [
    lookTemplate,
    helpTemplate,
    homeTemplate,
    predictTemplate,
]

export function matchDeterministicTemplate(command: string): DeterministicTemplateMatch {
    for (const template of deterministicTemplateRegistry) {
        const result = template.matchString(command)
        if (result.type !== 'noMatch') {
            return result
        }
    }
    return { type: 'noMatch' }
}
