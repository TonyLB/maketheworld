import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { PositionsPublishedPayload } from '../../publishedEvents'
import type { MessageBus } from '../../../../messageBus/baseClasses'
import { commitStepSequence } from '../kernel/commitStepSequence'
import type { CommitStepSequenceDeps, CommitStepSequenceTransactItem } from '../kernel/commitStepSequence'
import { compilePositionKernelOp } from '../kernel/compile/compilePositionKernelOp'
import { isKernelMutationStep } from '../kernel/kernelStep'
import { BASE_PRESENCE_ID } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraLudicGraph } from '../../ludicGraph'
import { defaultGetGraph } from '../relational/findRelationalChainsForRemoval'
import { destinationBindingOf } from './resolvePresenceMoves'
import type { MutationKernelCreateComponentStep, MutationKernelStep } from '../kernel/kernelStep'

export type ExecuteComponentCreationArgs = {
    objectId: EphemeraObjectId
    /** The host row's non-graph fields; the kernel adds `ludicGraph`. */
    meta: MutationKernelCreateComponentStep['meta']
    /**
     * Where the component is placed in the same commit. `null` creates it unplaced, holding only its
     * hostless remainder (legal; no v1 caller uses it).
     */
    target: EphemeraMembershipHostId | null
    /** injectable for test seams only. */
    getGraph?: (hostId: EphemeraMembershipHostId) => Promise<EphemeraLudicGraph>
    /** The caller's own rows for this component (opaque here), written in the same transaction. */
    existenceItems?: readonly CommitStepSequenceTransactItem[]
    messageBus: MessageBus
    streamEvent: StreamEventFunction<PositionsPublishedPayload>
    afterPersist?: CommitStepSequenceDeps['afterPersist']
    transactWrite?: CommitStepSequenceDeps['transactWrite']
}

export type ExecuteComponentCreationResult =
    | { ok: true; beatAnchorTime: number }
    | { ok: false; errorCode?: string; errorMessage?: string }

/**
 * Creates a component and places it, as one kernel commit: `createComponent` (the host row, born
 * holding its hostless `PRESENCE#Base`) followed by the first-placement move, which re-points that
 * remainder at `target`. The one emitter of `createComponent`. Nothing exists unless everything
 * commits, so a failed placement leaves no row to compensate for.
 */
export const executeComponentCreation = async (
    args: ExecuteComponentCreationArgs
): Promise<ExecuteComponentCreationResult> => {
    const createStep: MutationKernelCreateComponentStep = {
        kind: 'createComponent',
        hostId: args.objectId,
        meta: args.meta,
    }
    // The first placement moves the remainder `createComponent` seeds (`from: null`), so the binding's
    // id is the fixed `PRESENCE#Base` and needs no read; only the destination's binding is looked up.
    const destination = args.target === null
        ? undefined
        : destinationBindingOf(await (args.getGraph ?? defaultGetGraph)(args.target), undefined)
    if (destination && 'errorCode' in destination) {
        console.error(`[mtw.ephemera.positions] executeComponentCreation refused for ${args.objectId}: ${destination.errorCode}`)
        return { ok: false, errorCode: destination.errorCode, errorMessage: destination.errorCode }
    }
    const placementSteps: MutationKernelStep[] = args.target === null || !destination
        ? []
        : compilePositionKernelOp({
            kind: 'move',
            moved: args.objectId,
            froms: [],
            to: args.target,
            header: null,
            presenceMoves: [{
                presence: BASE_PRESENCE_ID,
                from: null,
                to: { host: args.target, presence: destination.presence },
            }],
        }).steps.filter(isKernelMutationStep)

    const result = await commitStepSequence(
        {
            steps: [createStep, ...placementSteps],
            ...(args.existenceItems ? { existenceItems: args.existenceItems } : {}),
        },
        {
            messageBus: args.messageBus,
            streamEvent: args.streamEvent,
            // a new component carries no relational edge, so no relational step needs a host resolved.
            getCurrentHost: () => undefined,
            ...(args.afterPersist ? { afterPersist: args.afterPersist } : {}),
            ...(args.transactWrite ? { transactWrite: args.transactWrite } : {}),
        }
    )

    if (!result.ok) {
        console.error(`[mtw.ephemera.positions] executeComponentCreation failed: ${result.errorMessage}`)
        return { ok: false, errorCode: result.errorCode, errorMessage: result.errorMessage }
    }

    return { ok: true, beatAnchorTime: result.beatAnchorTime }
}
