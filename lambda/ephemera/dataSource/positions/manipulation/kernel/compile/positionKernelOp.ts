import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { HostRelationalEdge } from '../../types'
import type { ExecutorDescribeStep } from '../../../../actions/enrich/objectManipulation/synthesize/executorTypes'
import type { MembershipEmissionCopyKind, PresenceBindingRef } from '../kernelStep'
import type { ParentBinding } from '../../../ludicGraph/presenceParent'
import type { EphemeraPresenceNodeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraPresenceCover } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

/** The arrival header's binding, as carried on a `describe` step. */
export type MoveHeaderBinding = NonNullable<ExecutorDescribeStep['header']>

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
 * The abstract-op vocabulary the compiler
 * (`compilePositionKernelOp.ts`) expands into `KernelStep[]`. Shaped at the level the instruction
 * planner sees the world --- `moved` generalizes over object/character (BD-36) --- rather than at the level a player
 * experiences it (a character-only, room-only "navigate" op sitting one layer above a type that's
 * already general). `Move` and `Split` are the members of `PositionKernelOp`; it is a closed union
 * because world operations are genuinely enumerable --- take/drop/give is definitionally a move of
 * an entity between two membership hosts, the same shape as a character moving room to room, so the
 * direction never needed to be an op discriminant, and no sibling `Take`/`Drop` ops exist.
 *
 * `moved` is a bare entity id: the whole moved set is that one entity, since anything it hosts
 * lives in its own shard and travels with it.
 *
 * `narration` is deliberately optional, not a field every `Move` carries: object moves never
 * carry it (lifecycle moves narrate nothing, and take/drop/give narrate through their attempt's
 * narration units, which `commitAttempt.ts` delivers), and populating narration fields they'd never
 * use would misstate that. Presence/absence of `narration` is what lets the compiler --- not the
 * op's shape --- decide whether and how a given move narrates. Narration carries
 * *ingredients*, not a pre-built message string --- copy assembly happens at flush time in
 * `presentStepSequence`'s narration branch, alongside the captured audience, so a later slice can let
 * copy react to what the mutation actually did rather than only what was intended at compile time.
 * It keeps its `kind` discriminant, matching `NarrationSpecification`'s family axis.
 */
export type PositionKernelPresenceMove = {
    /** The mover's own binding, on the mover's graph. */
    presence: EphemeraPresenceNodeId
} & (
    {
        /** The parent binding it sits under now; `null` for a hostless binding (a first placement). */
        from: ParentBinding | null
        to: PresenceBindingRef
    } | {
        /** A departure: the parent binding it leaves, with no destination (`to: null`). */
        from: ParentBinding
        to: null
    }
)

export type PositionKernelMoveOp = {
    kind: 'move'
    moved: EphemeraObjectId | EphemeraCharacterId
    froms: EphemeraMembershipHostId[]
    to: EphemeraMembershipHostId | null
    /**
     * The mover's presence writes, one per binding that changes parent, **named by the producer**
     * (`resolvePresenceMoves`) --- the compiler reads nothing. More than one (a multi-`from` scrub)
     * compiles to a move each, then a join. For an op with `to: null` each entry is a departure
     * (`to: null`), which compiles to a `releasePresenceBinding`. Empty for an op that moves no binding.
     */
    presenceMoves: readonly PositionKernelPresenceMove[]
    /**
     * A fresh uuid when the mover holds no binding at all (a character before its first connect):
     * the compiler mints a hostless root under it ahead of the moves, and `presenceMoves[0].presence`
     * names it. Absent whenever the mover already has a hostless binding.
     */
    mintedRootUuid?: string
    /**
     * Resolved by the caller (async perspective-key lookup is render-pipeline territory, not the
     * compiler's job); null when no arrival header applies. The compiler places the header
     * `describe` step between the leave and arrive narrations.
     */
    header: MoveHeaderBinding | null
    /**
     * Boundary edges severed by this move, **already classified as dissolve by Expansion**.
     * The compiler renders them into `dissolveRelation` steps ahead of the
     * transfer --- it sequences, it does not classify. Classification stays in Expansion because
     * classification has outcomes besides `dissolve` (`defer` on a `Custom` edge, BD-10; a thrown
     * AB-54 invariant on a hosting-kind edge) and `compilePositionKernelOp` has no verdict channel;
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
    narration?: MembershipMoveNarrationInput
}

/**
 * Splits one binding of a whole into several under the same parent (presenceMoves Slice 3). The
 * whole is the only host written (plus the children whose bindings are re-pointed, which the step
 * names through its cover entries), so there is no mover, narration, header or dissolved edge: the
 * op compiles to the one `splitPresenceBinding` step (`presenceBindingStepsForSplit`). `splitInto`
 * is the finished instruction, **ids minted by the producer** (`resolvePresenceSplit`), because a
 * later step in the same run (a move of one result to another parent) must name them.
 */
export type PositionKernelSplitOp = {
    kind: 'split'
    whole: EphemeraMembershipHostId
    /** The binding being split; it survives as one entry of `splitInto`. */
    presence: EphemeraPresenceNodeId
    splitInto: readonly { presence: EphemeraPresenceNodeId; cover: EphemeraPresenceCover }[]
}

export type PositionKernelOp = PositionKernelMoveOp | PositionKernelSplitOp
