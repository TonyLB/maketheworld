import { makePatternTemplate } from './patternTemplate'

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
