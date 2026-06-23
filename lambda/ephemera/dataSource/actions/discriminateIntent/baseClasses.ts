import type {
    IntentClassificationResult,
    ParseCommandAcmeOrderIntentResult,
    ParseCommandConfidence,
    ParseCommandHomeIntentResult,
    ParseCommandNavigationIntentResult,
    ParseCommandObjectManipulationIntentResult,
    ParseCommandResult,
} from '../baseClasses'

const isParseConfidence = (value: unknown): value is ParseCommandConfidence => (
    typeof value === 'number'
    && Number.isFinite(value)
    && value >= 0
    && value <= 1
)

export function isParseCommandAcmeOrderIntentResult(
    result: IntentClassificationResult | ParseCommandResult
): result is ParseCommandAcmeOrderIntentResult {
    if (result.type !== 'AcmeOrderIntent') {
        return false
    }
    if (!isParseConfidence(result.confidence)) {
        return false
    }
    if (!Array.isArray(result.rawOrders) || result.rawOrders.length === 0) {
        return false
    }
    return result.rawOrders.every(
        (s) => typeof s === 'string' && s.trim().length > 0 && s === s.trim()
    )
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

export function isParseCommandHomeIntentResult(
    result: IntentClassificationResult | ParseCommandResult
): result is ParseCommandHomeIntentResult {
    if (result.type !== 'HomeIntent') {
        return false
    }
    return isParseConfidence(result.confidence)
}

export function isParseCommandObjectManipulationIntentResult(
    result: IntentClassificationResult | ParseCommandResult
): result is ParseCommandObjectManipulationIntentResult {
    if (result.type !== 'ObjectManipulationIntent') {
        return false
    }
    if (!isParseConfidence(result.confidence)) {
        return false
    }
    if (!Array.isArray(result.rawObjectSpans) || result.rawObjectSpans.length === 0) {
        return false
    }
    return result.rawObjectSpans.every(
        (s) => typeof s === 'string' && s.trim().length > 0 && s === s.trim()
    )
}
