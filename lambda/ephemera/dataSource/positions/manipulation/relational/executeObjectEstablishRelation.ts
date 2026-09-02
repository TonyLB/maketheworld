import { isEphemeraLudicTerminalPrimitive } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraLudicTerminalPrimitive } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { PositionsPublishedPayload } from '../../publishedEvents'
import type { MessageBus } from '../../../../messageBus/baseClasses'
import { commitStepSequence } from '../kernel/commitStepSequence'
import type { CommitStepSequenceDeps } from '../kernel/commitStepSequence'
import type { MutationKernelStep } from '../kernel/kernelStep'
import type { MutationKernelCaptures } from '../kernel/types'

export type ExecuteEstablishEdgeChainArgs = {
    steps: readonly MutationKernelStep[]
    messageBus: MessageBus
    streamEvent: StreamEventFunction<PositionsPublishedPayload>
    suppressRelationalFacts?: boolean
    characterNames?: CommitStepSequenceDeps['characterNames']
    narratedInline?: boolean
    transactWrite?: CommitStepSequenceDeps['transactWrite']
}

export type ExecuteEstablishEdgeChainResult =
    | { ok: true; beatAnchorTime?: number; captures?: MutationKernelCaptures }
    | { ok: false; errorCode: string; errorMessage: string }

/**
 * PV1-3b-3, wired live at PV1-3b-2: the single commit path for `Object Establish Relation`,
 * having absorbed the single-host case that a now-deleted sibling (`executeObjectEstablishRelation`)
 * used to handle separately --- `steps` is a one-entry array for a portless/same-host candidate,
 * so there was nothing left for that function to do once this one's live call site landed.
 * `steps` arrives already merged and ordered (port steps before the legs that reference them, per
 * `buildCrossingLegs.ts`/`compileRelationalFromSkeleton.ts`), so this is a pure pass-through: no
 * separate whole-crossing verification layer, since `applyStepSequenceCore`'s per-step
 * `confirmCarriedHost` assert (PV1-3b-7) already re-checks every leg against live state at commit
 * time.
 *
 * `getCurrentHost` is built from each `establishRelation`/`dissolveRelation` step's own carried
 * `hostId` (PV1-3b-7), keyed by that step's primitive endpoint(s) --- `computeStepSequenceFootprint`
 * only ever calls it for a primitive endpoint (a port-address endpoint's host is locked directly by
 * the `addCrossingPort`/`removeCrossingPort` step that writes it, never resolved here). Unlike
 * `executeMembershipTransfer`'s `hostByReferencedId` (populated from a `boundaryEdgeOutcomes` walk),
 * this map needs no such walk --- the hosts are already sitting on the steps themselves.
 */
export const executeEstablishEdgeChain = async (
    args: ExecuteEstablishEdgeChainArgs
): Promise<ExecuteEstablishEdgeChainResult> => {
    const steps = args.steps.filter((step) => step.kind !== 'transferMembership')

    const hostByReferencedId = new Map<EphemeraLudicTerminalPrimitive, EphemeraMembershipHostId>()
    for (const step of steps) {
        if (step.kind !== 'establishRelation' && step.kind !== 'dissolveRelation') {
            continue
        }
        if (isEphemeraLudicTerminalPrimitive(step.subjectId)) {
            hostByReferencedId.set(step.subjectId, step.hostId)
        }
        if (isEphemeraLudicTerminalPrimitive(step.targetId)) {
            hostByReferencedId.set(step.targetId, step.hostId)
        }
    }

    const result = await commitStepSequence(
        { steps },
        {
            messageBus: args.messageBus,
            streamEvent: args.streamEvent,
            getCurrentHost: (id) => hostByReferencedId.get(id),
            ...(args.suppressRelationalFacts !== undefined ? { suppressRelationalFacts: args.suppressRelationalFacts } : {}),
            ...(args.characterNames ? { characterNames: args.characterNames } : {}),
            ...(args.narratedInline ? { narratedInline: true } : {}),
            ...(args.transactWrite ? { transactWrite: args.transactWrite } : {}),
        }
    )

    if (!result.ok) {
        console.error(`[mtw.ephemera.positions] executeEstablishEdgeChain failed: ${result.errorMessage}`)
        return { ok: false, errorCode: result.errorCode, errorMessage: result.errorMessage }
    }

    return { ok: true, beatAnchorTime: result.beatAnchorTime, captures: result.captures }
}
