export type CardinalityGateOutcome =
    | { type: 'continue' }
    | { type: 'complex'; complexityClass: 'multiObject' }

export function evaluateCardinalityGate(
    rawObjectSpans: readonly string[]
): CardinalityGateOutcome {
    if (rawObjectSpans.length > 1) {
        return { type: 'complex', complexityClass: 'multiObject' }
    }
    return { type: 'continue' }
}
