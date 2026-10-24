import type { PatternCapture } from '../../../deterministicTemplate/patternTemplate'

/**
 * Readers for an object template's builder: the capture at a pattern position, as the pattern
 * declares it. A builder runs only on a fill of its own pattern, so a mismatch is a bug in the
 * template, not in the command.
 */
export const optionAt = (captures: PatternCapture[], elementIndex: number): string => {
    const capture = captures[elementIndex]
    if (capture?.kind !== 'templateText') {
        throw new Error(`templateCaptures: element ${elementIndex} is not a fixed word`)
    }
    return capture.option
}

/**
 * The span an `objectSpan` position captured, or an `objectPhrase` position's first span (what its
 * qualifiers restrict), with the key Parse stamped on it (its occurrence).
 */
export const spanAt = (captures: PatternCapture[], elementIndex: number): { span: string; stableRefKey: string } => {
    const capture = captures[elementIndex]
    if ((capture?.kind !== 'objectSpan' && capture?.kind !== 'objectPhrase') || capture.stableRefKey === undefined) {
        throw new Error(`templateCaptures: element ${elementIndex} is not a stamped object span`)
    }
    return { span: capture.text, stableRefKey: capture.stableRefKey }
}
