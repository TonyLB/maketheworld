import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { PositionsPublishedPayload } from '../../publishedEvents'
import type { MessageBus } from '../../../../messageBus/baseClasses'
import internalCache from '../../../../internalCache'
import { commitStepSequence } from '../kernel/commitStepSequence'
import type { CommitStepSequenceDeps, CommitStepSequenceTransactItem } from '../kernel/commitStepSequence'
import { compilePositionKernelOp } from '../kernel/compile/compilePositionKernelOp'
import { isKernelMutationStep } from '../kernel/kernelStep'
import type { MutationKernelStep } from '../kernel/kernelStep'
import type { EphemeraLudicGraph } from '../../ludicGraph'
import { defaultGetGraph } from '../relational/findRelationalChainsForRemoval'
import { repairAdministrativeChainDissolve } from './repairAdministrativeChainDissolve'
import { resolvePresenceMoves } from './resolvePresenceMoves'

export type ExecuteComponentDestructionArgs = {
    objectId: EphemeraObjectId
    /** The caller's own rows for this component (opaque here), deleted in the same transaction. */
    existenceItems?: readonly CommitStepSequenceTransactItem[]
    messageBus: MessageBus
    streamEvent: StreamEventFunction<PositionsPublishedPayload>
    /** Runs once the commit has persisted, before facts stream; handed the hosts the component left. */
    afterPersist?: (froms: EphemeraMembershipHostId[]) => void
    getMembershipContainers?: (id: EphemeraObjectId | EphemeraCharacterId) => Promise<EphemeraMembershipHostId[]>
    getGraph?: (hostId: EphemeraMembershipHostId) => Promise<EphemeraLudicGraph>
    transactWrite?: CommitStepSequenceDeps['transactWrite']
}

export type ExecuteComponentDestructionResult =
    | { ok: true; froms: EphemeraMembershipHostId[]; beatAnchorTime: number }
    | { ok: false; errorCode?: string; errorMessage?: string }

const defaultGetMembershipContainers = (id: EphemeraObjectId | EphemeraCharacterId): Promise<EphemeraMembershipHostId[]> =>
    internalCache.Positions.getMembershipContainers(id)

/**
 * Destroys a component as one kernel commit: the administrative chain sweep, the release of each of
 * its bindings (skipped for an orphan, which has none), then `destroyComponent`, which deletes the host
 * row. The one emitter of `destroyComponent`, as `executeComponentCreation` is of `createComponent`.
 * The kernel refuses if the host still holds anything of its own, so contents must be destroyed or
 * moved out first.
 */
export const executeComponentDestruction = async (
    args: ExecuteComponentDestructionArgs
): Promise<ExecuteComponentDestructionResult> => {
    const getMembershipContainers = args.getMembershipContainers ?? defaultGetMembershipContainers
    const getGraph = args.getGraph ?? defaultGetGraph

    const froms = await getMembershipContainers(args.objectId)
    const { dissolveSteps, hostByReferencedId } = await repairAdministrativeChainDissolve(
        args.objectId,
        getMembershipContainers,
        getGraph
    )
    const resolved = froms.length === 0
        ? { ok: true as const, steps: [] }
        : await resolvePresenceMoves({ moved: args.objectId, froms, to: null, getGraph })
    if (!resolved.ok) {
        console.error(`[mtw.ephemera.positions] executeComponentDestruction refused for ${args.objectId}: ${resolved.errorCode}`)
        return { ok: false, errorCode: resolved.errorCode, errorMessage: resolved.errorCode }
    }
    const moveSteps: MutationKernelStep[] = resolved.steps.length === 0
        ? []
        : compilePositionKernelOp({
            kind: 'move',
            moved: args.objectId,
            froms,
            to: null,
            header: null,
            presenceSteps: resolved.steps,
        }).steps.filter(isKernelMutationStep)

    const result = await commitStepSequence(
        {
            steps: [...dissolveSteps, ...moveSteps, { kind: 'destroyComponent', hostId: args.objectId }],
            ...(args.existenceItems ? { existenceItems: args.existenceItems } : {}),
        },
        {
            messageBus: args.messageBus,
            streamEvent: args.streamEvent,
            getCurrentHost: (id) => hostByReferencedId.get(id),
            ...(args.afterPersist ? { afterPersist: () => args.afterPersist!(froms) } : {}),
            ...(args.transactWrite ? { transactWrite: args.transactWrite } : {}),
        }
    )

    if (!result.ok) {
        console.error(`[mtw.ephemera.positions] executeComponentDestruction failed: ${result.errorMessage}`)
        return { ok: false, errorCode: result.errorCode, errorMessage: result.errorMessage }
    }

    return { ok: true, froms, beatAnchorTime: result.beatAnchorTime }
}
