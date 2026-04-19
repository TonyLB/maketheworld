import { EphemeraRoomId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { CoyoteAffinityPossibility } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import { isCoyoteAffinityPossibility } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'

/**
 * Parser confidence for non-error outcomes. Typically in [0, 1]; validated by type guards.
 */
export type ParseCommandConfidence = number

const isParseConfidence = (value: unknown): value is ParseCommandConfidence => (
    typeof value === 'number'
    && Number.isFinite(value)
    && value >= 0
    && value <= 1
)

const isParseCommandAcmeOrderErrorType = (value: unknown): value is ParseCommandAcmeOrderErrorType => (
    value === 'Not a thing' || value === 'Not tangible' || value === 'Too large'
)

/**
 * Parser result for action ingress. Extend with non-error variants as the contract grows.
 * Intent is encoded by `type` (discriminated union). Slots/entities are per-variant fields.
 * `confidence` is required on every non-error variant. Parse diagnostics: not modeled yet.
 */
export type ParseCommandErrorResult = {
    type: 'Error'
    errorMessage?: string
}

export type ParseCommandNavigationResult = {
    type: 'Navigation'
    targetId: EphemeraRoomId
    confidence: ParseCommandConfidence
}

export type ParseCommandAcmeOrderErrorType = 'Not a thing' | 'Not tangible' | 'Too large'

export type ParseCommandAcmeOrderLine = {
    valid: boolean
    name: string
    /** Step B proposal; deterministic **`stableKey`** repair may run later before persistence. */
    stableKey?: string
    errorType?: ParseCommandAcmeOrderErrorType
    /** Role possibilities; **[]** when none apply or when **`affinitiesFailed`**. */
    affinities: CoyoteAffinityPossibility[]
    /** True when enrich could not attach validated affinities for this line. */
    affinitiesFailed?: boolean
}

/**
 * Step A only: player intent is an Acme order (no segmentation or catalog validation).
 * `parseCommand` always follows with Step B and returns {@link ParseCommandAcmeOrderResult}.
 */
export type ParseCommandAcmeOrderIntentResult = {
    type: 'AcmeOrderIntent'
    confidence: ParseCommandConfidence
}

/** Outcome of Step A intent classification only (includes Acme intent without line items). */
export type IntentClassificationResult =
    | ParseCommandErrorResult
    | ParseCommandAwaitRoadrunnerResult
    | ParseCommandAcmeOrderIntentResult
    | ParseCommandUnimplementedResult
    | ParseCommandUnknownResult

/** Coyote Game: order from Acme (mail-order, catalog, or unspecified). One or more product lines. */
export type ParseCommandAcmeOrderResult = {
    type: 'AcmeOrder'
    /** One entry per distinct product or line item (single-item orders use length 1). */
    orders: ParseCommandAcmeOrderLine[]
    confidence: ParseCommandConfidence
}

/** Coyote Game: wait-state for Road Runner encounter flows. */
export type ParseCommandAwaitRoadrunnerResult = {
    type: 'AwaitRoadRunner'
    confidence: ParseCommandConfidence
}

/** Coyote Game: explicit trigger for the Coyote engine test harness. */
export type ParseCommandCoyoteEngineTestResult = {
    type: 'CoyoteEngineTest'
    confidence: ParseCommandConfidence
}

/** Coyote Game: explicit trigger for the Acme parse affinities manual-review harness. */
export type ParseCommandCoyoteAffinitiesTestResult = {
    type: 'CoyoteAffinitiesTest'
    confidence: ParseCommandConfidence
}

export type ParseCommandUnimplementedResult = {
    type: 'Unimplemented'
    confidence: ParseCommandConfidence
}

export type ParseCommandUnknownResult = {
    type: 'Unknown'
    confidence: ParseCommandConfidence
}

export type ParseCommandResult =
    | ParseCommandErrorResult
    | ParseCommandNavigationResult
    | ParseCommandAcmeOrderResult
    | ParseCommandAwaitRoadrunnerResult
    | ParseCommandCoyoteEngineTestResult
    | ParseCommandCoyoteAffinitiesTestResult
    | ParseCommandUnimplementedResult
    | ParseCommandUnknownResult

export function isParseCommandErrorResult(
    result: ParseCommandResult
): result is ParseCommandErrorResult {
    return result.type === 'Error'
}

export function isParseCommandAcmeOrderIntentResult(
    result: IntentClassificationResult | ParseCommandResult
): result is ParseCommandAcmeOrderIntentResult {
    if (result.type !== 'AcmeOrderIntent') {
        return false
    }
    return isParseConfidence(result.confidence)
}

export function isParseCommandAwaitRoadrunnerResult(
    result: ParseCommandResult | IntentClassificationResult
): result is ParseCommandAwaitRoadrunnerResult {
    if (result.type !== 'AwaitRoadRunner') {
        return false
    }
    return isParseConfidence(result.confidence)
}

export function isParseCommandNavigationResult(
    result: ParseCommandResult
): result is ParseCommandNavigationResult {
    if (result.type !== 'Navigation') {
        return false
    }
    return isEphemeraRoomId(result.targetId) && isParseConfidence(result.confidence)
}

export function isParseCommandAcmeOrderResult(
    result: ParseCommandResult
): result is ParseCommandAcmeOrderResult {
    if (result.type !== 'AcmeOrder') {
        return false
    }
    if (!isParseConfidence(result.confidence)) {
        return false
    }
    if (!Array.isArray(result.orders) || result.orders.length === 0) {
        return false
    }
    return result.orders.every((line) => {
        if (!line || typeof line !== 'object' || Array.isArray(line)) {
            return false
        }
        const entry = line as Record<string, unknown>
        if (typeof entry.valid !== 'boolean') {
            return false
        }
        if (typeof entry.name !== 'string' || entry.name.trim().length === 0) {
            return false
        }
        if (entry.valid && entry.errorType !== undefined) {
            return false
        }
        if (!entry.valid && !isParseCommandAcmeOrderErrorType(entry.errorType)) {
            return false
        }
        if (!Array.isArray(entry.affinities)) {
            return false
        }
        if (!entry.affinities.every((x) => isCoyoteAffinityPossibility(x))) {
            return false
        }
        if ('affinitiesFailed' in entry && typeof entry.affinitiesFailed !== 'boolean') {
            return false
        }
        if ('stableKey' in entry && typeof entry.stableKey !== 'string') {
            return false
        }
        if (entry.valid === true && entry.affinitiesFailed === true) {
            return entry.affinities.length === 0
        }
        return true
    })
}

export function isParseCommandCoyoteEngineTestResult(
    result: ParseCommandResult
): result is ParseCommandCoyoteEngineTestResult {
    if (result.type !== 'CoyoteEngineTest') {
        return false
    }
    return isParseConfidence(result.confidence)
}

export function isParseCommandCoyoteAffinitiesTestResult(
    result: ParseCommandResult
): result is ParseCommandCoyoteAffinitiesTestResult {
    if (result.type !== 'CoyoteAffinitiesTest') {
        return false
    }
    return isParseConfidence(result.confidence)
}

export function isParseCommandUnimplementedResult(
    result: ParseCommandResult | IntentClassificationResult
): result is ParseCommandUnimplementedResult {
    if (result.type !== 'Unimplemented') {
        return false
    }
    return isParseConfidence(result.confidence)
}

export function isParseCommandUnknownResult(
    result: ParseCommandResult | IntentClassificationResult
): result is ParseCommandUnknownResult {
    if (result.type !== 'Unknown') {
        return false
    }
    return isParseConfidence(result.confidence)
}

export type ParseCommandInput = {
    command: string
    /** Coyote-wide **`stableKey`** occupancy for Step B enrich (omit or **[]** when unknown). */
    occupiedStableKeys?: readonly string[]
}

export type ParseCommandDeps = {
    /** Tests inject a mock; production uses Bedrock Nova via `invokeBedrockParseCommand` in generateExample. */
    invokeBedrockParseCommandImpl?: typeof import('../../generateExample/invokeBedrockParseCommand').invokeBedrockParseCommand;
    /** Second Bedrock call for Acme line enrichment; tests may inject a mock. */
    invokeBedrockAcmeOrderEnrichImpl?: typeof import('../../generateExample/invokeBedrockAcmeOrderEnrich').invokeBedrockAcmeOrderEnrich;
}
