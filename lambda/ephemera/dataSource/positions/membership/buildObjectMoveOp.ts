import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { HostRelationalEdge } from '../manipulation/types'
import type { ObjectMoveNarrationInput, PositionKernelMoveOp } from '../manipulation/kernel/compile/positionKernelOp'

export type BuildObjectMoveOpArgs = {
    /** The moved object. `computeCarryClosure` has been a singleton since CD3 (2026-09-06), so this is the whole moved set, not just its primary member. */
    entityId: EphemeraObjectId
    /** Boundary edges Expansion classified as dissolve; empty for a move that severs nothing. */
    dissolvedEdges: readonly HostRelationalEdge[]
    fromHostId: EphemeraMembershipHostId
    toHostId: EphemeraMembershipHostId
    bundleId: string
    /** Omitted for the pre-commit mutation-only compile; supplied post-commit to narrate. */
    narration?: Omit<ObjectMoveNarrationInput, 'kind'>
    /** Hosting kinds only (AB-54); see `ExecuteMembershipTransferArgs.containment`'s doc comment. */
    containment?: 'On' | 'In' | 'PartOf'
}

/**
 * Object take/drop/give's `PositionKernelMoveOp` --- a **sibling** of `buildCharacterMoveOp`, not a
 * widening of it. Almost all of that module is
 * `MembershipEmissionCopyKind` selection, which objects share nothing with, and its argument types
 * are room-shaped; merging the two would put two disjoint bodies under one name, against the same
 * discriminate-on-family doctrine `NarrationSpecification` follows.
 *
 * There is deliberately no verb, direction, or acting-character argument. The verb is a
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
 * No `carriedCount` --- retired 2026-09-07 (MS-8) along with `PositionKernelMovedSet`'s `closure`
 * shape; see `positionKernelOp.ts`'s `ObjectMoveNarrationInput` doc comment.
 */
export const buildObjectMoveOp = (args: BuildObjectMoveOpArgs): PositionKernelMoveOp => ({
    kind: 'move',
    moved: args.entityId,
    froms: [args.fromHostId],
    to: args.toHostId,
    bundleId: args.bundleId,
    headerSlot: null,
    dissolvedEdges: args.dissolvedEdges,
    ...(args.containment ? { containment: args.containment } : {}),
    ...(args.narration
        ? {
            narration: {
                kind: 'objectMove' as const,
                characterName: args.narration.characterName,
                objectShortName: args.narration.objectShortName,
            },
        }
        : {}),
})
