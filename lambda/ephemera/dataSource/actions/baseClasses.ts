import { EphemeraRoomId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

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

/** Coyote Game: order from Acme (mail-order, catalog, or unspecified). One or more product lines. */
export type ParseCommandAcmeOrderResult = {
    type: 'AcmeOrder'
    /** One entry per distinct product or line item (single-item orders use length 1). */
    orders: string[]
    confidence: ParseCommandConfidence
}

/** Coyote Game: wait-state for Road Runner encounter flows. */
export type ParseCommandAwaitRoadrunnerResult = {
    type: 'AwaitRoadRunner'
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
    | ParseCommandUnimplementedResult
    | ParseCommandUnknownResult

export function isParseCommandErrorResult(
    result: ParseCommandResult
): result is ParseCommandErrorResult {
    return result.type === 'Error'
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
    return result.orders.every((line) => typeof line === 'string' && line.trim().length > 0)
}

export function isParseCommandAwaitRoadrunnerResult(
    result: ParseCommandResult
): result is ParseCommandAwaitRoadrunnerResult {
    if (result.type !== 'AwaitRoadRunner') {
        return false
    }
    return isParseConfidence(result.confidence)
}

export function isParseCommandUnimplementedResult(
    result: ParseCommandResult
): result is ParseCommandUnimplementedResult {
    if (result.type !== 'Unimplemented') {
        return false
    }
    return isParseConfidence(result.confidence)
}

export function isParseCommandUnknownResult(
    result: ParseCommandResult
): result is ParseCommandUnknownResult {
    if (result.type !== 'Unknown') {
        return false
    }
    return isParseConfidence(result.confidence)
}

export type ParseCommandInput = {
    command: string
}

export type ParseCommandDeps = {
    /** Tests inject a mock; production uses Bedrock Nova via `invokeBedrockParseCommand` in generateExample. */
    invokeBedrockParseCommandImpl?: typeof import('../../generateExample/invokeBedrockParseCommand').invokeBedrockParseCommand;
}
