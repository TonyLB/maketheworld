import { invokeBedrockObjectManipulationEnrich } from '../../../../generateExample/invokeBedrockObjectManipulationEnrich'
import internalCache from '../../../../internalCache'
import type { EphemeraLudicGraph } from '../../../positions/ludicGraph'
import type {
    ParseCommandAbstainResult,
    ParseCommandConsultResult,
    ParseCommandErrorResult,
    ParseCommandObjectManipulationResult,
} from '../../baseClasses'
import { buildObjectManipulationComplexityPrompt } from './buildPrompt'
import { mergeObjectManipulationCatalogs } from './catalogMerge'
import {
    evaluateComplexityPreGates,
    preGateOutcomeToTerminalError,
} from './complexityPreGates'
import { complexErrorMessage } from './complexityClasses'
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
import { buildSandboxState } from './sandboxState'
import { selectMembershipFromPool } from './selectMembershipFromPool'

export type CompileMembershipAtomicDeps = {
    invokeBedrockObjectManipulationEnrichImpl?: typeof invokeBedrockObjectManipulationEnrich
    invokeBedrockObjectManipulationComplexityImpl?: typeof invokeBedrockObjectManipulationEnrich
    positionsReadDeps?: ObjectManipulationPositionsReadDeps
} & Pick<IdentityStageDeps, 'embedSpan'>

export type CompileMembershipAtomicResult =
    | ParseCommandObjectManipulationResult
    | ParseCommandConsultResult
    | ParseCommandAbstainResult
    | ParseCommandErrorResult

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

    // BD-20 (2026-07-17): arity policy lives here, not ahead of Identify --- Identify
    // already resolves any number of independent spans fine (see runIdentityStage's
    // plain loop above); composing/applying more than one is unbuilt Plan-IR work
    // (BD-8/C2/C3), so this is where "not yet supported" is decided, not a pre-Identify gate.
    if (frame.rawObjectSpans.length > 1) {
        return { type: 'Error', errorMessage: complexErrorMessage('multiObject') }
    }

    // Slice 4b: sandbox-mediated selector (locus legality + exit-edge + boundary-edge
    // completeness, all decided here now, with real graph access --- not post-select).
    const positionsReadDeps = deps.positionsReadDeps ?? defaultPositionsReadDeps()
    const [roomGraph, characterGraph] = await Promise.all([
        frame.hostRoomId !== undefined ? positionsReadDeps.getPositionGraph(frame.hostRoomId) : undefined,
        frame.characterId !== undefined ? positionsReadDeps.getPositionGraph(frame.characterId) : undefined,
    ])
    const sandboxState = buildSandboxState(
        [roomGraph, characterGraph].filter((graph): graph is EphemeraLudicGraph => graph !== undefined)
    )

    const selection = selectMembershipFromPool({
        spanPools: identityResult.spanPools,
        verbClass: frame.verbClass,
        catalog: identityCatalog,
        sandboxState,
        roomId: frame.hostRoomId,
        actorCharacterId: frame.characterId,
        commandSpan: frame.rawObjectSpans[0],
    })

    if (selection.type === 'error') {
        return { type: 'Error', errorMessage: selection.errorMessage }
    }

    if (selection.type === 'abstain') {
        return {
            type: 'Abstain',
            confidence: intentConfidence,
            reason: selection.reason,
        }
    }

    if (selection.type === 'consult') {
        return {
            type: 'Consult',
            alternatives: selection.alternatives.map(({ proposedCommand, objectId }) => ({
                proposedCommand,
                objectId,
            })),
            confidence: intentConfidence,
        }
    }

    const objectId = selection.objectId
    const observation = await observeMembershipForObject(objectId, positionsReadDeps)
    const preGateOutcome = evaluateComplexityPreGates({
        objectId,
        containers: observation.containers,
    })

    const preGateError = preGateOutcomeToTerminalError(preGateOutcome)
    if (preGateError !== null) {
        return { type: 'Error', errorMessage: preGateError }
    }

    if (selection.type === 'resolved' && preGateOutcome.type === 'atomic') {
        // Selector already decided locus legality + exit-edge + boundary-edge completeness
        // (Slice 4b, sandbox-mediated); pre-gates here only rule out multiPresent.
        return {
            type: 'ObjectManipulation',
            operationKind: selection.operationKind,
            objectIds: selection.objectIds,
            confidence: intentConfidence,
        }
    }

    // defer from selector (unmodeled locus or exit-edge) or non-atomic pre-gate. Note: a
    // multi-object transfer (Expansion-computed, real and legal, but not yet appliable --- Pipeline
    // A -> B migration Slice 2) surfaces as an `illegal` dry-run reason, which --- with no legal or
    // defer candidates --- already terminated as `selection.type === 'error'` above, before
    // reaching this fallback at all.
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
