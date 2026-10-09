import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import internalCache from '../../../../internalCache'
import { compilePositionKernelOp } from '../kernel/compile/compilePositionKernelOp'
import type { CompiledPositionKernelPlan } from '../kernel/compile/compilePositionKernelOp'
import type { MoveHeaderBinding } from '../kernel/compile/positionKernelOp'
import { buildCharacterMoveOp } from './buildCharacterMoveOp'
import type { IntentKind } from './types'

export type PlanCharacterMoveTransferArgs = {
    characterId: EphemeraCharacterId
    characterName: string
    targetRoomId: EphemeraRoomId | null
    intentKind: IntentKind
    intentFromRoomId?: EphemeraRoomId
    exitName?: string
    /**
     * Async arrival-header resolution, supplied only by navigate/connect; disconnect/repair omit it.
     * Called only once the move is confirmed changed and has a real destination, so a no-op move
     * never pays for it --- matches today's behavior, where `presentCharacterMove` (the
     * only caller of `getCharacterRoomPerspectiveKey`) never runs for an unchanged move.
     */
    resolveHeader?: (to: EphemeraRoomId) => Promise<MoveHeaderBinding | null>
    /** injectable for test seams only. */
    getMembershipContainers?: (characterId: EphemeraCharacterId) => Promise<EphemeraRoomId[]>
}

export type PlanCharacterMoveTransferResult =
    | { ok: true; changed: false; froms: EphemeraRoomId[]; to: EphemeraRoomId | null }
    | { ok: true; changed: true; froms: EphemeraRoomId[]; to: EphemeraRoomId | null; plan: CompiledPositionKernelPlan }

const defaultGetMembershipContainers = async (characterId: EphemeraCharacterId): Promise<EphemeraRoomId[]> => {
    const containers = await internalCache.Positions.getMembershipContainers(characterId)
    return containers.filter((id): id is EphemeraRoomId => isEphemeraRoomId(id))
}

/**
 * Character-route sibling of `planObjectMoveTransfer` (3e): builds the diff, the op, and the
 * compiled plan exactly once, before commit --- replacing the `compileMutationSteps` callback that
 * used to defer the op build until inside `executeMembershipTransfer`. Character moves have no
 * legality question (no dry run, no repair branch): `repairAdministrativeChainDissolve` was always a
 * no-op for a character `entityId` (`HostRelationalEdge` is object-only), so nothing is lost by never
 * calling it here. Reads only --- `orchestrateCharacterRoomMembership` still owns the commit.
 */
export const planCharacterMoveTransfer = async (
    args: PlanCharacterMoveTransferArgs
): Promise<PlanCharacterMoveTransferResult> => {
    const getMembershipContainers = args.getMembershipContainers ?? defaultGetMembershipContainers

    const priorContainers = await getMembershipContainers(args.characterId)
    const froms = priorContainers.filter((roomId) => roomId !== args.targetRoomId)
    const changed = froms.length > 0 || (args.targetRoomId !== null && !priorContainers.includes(args.targetRoomId))

    if (!changed) {
        return { ok: true, changed: false, froms, to: args.targetRoomId }
    }

    const header = (args.resolveHeader && args.targetRoomId !== null)
        ? await args.resolveHeader(args.targetRoomId)
        : null

    const op = buildCharacterMoveOp({
        characterId: args.characterId,
        characterName: args.characterName,
        froms,
        to: args.targetRoomId,
        intentKind: args.intentKind,
        intentFromRoomId: args.intentFromRoomId,
        exitName: args.exitName,
        header,
    })

    const plan = compilePositionKernelOp(op)

    return { ok: true, changed: true, froms, to: args.targetRoomId, plan }
}
