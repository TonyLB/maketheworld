import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { MembershipEmissionCopyKind } from '../manipulation/kernel/kernelStep'
import type { MessageOrchestrationSlotSpec } from '../../messageOrchestration/localApiEvents'
import type { PositionKernelMoveOp } from '../manipulation/kernel/compile/positionKernelOp'

export type BuildMembershipMoveOpArgs = {
    characterId: EphemeraCharacterId
    characterName: string
    froms: EphemeraRoomId[]
    to: EphemeraRoomId | null
    bundleId: string
    intentKind: 'navigate' | 'home' | 'connect' | 'disconnect'
    intentFromRoomId?: EphemeraRoomId
    exitName?: string
    headerSlot: MessageOrchestrationSlotSpec | null
}

/**
 * Builds navigate/home/connect/disconnect's `PositionKernelMoveOp`, including the per-room leave
 * copy-kind selector --- a faithful port of the copy-kind selection the now-retired
 * `MembershipPresentationFanInCluster` used to re-derive from `(froms, to)` endpoint data at publish
 * time, now living at the compile boundary instead (Purpose finding 4 / PB-I). Shared by every
 * call site that needs this op --- `executeCharacterNavigate.ts`/`orchestrateNavigate.ts` (navigate/
 * home), `handleConnectionsCharactersPresence.ts` (connect/disconnect), `repairRoomOccupancyDrift.ts`
 * (ghost-purge disconnect, Phase 3) --- so the copy-kind logic exists in exactly one place.
 * `compilePositionKernelOp`'s captureId generation depends only on `froms`/`to` (never on narration
 * content), so building this op twice with the same `froms`/`to`/`bundleId` -- once without a
 * resolved `headerSlot` (mutation-only), once with (full plan) -- yields identical capture ids across
 * both calls, which is what lets the narration steps built in the second call reference captures
 * taken during the first call's committed transaction.
 *
 * Connect/disconnect (Phase 3) short-circuit the exit-aware/matches-intent-from logic entirely ---
 * that machinery exists to pick among several `froms` for a navigate/home move and is meaningless for
 * a fact-driven presence transition. Connect's `froms` is always `[]` (nothing to leave-narrate) and
 * disconnect's `to` is always `null` (nothing to arrive-narrate), so the unused half of each op's
 * copy-kind selector is simply never invoked --- the same tolerance navigate/home already rely on for
 * each other's unused branch.
 */
export const buildMembershipMoveOp = (args: BuildMembershipMoveOpArgs): PositionKernelMoveOp => {
    const baseCopyKind: MembershipEmissionCopyKind = args.intentKind === 'home'
        ? 'home'
        : args.intentKind === 'connect'
        ? 'connect'
        : args.intentKind === 'disconnect'
        ? 'disconnect'
        : (args.exitName ? 'exitAware' : 'genericNavigate')

    const leaveCopyKind = (fromRoomId: EphemeraMembershipHostId): MembershipEmissionCopyKind => {
        if (args.intentKind === 'disconnect') {
            return 'disconnect'
        }
        const matchesIntentFrom = args.intentFromRoomId === undefined || args.intentFromRoomId === fromRoomId
        if (baseCopyKind === 'exitAware' && matchesIntentFrom && args.exitName) {
            return 'exitAware'
        }
        if (args.froms.length === 1) {
            if (baseCopyKind === 'home') {
                return 'home'
            }
            if (baseCopyKind === 'genericNavigate' && matchesIntentFrom) {
                return 'genericNavigate'
            }
        }
        else if (args.intentFromRoomId === fromRoomId) {
            if (baseCopyKind === 'home') {
                return 'home'
            }
            if (baseCopyKind === 'genericNavigate') {
                return 'genericNavigate'
            }
        }
        return 'genericFactOnly'
    }

    return {
        kind: 'move',
        entityId: args.characterId,
        froms: args.froms,
        to: args.to,
        bundleId: args.bundleId,
        headerSlot: args.headerSlot,
        narration: {
            characterName: args.characterName,
            leaveCopyKind,
            arriveCopyKind: baseCopyKind,
            ...(args.exitName !== undefined ? { exitName: args.exitName } : {}),
        },
    }
}
