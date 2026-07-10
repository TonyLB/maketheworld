import { invokeBedrockObjectManipulationEnrich } from '../../../../generateExample/invokeBedrockObjectManipulationEnrich'
import internalCache from '../../../../internalCache'
import type {
    ParseCommandErrorResult,
    ParseCommandObjectManipulationResult,
} from '../../baseClasses'
import { buildObjectManipulationComplexityPrompt } from './buildPrompt'
import { mergeObjectManipulationCatalogs } from './catalogMerge'
import {
    evaluateComplexityPreGates,
    preGateOutcomeToTerminalError,
} from './complexityPreGates'
import { runIdentityStage, type IdentityStageDeps } from './identityStage'
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
import { selectMembershipFromPool } from './selectMembershipFromPool'

export type CompileMembershipAtomicDeps = {
    invokeBedrockObjectManipulationEnrichImpl?: typeof invokeBedrockObjectManipulationEnrich
    invokeBedrockObjectManipulationComplexityImpl?: typeof invokeBedrockObjectManipulationEnrich
    positionsReadDeps?: ObjectManipulationPositionsReadDeps
} & Pick<IdentityStageDeps, 'embedSpan'>

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
    const roomObjectCatalog = frame.roomObjectCatalog ?? []
    const heldInventoryCatalog = frame.heldInventoryCatalog ?? []
    const identityCatalog = mergeObjectManipulationCatalogs(roomObjectCatalog, heldInventoryCatalog)

    const identityResult = await runIdentityStage(
        frame.command,
        frame.rawObjectSpans,
        identityCatalog,
        { embedSpan: deps.embedSpan }
    )
    if (identityResult.type === 'error') {
        return { type: 'Error', errorMessage: identityResult.errorMessage }
    }

    // FT-2.2: propose-N + FT-5 selector (locus legality). Exit-edge defer still uses
    // post-select observation + complexity LLM until FT-3 sandbox retirement.
    const selection = selectMembershipFromPool({
        spanPools: identityResult.spanPools,
        verbClass: frame.verbClass,
        catalog: identityCatalog,
        commandSpan: frame.rawObjectSpans[0],
    })

    if (selection.type === 'error') {
        return { type: 'Error', errorMessage: selection.errorMessage }
    }

    const objectId = selection.objectId
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

    if (selection.type === 'resolved' && preGateOutcome.type === 'atomic') {
        // Selector already chose operationKind via locus legality; skip reject-only
        // verbMembershipAgreement (FT-2.2 illegal-if-wrong / "drop bag").
        return {
            type: 'ObjectManipulation',
            operationKind: selection.operationKind,
            objectId,
            confidence: intentConfidence,
        }
    }

    // defer from selector (unmodeled locus) or exit-edge / non-atomic pre-gate
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
