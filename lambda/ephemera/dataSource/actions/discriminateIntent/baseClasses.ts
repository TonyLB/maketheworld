import {
    isManipulationVerbClass,
    type IntentClassificationResult,
    type ParseCommandAcmeOrderIntentResult,
    type ParseCommandConfidence,
    type ParseCommandHomeIntentResult,
    type ParseCommandNavigationIntentResult,
    type ParseCommandObjectMembershipIntentResult,
    type ParseCommandObjectRelateIntentResult,
    type ParseCommandResult,
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

export function isParseCommandObjectMembershipIntentResult(
    result: IntentClassificationResult | ParseCommandResult
): result is ParseCommandObjectMembershipIntentResult {
    if (result.type !== 'ObjectMembershipIntent') {
        return false
    }
    if (!isParseConfidence(result.confidence)) {
        return false
    }
    if (!isManipulationVerbClass(result.verbClass)) {
        return false
    }
    return Array.isArray(result.rawObjectSpans) && result.rawObjectSpans.every(
        (s) => typeof s === 'string' && s.trim().length > 0 && s === s.trim()
    )
}

export function isParseCommandObjectRelateIntentResult(
    result: IntentClassificationResult | ParseCommandResult
): result is ParseCommandObjectRelateIntentResult {
    if (result.type !== 'ObjectRelateIntent') {
        return false
    }
    return isParseConfidence(result.confidence)
}
