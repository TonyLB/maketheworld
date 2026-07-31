import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { CarryClosureFragment } from '../positionGraph/expandValidate/interactionUnderTransfer'
import type { HostRelationalEdge } from '../manipulation/types'
import type { ObjectMoveNarrationInput, PositionKernelMoveOp } from '../manipulation/kernel/compile/positionKernelOp'

export type BuildObjectMoveOpArgs = {
    /** Expansion's re-derived carry closure. Its `rootId` is the primary object the copy names. */
    fragment: CarryClosureFragment
    /** Boundary edges Expansion classified as dissolve; empty for a move that severs nothing. */
    dissolvedEdges: readonly HostRelationalEdge[]
    fromHostId: EphemeraMembershipHostId
    toHostId: EphemeraMembershipHostId
    bundleId: string
    /** Omitted for the pre-commit mutation-only compile; supplied post-commit to narrate. */
    narration?: Omit<ObjectMoveNarrationInput, 'kind' | 'carriedCount'>
}

/**
 * Object take/drop/give's `PositionKernelMoveOp` --- a **sibling** of `buildCharacterMoveOp`, not a
 * widening of it (Phase 4, `AGENT.presentationKernel.planning.md`). Almost all of that module is
 * `MembershipEmissionCopyKind` selection, which objects share nothing with, and its argument types
 * are room-shaped; merging the two would put two disjoint bodies under one name, against the same
 * discriminate-on-family doctrine `NarrationSpecification` follows.
 *
 * There is deliberately no verb, direction, or acting-character argument. Under PB-M the verb is a
 * property of the delta --- which side of the move was the room --- so `compilePositionKernelOp`
 * derives it, which is what let `inferOperationFromFact` be deleted rather than ported and what makes
 * a future `give` (room on neither side) expressible with no new discriminant.
 *
 * Called **once** per move, unlike `buildCharacterMoveOp`. Navigate builds its op twice --- bare
 * pre-commit, narrating post-commit --- only because its header slot needs an async perspective-key
 * lookup that cannot happen inside the mutation path, and the two calls agree because
 * `compilePositionKernelOp` mints capture ids purely from `froms`/`to`. An object move has no header,
 * so the ingredients are all in hand before the commit and one compiled plan serves both halves; a
 * second compile would be two chances to disagree in exchange for nothing.
 *
 * `carriedCount` is taken from the fragment rather than accepted as an argument, so it cannot drift
 * from the set actually being transferred. This is the *execute-time* closure, not the Plan-stage
 * intent's object count that the retired fan-in used: `executeObjectMove` re-derives the closure
 * fresh against current graph state rather than trusting the planned set, so "and everything on it"
 * now reports what really moved.
 */
export const buildObjectMoveOp = (args: BuildObjectMoveOpArgs): PositionKernelMoveOp => ({
    kind: 'move',
    moved: { kind: 'closure', fragment: args.fragment },
    froms: [args.fromHostId],
    to: args.toHostId,
    bundleId: args.bundleId,
    headerSlot: null,
    dissolvedEdges: args.dissolvedEdges,
    ...(args.narration
        ? {
            narration: {
                kind: 'objectMove' as const,
                characterName: args.narration.characterName,
                objectShortName: args.narration.objectShortName,
                carriedCount: args.fragment.members.size,
            },
        }
        : {}),
})
