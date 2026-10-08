import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { HostRelationalEdge } from '../baseClasses'
import type { EphemeraLudicGraph } from '../index'
import { boundaryEdgeOutcomes } from './interactionUnderTransfer'

/**
 * Verdicts partition by *what a caller can do next*, not by how bad the news is --- see
 * [`manipulation/kernel/types.ts`](../../manipulation/kernel/types.ts) for the full statement of
 * the vocabulary this mirrors. Every non-`legal` outcome this function can produce is `repairable`
 * and carries the offending `edge`: it is the repair, and discarding it (as this type did until
 * 2026-09-08) is what forced a caller to re-derive from a reason code. No `hostId` here --- this
 * function is handed two graphs and knows neither's id, so the kernel supplies it when re-wrapping.
 *
 * `repairKind` is carried rather than derived from `reasonCode`, deliberately. The kernel builds a
 * `MutationKernelRepair` from this, and having it map reason codes back to repair kinds would be the
 * same discard-and-re-derive-at-the-boundary fault the 2026-09-08 rename removed, reintroduced one
 * layer up. The kernel adds the `hostId` and nothing else.
 */
export type ApplyTransferOutcome =
    | { verdict: 'legal'; sourceGraph: EphemeraLudicGraph; destGraph: EphemeraLudicGraph }
    | {
        verdict: 'repairable'
        reasonCode: 'unresolvedDissolveEdge' | 'transferInteractionDefer' | 'undecidableInteractionEdge'
        repairKind: 'dissolveRelationalEdge' | 'classifyCustomRelation'
        edge: HostRelationalEdge
        authority: 'mechanical' | 'worldChanging'
    }

/**
 * BD-27c/BD-33/BD-35 Expand+Validate core for a membership transfer (BD-13) of one entity: anything
 * it hosts lives in its own shard and travels with it, so nothing here widens what moves. Assumes any
 * boundary edge (a relational edge with the mover at one end) that should dissolve has already been
 * severed by an explicit `dissolveRelation` step earlier in the same kernel-apply loop. A
 * `dissolve`-classified boundary edge still present at this point is therefore reported as
 * `repairable` (`unresolvedDissolveEdge`, `authority: 'mechanical'`, carrying the edge), not
 * silently resolved: the repair is to emit the missing `dissolveRelation` step and re-propose.
 *
 * Only [`applyStepSequenceCore.ts`](../../manipulation/kernel/applyStepSequenceCore.ts) calls it.
 */
export function applyTransfer(
    sourceGraph: EphemeraLudicGraph,
    destGraph: EphemeraLudicGraph,
    // Object | Character, and no wider --- transfer means *changes host*, and Room/Feature/Area
    // are hosts that never relocate.
    entityId: EphemeraObjectId | EphemeraCharacterId
): ApplyTransferOutcome {
    // boundaryEdgeOutcomes stays Object-only (interactionUnderTransfer.ts):
    // no production path produces a character-endpoint relational edge yet, so a character can never
    // appear on either side of a boundary edge.
    const boundaryOutcomes = isEphemeraObjectId(entityId) ? boundaryEdgeOutcomes(entityId, sourceGraph) : []
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

    return isEphemeraObjectId(entityId)
        ? { verdict: 'legal', sourceGraph: sourceGraph.removeObject(entityId), destGraph: destGraph.addObject(entityId) }
        : { verdict: 'legal', sourceGraph: sourceGraph.removeCharacter(entityId), destGraph: destGraph.addCharacter(entityId) }
}
