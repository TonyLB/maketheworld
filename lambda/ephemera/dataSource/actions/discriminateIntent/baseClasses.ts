import type {
    ParseCommandAwaitRoadrunnerResult,
    ParseCommandErrorResult,
    ParseCommandHelpResult,
    ParseCommandLookRoomResult,
    ParseCommandPromptInjectionAttemptResult,
    ParseCommandResult,
    ParseCommandUnimplementedResult,
    ParseCommandUnknownResult,
    ParseCommandConfidence,
} from '../baseClasses'

const isParseConfidence = (value: unknown): value is ParseCommandConfidence => (
    typeof value === 'number'
    && Number.isFinite(value)
    && value >= 0
    && value <= 1
)

/**
 * Intent discrimination only: model-classified movement intent before server-side exit resolution.
 * Final parse result still uses `Navigation` with `targetId` after resolution.
 */
export type ParseCommandNavigationIntentResult = {
    type: 'NavigationIntent'
    exitCandidate: string
    confidence: ParseCommandConfidence
}

/**
 * Intent discrimination only: player intent is an Acme order (no segmentation or catalog validation).
 * `parseCommand` always follows with Step B and returns {@link ParseCommandAcmeOrderResult}.
 */
export type ParseCommandAcmeOrderIntentResult = {
    type: 'AcmeOrderIntent'
    confidence: ParseCommandConfidence
}

/**
 * Outcome of intent discrimination only (includes Acme intent without line items, and
 * **LookRoom** for full room description / examine-surroundings intent without Step B).
 */
export type IntentClassificationResult =
    | ParseCommandErrorResult
    | ParseCommandNavigationIntentResult
    | ParseCommandAwaitRoadrunnerResult
    | ParseCommandHelpResult
    | ParseCommandAcmeOrderIntentResult
    | ParseCommandLookRoomResult
    | ParseCommandUnimplementedResult
    | ParseCommandUnknownResult
    | ParseCommandPromptInjectionAttemptResult

export function isParseCommandAcmeOrderIntentResult(
    result: IntentClassificationResult | ParseCommandResult
): result is ParseCommandAcmeOrderIntentResult {
    if (result.type !== 'AcmeOrderIntent') {
        return false
    }
    return isParseConfidence(result.confidence)
}

export function isParseCommandNavigationIntentResult(
    result: IntentClassificationResult | ParseCommandResult
): result is ParseCommandNavigationIntentResult {
    if (result.type !== 'NavigationIntent') {
        return false
    }
    if (typeof result.exitCandidate !== 'string') {
        return false
    }
    if (result.exitCandidate.trim().length === 0) {
        return false
    }
    return isParseConfidence(result.confidence)
}
