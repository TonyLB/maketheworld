import { invokeBedrockObjectManipulationEnrich } from '../../../../generateExample/invokeBedrockObjectManipulationEnrich'
import internalCache from '../../../../internalCache'
import type {
    ParseCommandErrorResult,
    ParseCommandObjectManipulationResult,
} from '../../baseClasses'
import { buildObjectManipulationComplexityPrompt } from './buildPrompt'
import { mergeObjectManipulationCatalogs } from './catalogMerge'
import { complexErrorMessage } from './complexityClasses'
import {
    evaluateComplexityPreGates,
    preGateOutcomeToTerminalError,
} from './complexityPreGates'
import { runIdentityStage } from './identityStage'
import {
    finalizeComplexityFromEnrich,
    interpretObjectManipulationComplexityBody,
    type ObjectManipulationComplexityModelResponse,
} from './interpretAndFinalize'
import type { MembershipManipulationFrame } from './membershipFrame'
import {
    observeMembershipForObject,
    type ObjectManipulationPositionsReadDeps,
} from './membershipObservation'
import { commandHasRelationalPreposition } from './relationalPrepositionGuard'
import { collapseUnaryGrounding } from './unaryCollapse'
import { evaluateVerbMembershipAgreement } from './verbMembershipAgreement'

export type CompileMembershipAtomicDeps = {
    invokeBedrockObjectManipulationEnrichImpl?: typeof invokeBedrockObjectManipulationEnrich
    invokeBedrockObjectManipulationIdentityImpl?: typeof invokeBedrockObjectManipulationEnrich
    invokeBedrockObjectManipulationComplexityImpl?: typeof invokeBedrockObjectManipulationEnrich
    positionsReadDeps?: ObjectManipulationPositionsReadDeps
}

export type CompileMembershipAtomicResult = ParseCommandObjectManipulationResult | ParseCommandErrorResult

const defaultPositionsReadDeps = (): ObjectManipulationPositionsReadDeps => ({
    getMembershipContainers: (objectId) => internalCache.Positions.getMembershipContainers(objectId),
    getPositionGraph: (hostId) => internalCache.Positions.getPositionGraph(hostId),
})

export async function compileMembershipAtomic(
    frame: MembershipManipulationFrame,
    intentConfidence: number,
    deps: CompileMembershipAtomicDeps = {}
): Promise<CompileMembershipAtomicResult> {
    if (commandHasRelationalPreposition(frame.command)) {
        return {
            type: 'Error',
            errorMessage: complexErrorMessage('relationalPlacement'),
        }
    }

    const roomObjectCatalog = frame.roomObjectCatalog ?? []
    const heldInventoryCatalog = frame.heldInventoryCatalog ?? []
    const identityCatalog = mergeObjectManipulationCatalogs(roomObjectCatalog, heldInventoryCatalog)

    const identityResult = await runIdentityStage(
        frame.command,
        frame.rawObjectSpans,
        identityCatalog,
        {
            invokeBedrockObjectManipulationIdentityImpl:
                deps.invokeBedrockObjectManipulationIdentityImpl
                ?? deps.invokeBedrockObjectManipulationEnrichImpl,
        }
    )
    if (identityResult.type === 'error') {
        return { type: 'Error', errorMessage: identityResult.errorMessage }
    }

    const collapseResult = collapseUnaryGrounding(identityResult.spanGroundings)
    if (collapseResult.type === 'error') {
        return { type: 'Error', errorMessage: collapseResult.errorMessage }
    }

    const { objectId } = collapseResult
    const positionsReadDeps = deps.positionsReadDeps ?? defaultPositionsReadDeps()
    const observation = await observeMembershipForObject(objectId, positionsReadDeps)
    const preGateOutcome = evaluateComplexityPreGates({
        objectId,
        containers: observation.containers,
        positionGraph: observation.positionGraph,
        actorCharacterId: frame.characterId,
    })

    const preGateError = preGateOutcomeToTerminalError(preGateOutcome)
    if (preGateError !== null) {
        return { type: 'Error', errorMessage: preGateError }
    }

    if (preGateOutcome.type === 'atomic') {
        const agreement = evaluateVerbMembershipAgreement(frame.verbClass, preGateOutcome)
        if (agreement.type === 'disagreement') {
            return { type: 'Error', errorMessage: agreement.errorMessage }
        }
        return {
            type: 'ObjectManipulation',
            operationKind: agreement.operationKind,
            objectId,
            confidence: intentConfidence,
        }
    }

    const invokeComplexity = deps.invokeBedrockObjectManipulationComplexityImpl
        ?? deps.invokeBedrockObjectManipulationEnrichImpl
        ?? invokeBedrockObjectManipulationEnrich
    const complexityPromptParts = buildObjectManipulationComplexityPrompt(frame.command, {
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
