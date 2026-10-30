import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { HostRelationalEdge } from '../baseClasses'
import type { EphemeraLudicGraph } from '../index'
import { boundaryEdgeOutcomes } from './interactionUnderTransfer'

/**
 * Verdicts partition by *what a caller can do next*, not by how bad the news is --- see
 * [`manipulation/kernel/types.ts`](../../manipulation/kernel/types.ts) for the full statement of
 * the vocabulary this mirrors. Every non-`legal` outcome `applyDeparture` can produce is `repairable`
 * and carries the offending `edge`: it is the repair, and discarding it (as this type did until
 * 2026-09-08) is what forced a caller to re-derive from a reason code. No `hostId` here --- this
 * function is handed one graph and does not know its id, so the kernel supplies it when re-wrapping.
 *
 * `repairKind` is carried rather than derived from `reasonCode`, deliberately. The kernel builds a
 * `MutationKernelRepair` from this, and having it map reason codes back to repair kinds would be the
 * same discard-and-re-derive-at-the-boundary fault the 2026-09-08 rename removed, reintroduced one
 * layer up. The kernel adds the `hostId` and nothing else.
 */
export type ApplyDepartureOutcome =
    | { verdict: 'legal'; sourceGraph: EphemeraLudicGraph }
    | {
        verdict: 'repairable'
        reasonCode: 'unresolvedDissolveEdge' | 'transferInteractionDefer' | 'undecidableInteractionEdge'
        repairKind: 'dissolveRelationalEdge' | 'classifyCustomRelation'
        edge: HostRelationalEdge
        authority: 'mechanical' | 'worldChanging'
    }

/**
 * A mover's departure from a host: the boundary-edge legality check, then the entity's removal from
 * the host (BD-27c/BD-33/BD-35 Expand+Validate core). Anything the entity hosts lives in its own
 * shard and travels with it, so nothing here widens what leaves. Assumes any boundary edge (a
 * relational edge with the mover at one end) that should dissolve has already been severed by an
 * explicit `dissolveRelation` step earlier in the same kernel-apply loop; one still present is
 * `repairable` (`unresolvedDissolveEdge`, `authority: 'mechanical'`, carrying the edge), not silently
 * resolved: the repair is to emit the missing `dissolveRelation` step and re-propose. Called only
 * from `settleMembership`, for a mover leaving a host with its **last** binding there; one that
 * keeps another binding there has not left and runs no check.
 */
export function applyDeparture(
    sourceGraph: EphemeraLudicGraph,
    entityId: EphemeraObjectId | EphemeraCharacterId
): ApplyDepartureOutcome {
    // boundaryEdgeOutcomes stays Object-only (interactionUnderTransfer.ts):
    // no production path produces a character-endpoint relational edge yet, so a character can never
    // appear on either side of a boundary edge.
    const boundaryOutcomes = isEphemeraObjectId(entityId) ? boundaryEdgeOutcomes(entityId, sourceGraph) : []
    // Temporary until the block routing slice (AGENT.securedTo.planning.md Slice 3) gives a remaining
    // `block` edge its refuse outcome: without this the departure below would be called legal.
    const blockOutcome = boundaryOutcomes.find((entry) => entry.outcome === 'block')
    if (blockOutcome !== undefined) {
        throw new Error(`applyDeparture: a '${blockOutcome.edge.kind}' boundary edge blocks the move, and block outcomes are not routed yet`)
    }
    const deferOutcome = boundaryOutcomes.find((entry) => entry.outcome === 'defer')
    if (deferOutcome !== undefined) {
        // Both deferring cases are repairable; they differ in *which* repair. A non-`Custom` edge
        // has a known one --- sever it --- but one that changes the world beyond what the player
        // asked for: moving the lamp that was resting on the book is not an invisible cleanup. A
        // `Custom` edge cannot take that repair: deciding what "tied to" means is exactly what this
        // layer cannot do, and naming `dissolveRelationalEdge` anyway would assert a severing this
        // function has no grounds to vouch for. So the repair it names is the
        // classification itself, and a repair applier with no classifier throws on that kind --- the
        // ignorance is reported where it is, and enforced where a repair would be applied.
        //
        // `authority` is recorded rather than acted on for both: whether a `worldChanging` repair
        // may be applied silently or must escalate to the player is a world-model question this
        // layer does not answer.
        if (deferOutcome.edge.kind === 'Custom') {
            return {
                verdict: 'repairable',
                reasonCode: 'undecidableInteractionEdge',
                repairKind: 'classifyCustomRelation',
                edge: deferOutcome.edge,
                authority: 'worldChanging',
            }
        }
        return {
            verdict: 'repairable',
            reasonCode: 'transferInteractionDefer',
            repairKind: 'dissolveRelationalEdge',
            edge: deferOutcome.edge,
            authority: 'worldChanging',
        }
    }

    // A dissolve-classified boundary edge still present here means an explicit
    // dissolveRelation step that should have run earlier in the same kernel-apply loop did not ---
    // mechanically repairable, and invisible to the player, since the edge was already classified
    // as one that dissolves under this transfer.
    const dissolveOutcome = boundaryOutcomes.find((entry) => entry.outcome === 'dissolve')
    if (dissolveOutcome !== undefined) {
        return {
            verdict: 'repairable',
            reasonCode: 'unresolvedDissolveEdge',
            repairKind: 'dissolveRelationalEdge',
            edge: dissolveOutcome.edge,
            authority: 'mechanical',
        }
    }

    return {
        verdict: 'legal',
        sourceGraph: isEphemeraObjectId(entityId) ? sourceGraph.removeObject(entityId) : sourceGraph.removeCharacter(entityId),
    }
}
