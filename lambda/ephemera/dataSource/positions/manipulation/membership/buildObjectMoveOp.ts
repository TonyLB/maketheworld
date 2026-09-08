import { isEphemeraLudicTerminalPrimitive } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { HostRelationalEdge } from '../types'
import type { EphemeraLudicGraph } from '../../ludicGraph'
import { boundaryEdgeOutcomes } from '../../ludicGraph/expandValidate/interactionUnderTransfer'
import { findOwnRootContainmentEdge } from './findOwnRootContainmentEdge'
import type { ObjectMoveNarrationInput, PositionKernelMoveOp } from '../kernel/compile/positionKernelOp'

export type BuildObjectMoveOpArgs = {
    /** The moved object. `computeCarryClosure` has been a singleton since CD3 (2026-09-06), so this is the whole moved set, not just its primary member. */
    entityId: EphemeraObjectId
    /**
     * The departure host's graph, as of whenever the caller fetched it. Used to derive
     * `dissolvedEdges` (3d, 2026-09-08): the mover's own containment edge into this graph's root
     * (if any) and every boundary edge `dissolve`-classified against it are both stripped here,
     * unconditionally --- not gated on any caller flag, per the "own-root-containment-edge strip
     * moves to compile" instruction. `defer`-classified edges are deliberately left alone: this
     * function has no authority to decide whether severing one is acceptable, so an unresolved
     * `defer` edge is left in place for `applyTransferSet` to report as `repairable`/`worldChanging`
     * when the compiled plan is actually evaluated.
     */
    fromGraph: EphemeraLudicGraph
    /**
     * A repair applied after a prior dry run reported `repairable`/`mechanical` --- folded in
     * alongside the structurally-known edges above so a caller can rebuild the op once, rather than
     * this function needing to re-run `boundaryEdgeOutcomes` against an already-repaired graph.
     */
    extraDissolvedEdges?: readonly HostRelationalEdge[]
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
 *
 * `dissolvedEdges` is derived here from `fromGraph`, not handed in pre-computed by the caller ---
 * this function is the sole producer of that field's value now (3d, 2026-09-08), taking over the
 * own-root-strip-plus-boundary-sweep computation that `executeMembershipTransfer`'s retired
 * `honorDefer` mode used to hand-roll. See `fromGraph`'s own doc comment above for what is and is
 * not folded in.
 */
export const buildObjectMoveOp = (args: BuildObjectMoveOpArgs): PositionKernelMoveOp => {
    const ownRootContainmentEdge = findOwnRootContainmentEdge(args.entityId, args.fromGraph)
    const strippedFromGraph = ownRootContainmentEdge ? args.fromGraph.removeRelationalEdge(ownRootContainmentEdge) : args.fromGraph
    const outcomes = boundaryEdgeOutcomes(new Set([args.entityId]), strippedFromGraph)

    const dissolvedEdges: HostRelationalEdge[] = [
        ...(ownRootContainmentEdge ? [ownRootContainmentEdge] : []),
        ...outcomes
            .filter((entry) => entry.outcome === 'dissolve'
                && isEphemeraLudicTerminalPrimitive(entry.edge.from)
                && isEphemeraLudicTerminalPrimitive(entry.edge.to))
            .map((entry) => entry.edge),
        ...(args.extraDissolvedEdges ?? []),
    ]

    return {
        kind: 'move',
        moved: args.entityId,
        froms: [args.fromHostId],
        to: args.toHostId,
        bundleId: args.bundleId,
        headerSlot: null,
        dissolvedEdges,
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
    }
}
