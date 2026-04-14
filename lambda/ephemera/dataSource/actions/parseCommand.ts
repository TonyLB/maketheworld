import { EphemeraRoomId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

/**
 * Parser result for action ingress. Extend with non-error variants as the contract grows.
 */
export type ParseCommandErrorResult = {
    type: 'Error'
    errorMessage?: string
}

export type ParseCommandNavigationResult = {
    type: 'Navigation'
    targetId: EphemeraRoomId
}

/** Coyote Game: order line routed to Acme-themed affordances. */
export type ParseCommandAcmeOrderResult = {
    type: 'AcmeOrder'
    order: string
}

/** Coyote Game: wait-state for Road Runner encounter flows. */
export type ParseCommandAwaitRoadrunnerResult = {
    type: 'AwaitRoadRunner'
}

export type ParseCommandUnimplementedResult = {
    type: 'Unimplemented'
}

export type ParseCommandUnknownResult = {
    type: 'Unknown'
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
    return result.type === 'Navigation' && isEphemeraRoomId(result.targetId)
}

export function isParseCommandAcmeOrderResult(
    result: ParseCommandResult
): result is ParseCommandAcmeOrderResult {
    return result.type === 'AcmeOrder' && typeof result.order === 'string'
}

export function isParseCommandAwaitRoadrunnerResult(
    result: ParseCommandResult
): result is ParseCommandAwaitRoadrunnerResult {
    return result.type === 'AwaitRoadRunner'
}

export function isParseCommandUnimplementedResult(
    result: ParseCommandResult
): result is ParseCommandUnimplementedResult {
    return result.type === 'Unimplemented'
}

export function isParseCommandUnknownResult(
    result: ParseCommandResult
): result is ParseCommandUnknownResult {
    return result.type === 'Unknown'
}

export type ParseCommandInput = {
    command: string
}

/**
 * Stub: returns a fixed Error-shaped result until the LLM / validation pipeline is wired.
 */
export async function parseCommand(_input: ParseCommandInput): Promise<ParseCommandResult> {
    return { type: 'Error' }
}
