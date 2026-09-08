import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { PositionsPublishedPayload } from '../../publishedEvents'
import type { MessageBus } from '../../../../messageBus/baseClasses'
import internalCache from '../../../../internalCache'
import type { MutationKernelStep } from '../kernel/kernelStep'
import { commitStepSequence } from '../kernel/commitStepSequence'
import type { CommitStepSequenceDeps } from '../kernel/commitStepSequence'
import { presencePortStepsForMove } from '../kernel/compile/presencePortStepsForMove'
import type { MutationKernelCaptures } from '../kernel/types'
import type { EphemeraLudicGraph } from '../../ludicGraph'
import { defaultGetGraph } from '../relational/findRelationalChainsForRemoval'
import { repairAdministrativeChainDissolve } from './repairAdministrativeChainDissolve'

export type ExecuteMembershipTransferArgs = {
    entityId: EphemeraObjectId | EphemeraCharacterId
    /** null clears the entity from every current host (destroy/edit/disconnect) --- no arrival side. */
    target: EphemeraMembershipHostId | null
    messageBus: MessageBus
    streamEvent: StreamEventFunction<PositionsPublishedPayload>
    getMembershipContainers?: (id: EphemeraObjectId | EphemeraCharacterId) => Promise<EphemeraMembershipHostId[]>
    /** injectable for the same reason `getMembershipContainers` is --- test seams only. */
    getGraph?: (hostId: EphemeraMembershipHostId) => Promise<EphemeraLudicGraph>
    /** See `CommitStepSequenceDeps.suppressRelationalFacts`'s doc comment --- same gate, same default. */
    suppressRelationalFacts?: boolean
    /**
     * When supplied, called with the resolved diff to build the committed step sequence (the
     * compiler's `[capture, transfer, capture]` shape for navigate) instead of a bare
     * `transferMembership` step. Mirrors `MembershipApplyArgs.compileMutationSteps`.
     */
    compileMutationSteps?: (diff: { froms: EphemeraMembershipHostId[]; to: EphemeraMembershipHostId | null; changed: boolean }) => readonly MutationKernelStep[]
    characterNames?: CommitStepSequenceDeps['characterNames']
    transactWrite?: CommitStepSequenceDeps['transactWrite']
}

export type ExecuteMembershipTransferResult =
    | {
        ok: true
        froms: EphemeraMembershipHostId[]
        to: EphemeraMembershipHostId | null
        changed: boolean
        beatAnchorTime?: number
        captures?: MutationKernelCaptures
    }
    | { ok: false; errorCode?: string; errorMessage?: string }

const defaultGetMembershipContainers = (id: EphemeraObjectId | EphemeraCharacterId): Promise<EphemeraMembershipHostId[]> =>
    internalCache.Positions.getMembershipContainers(id)

/**
 * The administrative membership move --- room place/remove, spawn, destroy/edit, drift repair,
 * and (via `compileMutationSteps`) navigate/home/connect/disconnect's mutation half. Object or
 * character, one call site for every non-narrating rehost.
 *
 * **Take/drop/give no longer calls this function** (3d, 2026-09-08): `honorDefer`, the mode that
 * let a single caller (`orchestrateObjectMove`) opt into a player-refusable, single-hop
 * defer-aware check, is deleted --- that path is now `planObjectMoveTransfer` (dry-run via 3c's
 * `dryRunStepSequence`, then `repairMechanicalDissolve` or refusal), which builds and commits its
 * own plan without going through this function at all. What remains here is exactly the
 * administrative path MS-8 (2026-09-06) unified from `applyObjectRoomMembership`/
 * `applyObjectClearMembership`/`orchestrateCharacterRoomMembership`'s membership half and
 * `executeObjectMove`'s non-take/drop callers: unconditional, no legality question, "may sever
 * anything" (`repairAdministrativeChainDissolve`, its own named sibling repair policy to
 * `repairMechanicalDissolve`).
 */
export const executeMembershipTransfer = async (
    args: ExecuteMembershipTransferArgs
): Promise<ExecuteMembershipTransferResult> => {
    const getMembershipContainers = args.getMembershipContainers ?? defaultGetMembershipContainers
    const getGraph = args.getGraph ?? defaultGetGraph

    const priorContainers = await getMembershipContainers(args.entityId)
    const froms = priorContainers.filter((hostId) => hostId !== args.target)
    const changed = froms.length > 0 || (args.target !== null && !priorContainers.includes(args.target))
    const diff = { froms, to: args.target, changed }

    if (!changed) {
        return { ok: true, ...diff }
    }

    const { dissolveSteps, hostByReferencedId } = await repairAdministrativeChainDissolve(
        args.entityId,
        getMembershipContainers,
        getGraph
    )

    const steps: readonly MutationKernelStep[] = args.compileMutationSteps?.(diff) ?? [
        {
            kind: 'transferMembership',
            entityIds: new Set([args.entityId]),
            fromHostIds: new Set(froms),
            toHostId: args.target,
        },
        ...presencePortStepsForMove(args.entityId, froms, args.target),
    ]

    const result = await commitStepSequence(
        { steps: [...dissolveSteps, ...steps] },
        {
            messageBus: args.messageBus,
            streamEvent: args.streamEvent,
            getCurrentHost: (id) => hostByReferencedId.get(id),
            ...(args.suppressRelationalFacts !== undefined ? { suppressRelationalFacts: args.suppressRelationalFacts } : {}),
            ...(args.characterNames ? { characterNames: args.characterNames } : {}),
            ...(args.transactWrite ? { transactWrite: args.transactWrite } : {}),
        }
    )

    if (!result.ok) {
        console.error(`[mtw.ephemera.positions] executeMembershipTransfer failed: ${result.errorMessage}`)
        return { ok: false, errorCode: result.errorCode, errorMessage: result.errorMessage }
    }

    return { ok: true, ...diff, beatAnchorTime: result.beatAnchorTime, captures: result.captures }
}
