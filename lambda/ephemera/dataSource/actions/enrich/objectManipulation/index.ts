import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { invokeBedrockObjectManipulationEnrich } from '../../../../generateExample/invokeBedrockObjectManipulationEnrich'
import internalCache from '../../../../internalCache'
import type {
    ParseCommandErrorResult,
    ParseCommandObjectManipulationResult,
} from '../../baseClasses'
import type { RoomInPlayObjectCatalogEntry } from '../../roomObjectCatalogForCharacter'
import { evaluateCardinalityGate } from './cardinalityGate'
import { buildObjectManipulationComplexityPrompt } from './buildPrompt'
import { catalogWithScope } from './catalogMerge'
import { complexErrorMessage } from './complexityClasses'
import {
    evaluateComplexityPreGates,
    preGateOutcomeToTerminalError,
} from './complexityPreGates'
import { inferObjectManipulationVerb } from './inferManipulationVerb'
import { runIdentityStage } from './identityStage'
import {
    finalizeComplexityFromEnrich,
    interpretObjectManipulationComplexityBody,
    type ObjectManipulationComplexityModelResponse,
} from './interpretAndFinalize'
import {
    observeMembershipForObject,
    type ObjectManipulationPositionsReadDeps,
} from './membershipObservation'
import {
    objectManipulationErrorMessages,
    resolveObjectSpanToObjectId,
} from './resolveObjectSpan'
import { collapseUnaryGrounding } from './unaryCollapse'

export type EnrichObjectManipulationInput = {
    command: string
    rawObjectSpans: readonly string[]
    characterId?: EphemeraCharacterId
    roomObjectCatalog?: readonly RoomInPlayObjectCatalogEntry[]
    heldInventoryCatalog?: readonly RoomInPlayObjectCatalogEntry[]
}

export type EnrichObjectManipulationResult = ParseCommandObjectManipulationResult | ParseCommandErrorResult

export type EnrichObjectManipulationDeps = {
    invokeBedrockObjectManipulationEnrichImpl?: typeof invokeBedrockObjectManipulationEnrich
    invokeBedrockObjectManipulationIdentityImpl?: typeof invokeBedrockObjectManipulationEnrich
    invokeBedrockObjectManipulationComplexityImpl?: typeof invokeBedrockObjectManipulationEnrich
    positionsReadDeps?: ObjectManipulationPositionsReadDeps
}

const defaultPositionsReadDeps = (): ObjectManipulationPositionsReadDeps => ({
    getMembershipContainers: (objectId) => internalCache.Positions.getMembershipContainers(objectId),
    getPositionGraph: (hostId) => internalCache.Positions.getPositionGraph(hostId),
})

function inRoomOnlyDropError(
    rawObjectSpans: readonly string[],
    roomObjectCatalog: readonly RoomInPlayObjectCatalogEntry[]
): ParseCommandErrorResult | null {
    for (const rawObjectSpan of rawObjectSpans) {
        const resolution = resolveObjectSpanToObjectId(rawObjectSpan, roomObjectCatalog)
        if (resolution.type === 'Resolved') {
            return {
                type: 'Error',
                errorMessage: objectManipulationErrorMessages.notCarryingObject,
            }
        }
    }
    return null
}

export async function enrichObjectManipulation(
    input: EnrichObjectManipulationInput,
    intentConfidence: number,
    deps: EnrichObjectManipulationDeps = {}
): Promise<EnrichObjectManipulationResult> {
    const cardinalityOutcome = evaluateCardinalityGate(input.rawObjectSpans)
    if (cardinalityOutcome.type === 'complex') {
        return {
            type: 'Error',
            errorMessage: complexErrorMessage(cardinalityOutcome.complexityClass),
        }
    }

    const manipulationVerb = inferObjectManipulationVerb(input.command)
    const roomObjectCatalog = input.roomObjectCatalog ?? []
    const heldInventoryCatalog = input.heldInventoryCatalog ?? []
    const identityCatalog = manipulationVerb === 'drop'
        ? catalogWithScope(heldInventoryCatalog, 'held')
        : catalogWithScope(roomObjectCatalog, 'room')

    const identityResult = await runIdentityStage(
        input.command,
        input.rawObjectSpans,
        identityCatalog,
        {
            invokeBedrockObjectManipulationIdentityImpl:
                deps.invokeBedrockObjectManipulationIdentityImpl
                ?? deps.invokeBedrockObjectManipulationEnrichImpl,
        }
    )
    if (identityResult.type === 'error') {
        if (manipulationVerb === 'drop') {
            const inRoomOnly = inRoomOnlyDropError(input.rawObjectSpans, roomObjectCatalog)
            if (inRoomOnly !== null) {
                return inRoomOnly
            }
        }
        return { type: 'Error', errorMessage: identityResult.errorMessage }
    }

    const collapseResult = collapseUnaryGrounding(identityResult.spanGroundings)
    if (collapseResult.type === 'error') {
        if (manipulationVerb === 'drop') {
            const inRoomOnly = inRoomOnlyDropError(input.rawObjectSpans, roomObjectCatalog)
            if (inRoomOnly !== null) {
                return inRoomOnly
            }
        }
        return { type: 'Error', errorMessage: collapseResult.errorMessage }
    }

    const { objectId } = collapseResult
    const positionsReadDeps = deps.positionsReadDeps ?? defaultPositionsReadDeps()
    const observation = await observeMembershipForObject(objectId, positionsReadDeps)
    const preGateOutcome = evaluateComplexityPreGates({
        objectId,
        containers: observation.containers,
        positionGraph: observation.positionGraph,
        actorCharacterId: input.characterId,
    })

    const preGateError = preGateOutcomeToTerminalError(preGateOutcome)
    if (preGateError !== null) {
        return { type: 'Error', errorMessage: preGateError }
    }

    if (preGateOutcome.type === 'atomic') {
        return {
            type: 'ObjectManipulation',
            operationKind: preGateOutcome.operationKind,
            objectId,
            confidence: intentConfidence,
        }
    }

    const invokeComplexity = deps.invokeBedrockObjectManipulationComplexityImpl
        ?? deps.invokeBedrockObjectManipulationEnrichImpl
        ?? invokeBedrockObjectManipulationEnrich
    const complexityPromptParts = buildObjectManipulationComplexityPrompt(input.command, {
        objectId,
        containers: observation.containers,
        positionGraph: observation.positionGraph,
    })
    const complexityInvoke = await invokeComplexity(complexityPromptParts)

    let complexityInvokeFailed = !complexityInvoke.success
    let complexityResponse: ObjectManipulationComplexityModelResponse | null = null
    let parseFailureReason: string | undefined

    if (complexityInvoke.success) {
        const parsed = interpretObjectManipulationComplexityBody(complexityInvoke.body)
        if (parsed.success) {
            complexityResponse = parsed.response
        } else {
            complexityInvokeFailed = true
            parseFailureReason = parsed.errorMessage
        }
    }

    const result = finalizeComplexityFromEnrich(
        intentConfidence,
        objectId,
        complexityResponse,
        complexityInvokeFailed
    )

    if (complexityInvokeFailed && result.type === 'Error' && parseFailureReason !== undefined) {
        return { type: 'Error', errorMessage: parseFailureReason }
    }

    return result
}
