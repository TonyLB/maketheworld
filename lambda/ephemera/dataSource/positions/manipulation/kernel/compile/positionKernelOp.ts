import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { MessageOrchestrationSlotSpec } from '../../../../messageOrchestration/localApiEvents'
import type { MembershipEmissionCopyKind } from '../../../../perception/membershipPresentationFanIn'

/**
 * `AGENT.presentationKernel.planning.md` PB-I/PB-6: the abstract-op vocabulary the compiler
 * (`compilePositionKernelOp.ts`) expands into `KernelStep[]`. Shaped at the level the instruction
 * planner sees the world --- `entityId` generalizes over object/character exactly as
 * `MutationKernelTransferStep` already does (BD-36) --- rather than at the level a player
 * experiences it (a character-only, room-only "navigate" op sitting one layer above a type that's
 * already general). `Move` is the only member of `PositionKernelOp` today; it is a closed union
 * (PB-6) because world operations are genuinely enumerable, and `Take`/`Drop` (Phase 4, PB-3) would
 * join it as siblings, not require widening `Move` itself.
 *
 * `narration` is deliberately optional, not a field every `Move` carries: object-lifecycle moves
 * (spawn/destroy/place/remove) narrate nothing today, and populating narration fields they'd never
 * use would misstate that. Presence/absence of `narration` is what lets the compiler --- not the
 * op's shape --- decide whether and how a given move narrates (PB-I). PB-2: narration carries
 * *ingredients* (`characterName`, a copy-kind selector, `exitName`), not a pre-built message string
 * --- copy assembly happens at flush time in `presentStepSequence`'s narration branch, alongside the
 * captured audience, so a later slice can let copy react to what the mutation actually did rather
 * than only what was intended at compile time.
 */
export type PositionKernelMoveOp = {
    kind: 'move'
    entityId: EphemeraObjectId | EphemeraCharacterId
    froms: EphemeraMembershipHostId[]
    to: EphemeraMembershipHostId | null
    /** messageOrchestration bundle correlation id for any narration/header slots this move declares. */
    bundleId: string
    /** Resolved by the caller (async perspective-key lookup is render-pipeline territory, not the compiler's job); null when no header render applies. */
    headerSlot: MessageOrchestrationSlotSpec | null
    /** Present only when this move should narrate leave/arrive world lines --- see doc comment above. */
    narration?: {
        characterName: string
        leaveCopyKind: (fromHostId: EphemeraMembershipHostId) => MembershipEmissionCopyKind
        arriveCopyKind: MembershipEmissionCopyKind
        exitName?: string
    }
}

export type PositionKernelOp = PositionKernelMoveOp
