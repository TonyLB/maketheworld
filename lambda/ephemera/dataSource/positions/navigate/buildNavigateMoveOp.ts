import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { MembershipEmissionCopyKind } from '../../perception/membershipPresentationFanIn'
import type { MessageOrchestrationSlotSpec } from '../../messageOrchestration/localApiEvents'
import type { PositionKernelMoveOp } from '../manipulation/kernel/compile/positionKernelOp'

export type BuildNavigateMoveOpArgs = {
    characterId: EphemeraCharacterId
    characterName: string
    froms: EphemeraRoomId[]
    to: EphemeraRoomId | null
    bundleId: string
    intentKind: 'navigate' | 'home'
    intentFromRoomId?: EphemeraRoomId
    exitName?: string
    headerSlot: MessageOrchestrationSlotSpec | null
}

/**
 * Builds navigate/home's `PositionKernelMoveOp`, including the per-room leave copy-kind selector ---
 * a faithful port of `leaveCopyKindForFrom`/`buildMembershipEmissionPlan`'s copy-kind selection
 * (`membershipPresentationFanIn.ts`), now living at the compile boundary instead of being re-derived
 * at publish time from `(froms, to)` (Purpose finding 4 / PB-I). Shared by both call sites that need
 * this op (`executeCharacterNavigate.ts`, pre-commit, for the mutation-only step subset;
 * `orchestrateNavigate.ts`, post-commit, for the full compiled plan) so the copy-kind logic exists in
 * exactly one place. `compilePositionKernelOp`'s captureId generation depends only on `froms`/`to`
 * (never on narration content), so building this op twice with the same `froms`/`to`/`bundleId` --
 * once without a resolved `headerSlot` (mutation-only), once with (full plan) -- yields identical
 * capture ids across both calls, which is what lets the narration steps built in the second call
 * reference captures taken during the first call's committed transaction.
 */
export const buildNavigateMoveOp = (args: BuildNavigateMoveOpArgs): PositionKernelMoveOp => {
    const baseCopyKind: MembershipEmissionCopyKind = args.intentKind === 'home'
        ? 'home'
        : (args.exitName ? 'exitAware' : 'genericNavigate')

    const leaveCopyKind = (fromRoomId: EphemeraMembershipHostId): MembershipEmissionCopyKind => {
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
