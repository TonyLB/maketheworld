import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { HostRelationalEdge } from '../../types'
import type { MessageOrchestrationSlotSpec } from '../../../../messageOrchestration/localApiEvents'
import type { MembershipEmissionCopyKind } from '../kernelStep'

/**
 * Membership narration's ingredients: navigate/home/connect/disconnect. `leaveCopyKind` is a
 * *function* of the from-host because a multi-`froms` move selects copy per room.
 */
export type MembershipMoveNarrationInput = {
    kind: 'membershipMove'
    characterName: string
    leaveCopyKind: (fromHostId: EphemeraMembershipHostId) => MembershipEmissionCopyKind
    arriveCopyKind: MembershipEmissionCopyKind
    exitName?: string
}

/**
 * Object take/drop/give narration's ingredients (Phase 4).
 *
 * Note the absence of a verb. The verb is a property of the *delta* --- "which side of
 * the move was the room" --- so `compilePositionKernelOp` derives it from `(froms, to)` host kinds
 * rather than the caller declaring it. That is what lets `give` (room on neither side) fall out
 * without a new discriminant, and it is why the retired `inferOperationFromFact` could be deleted
 * rather than ported: the compiler holds the verb forwards instead of reasoning back to it.
 *
 * No `carriedCount` --- retired 2026-09-07: `computeCarryClosure` has been a singleton since
 * CD3 (2026-09-06), so a moved object never carries anything else with it, and the field's own
 * `> 1` narration branch was dead from the moment CD3 shipped.
 */
export type ObjectMoveNarrationInput = {
    kind: 'objectMove'
    characterName: string
    objectShortName: string
}

/**
 * The abstract-op vocabulary the compiler
 * (`compilePositionKernelOp.ts`) expands into `KernelStep[]`. Shaped at the level the instruction
 * planner sees the world --- `moved` generalizes over object/character exactly as
 * `MutationKernelTransferStep` already does (BD-36) --- rather than at the level a player
 * experiences it (a character-only, room-only "navigate" op sitting one layer above a type that's
 * already general). `Move` is the only member of `PositionKernelOp`; it is a closed union
 * because world operations are genuinely enumerable --- take/drop/give is definitionally a move of
 * an entity between two membership hosts, the same shape as a character moving room to room, so the
 * direction never needed to be an op discriminant, and no sibling `Take`/`Drop` ops exist.
 *
 * `moved` is a bare entity id, not a `{kind, ...}` union --- retired 2026-09-07 along with
 * `PositionKernelMovedSet`. The union existed to let a closure's primacy come from `fragment.rootId`
 * rather than a separately-asserted id; since CD3 (2026-09-06) `computeCarryClosure` is always a
 * singleton, primacy and "the whole moved set" are the same one id, so the second shape had nothing
 * left to represent.
 *
 * `narration` is deliberately optional, not a field every `Move` carries: object-lifecycle moves
 * (spawn/destroy/place/remove) narrate nothing today, and populating narration fields they'd never
 * use would misstate that. Presence/absence of `narration` is what lets the compiler --- not the
 * op's shape --- decide whether and how a given move narrates. Narration carries
 * *ingredients*, not a pre-built message string --- copy assembly happens at flush time in
 * `presentStepSequence`'s narration branch, alongside the captured audience, so a later slice can let
 * copy react to what the mutation actually did rather than only what was intended at compile time.
 * It is a union discriminated on narration *family*, matching `NarrationSpecification`'s own axis.
 */
export type PositionKernelMoveOp = {
    kind: 'move'
    moved: EphemeraObjectId | EphemeraCharacterId
    froms: EphemeraMembershipHostId[]
    to: EphemeraMembershipHostId | null
    /** messageOrchestration bundle correlation id for any narration/header slots this move declares. */
    bundleId: string
    /** Resolved by the caller (async perspective-key lookup is render-pipeline territory, not the compiler's job); null when no header render applies. */
    headerSlot: MessageOrchestrationSlotSpec | null
    /**
     * Boundary edges severed by this move, **already classified as dissolve by Expansion**.
     * The compiler renders them into `dissolveRelation` steps ahead of the
     * transfer --- it sequences, it does not classify. Classification stays in Expansion because
     * `boundaryEdgeOutcomes` can also return verdicts (`error` on a stray carry-classified boundary
     * edge, `defer` on a `Custom` edge, BD-10) and `compilePositionKernelOp` has no verdict channel;
     * giving it one would cost the purity that lets compilation correctly skip the Plan-stage dry run.
     */
    dissolvedEdges?: readonly HostRelationalEdge[]
    /**
     * Hosting kinds only (AB-54). Unlike `dissolvedEdges`, this is a compiler *instruction*
     * ("establish this at the destination"), not a pre-classified verdict --- there is no
     * legality question to defer for a hosting-kind establish (always succeeds, root-anchored,
     * no boundary contention), so the compiler is allowed to synthesize the `establishRelation`
     * step itself.
     */
    containment?: 'On' | 'In' | 'PartOf'
    /** Present only when this move should narrate world lines --- see doc comment above. */
    narration?: MembershipMoveNarrationInput | ObjectMoveNarrationInput
}

export type PositionKernelOp = PositionKernelMoveOp
