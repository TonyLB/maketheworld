import { invokeBedrockObjectManipulationEnrich } from '../../../../generateExample/invokeBedrockObjectManipulationEnrich'
import internalCache from '../../../../internalCache'
import type {
    ParseCommandErrorResult,
    ParseCommandObjectManipulationResult,
} from '../../baseClasses'
import type { RoomInPlayObjectCatalogEntry } from '../../roomObjectCatalogForCharacter'
import { evaluateCardinalityGate } from './cardinalityGate'
import { buildParseObjectManipulationEnrichPrompt } from './buildPrompt'
import { complexErrorMessage } from './complexityClasses'
import {
    evaluateComplexityPreGates,
    preGateOutcomeToTerminalError,
} from './complexityPreGates'
import {
    finalizeObjectManipulationFromEnrich,
    interpretObjectManipulationEnrichBody,
    type ObjectManipulationEnrichModelResponse,
} from './interpretAndFinalize'
import {
    observeMembershipForObject,
    type ObjectManipulationPositionsReadDeps,
} from './membershipObservation'

export type EnrichObjectManipulationInput = {
    command: string
    rawObjectSpans: readonly string[]
    roomObjectCatalog?: readonly RoomInPlayObjectCatalogEntry[]
}

export type EnrichObjectManipulationResult = ParseCommandObjectManipulationResult | ParseCommandErrorResult

export type EnrichObjectManipulationDeps = {
    invokeBedrockObjectManipulationEnrichImpl?: typeof invokeBedrockObjectManipulationEnrich
    positionsReadDeps?: ObjectManipulationPositionsReadDeps
}

const defaultPositionsReadDeps = (): ObjectManipulationPositionsReadDeps => ({
    getMembershipContainers: (objectId) => internalCache.Positions.getMembershipContainers(objectId),
    getPositionGraph: (hostId) => internalCache.Positions.getPositionGraph(hostId),
})

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

    const catalog = input.roomObjectCatalog ?? []
    const invokeEnrich = deps.invokeBedrockObjectManipulationEnrichImpl ?? invokeBedrockObjectManipulationEnrich
    const enrichPromptParts = buildParseObjectManipulationEnrichPrompt(input.command, {
        rawObjectSpans: input.rawObjectSpans,
        catalog,
    })
    const enrichInvoke = await invokeEnrich(enrichPromptParts)

    let enrichInvokeFailed = !enrichInvoke.success
    let enrichResponse: ObjectManipulationEnrichModelResponse | null = null
    let parseFailureReason: string | undefined

    if (enrichInvoke.success) {
        const parsed = interpretObjectManipulationEnrichBody(enrichInvoke.body)
        if (parsed.success) {
            enrichResponse = parsed.response
        } else {
            enrichInvokeFailed = true
            parseFailureReason = parsed.errorMessage
        }
    }

    const result = finalizeObjectManipulationFromEnrich(
        intentConfidence,
        enrichResponse,
        enrichInvokeFailed,
        catalog
    )

    if (enrichInvokeFailed && result.type === 'Error' && parseFailureReason !== undefined) {
        return { type: 'Error', errorMessage: parseFailureReason }
    }

    if (result.type === 'ObjectManipulation') {
        const positionsReadDeps = deps.positionsReadDeps ?? defaultPositionsReadDeps()
        const observation = await observeMembershipForObject(result.objectId, positionsReadDeps)
        const preGateOutcome = evaluateComplexityPreGates({
            objectId: result.objectId,
            containers: observation.containers,
            positionGraph: observation.positionGraph,
        })
        const preGateError = preGateOutcomeToTerminalError(preGateOutcome)
        if (preGateError !== null) {
            return { type: 'Error', errorMessage: preGateError }
        }
    }

    return result
}
