import { v4 as uuidv4 } from 'uuid'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { PositionsPublishedPayload } from '../../publishedEvents'
import type { MessageBus } from '../../../../messageBus/baseClasses'
import internalCache from '../../../../internalCache'
import { commitStepSequence } from '../kernel/commitStepSequence'
import type { CommitStepSequenceDeps } from '../kernel/commitStepSequence'
import { compilePositionKernelOp } from '../kernel/compile/compilePositionKernelOp'
import { isKernelMutationStep } from '../kernel/kernelStep'
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
 * The object-lifecycle administrative membership move --- room place/remove, spawn, destroy/edit,
 * drift repair. One call site for every non-narrating object rehost.
 *
 * **Character routes no longer call this function** (3e, MS-2, 2026-09-08): `orchestrateCharacterRoomMembership`
 * now builds and compiles its plan upstream via `planCharacterMoveTransfer` and commits directly.
 * **Take/drop/give no longer calls this function either** (3d, 2026-09-08): `honorDefer`, the mode
 * that let a single caller (`orchestrateObjectMove`) opt into a player-refusable, single-hop
 * defer-aware check, is deleted --- that path is `planObjectMoveTransfer` (dry-run via 3c's
 * `dryRunStepSequence`, then `repairMechanicalDissolve` or refusal), which builds and commits its
 * own plan without going through this function at all. What remains here is exactly the
 * administrative object path MS-8 (2026-09-06) unified from `applyObjectRoomMembership`/
 * `applyObjectClearMembership`/`executeObjectMove`'s non-take/drop callers: unconditional, no
 * legality question, "may sever anything" (`repairAdministrativeChainDissolve`, its own named
 * sibling repair policy to `repairMechanicalDissolve`).
 *
 * The committed step sequence is built by the same shared `compilePositionKernelOp` every narrating
 * route already routes through (3e, MS-2) --- fed a bare `{ kind: 'move', ... }` op literal, since an
 * administrative move has no narration ingredients to carry. `compilePositionKernelOp`'s non-narration
 * branch produces the identical `[transferMembership, ...presencePortSteps]` shape this function used
 * to hand-build directly.
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

    const { steps: compiledSteps } = compilePositionKernelOp({
        kind: 'move',
        moved: args.entityId,
        froms,
        to: args.target,
        bundleId: uuidv4(),
        headerSlot: null,
    })
    const steps = compiledSteps.filter(isKernelMutationStep)

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
