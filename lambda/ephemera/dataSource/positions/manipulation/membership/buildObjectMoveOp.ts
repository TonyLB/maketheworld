import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { HostRelationalEdge } from '../types'
import type { EphemeraLudicGraph } from '../../ludicGraph'
import { findOwnRootContainmentEdge } from './findOwnRootContainmentEdge'
import type { PositionKernelMoveOp } from '../kernel/compile/positionKernelOp'
import type { MutationKernelStep } from '../kernel/kernelStep'

export type BuildObjectMoveOpArgs = {
    /** The moved object --- the whole moved set: anything it hosts lives in its own shard and travels with it. */
    entityId: EphemeraObjectId
    /**
     * The hosts the mover leaves, each with its graph as of whenever the caller fetched it: one
     * for most moves, several for a view across several hosts, none for a move of one part that
     * leaves another part behind in every host it starts from. Each graph is used
     * only to find the mover's own containment edge into its root (if any), which is stripped
     * here: leaving a host means leaving its containment, as entering one means
     * gaining it (`containment`). No other edge is dissolved here. A boundary edge's dissolve is a facilitating action the
     * command attempt states explicitly, and the commit path
     * commits it as a sibling of this op; one the attempt does not cover is left in place for
     * `applyDeparture` to report as `repairable`, and the move is refused.
     */
    departures: readonly { hostId: EphemeraMembershipHostId; graph: EphemeraLudicGraph }[]
    toHostId: EphemeraMembershipHostId
    /** The mover's presence steps, named by `resolvePresenceMoves`. */
    presenceSteps: readonly MutationKernelStep[]
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
 * There is deliberately no narration, verb, direction, or acting-character argument. An object
 * move's lines are its attempt's narration units, authored by whoever created the action and
 * delivered by `commitAttempt.ts` over audiences it resolves and captures itself; the op compiles
 * to mutation steps only. Nothing derives a verb from the move, so a future `give` (room on
 * neither side) needs no new discriminant.
 *
 * Called **once** per move, unlike `buildCharacterMoveOp`. Navigate builds its op twice --- bare
 * pre-commit, narrating post-commit --- only because its header slot needs an async perspective-key
 * lookup that cannot happen inside the mutation path. An object move has no header and no
 * narration, so one compiled plan serves both halves; a second compile would be two chances to
 * disagree in exchange for nothing.
 *
 * No carried-object count: a moved object's hosted contents live in its own shard and travel with
 * it, so the move names one entity.
 *
 * `dissolvedEdges` is derived here from `departures`, not handed in pre-computed by the caller: it
 * holds only the mover's own containment edge in each host it leaves. See
 * `departures`' own doc comment above for why boundary edges are not folded in.
 */
export const buildObjectMoveOp = (args: BuildObjectMoveOpArgs): PositionKernelMoveOp => {
    const dissolvedEdges = args.departures.flatMap(({ hostId, graph }): { hostId: EphemeraMembershipHostId; edge: HostRelationalEdge }[] => {
        const edge = findOwnRootContainmentEdge(args.entityId, graph)
        return edge ? [{ hostId, edge }] : []
    })

    return {
        kind: 'move',
        moved: args.entityId,
        froms: args.departures.map(({ hostId }) => hostId),
        to: args.toHostId,
        header: null,
        presenceSteps: args.presenceSteps,
        dissolvedEdges,
        ...(args.containment ? { containment: args.containment } : {}),
    }
}
