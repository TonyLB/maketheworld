import type { EdgeRelationEntry, EdgeRelationsChange, GroundedReferent } from '../../../actions/enrich/objectManipulation/plan/planStep'
import { mintActionId } from '../../../actions/commandAttempt/action'
import type { EphemeraLudicGraph, HostRelationalEdge } from '../../ludicGraph'
import { edgesMatch } from '../../ludicGraph'

/**
 * **The ad-hoc ref handling of the `assignEdgeRelations` / `dissolveEdgeRelations` prototype, and
 * the only code that knows how an `edgeRef` gets its id.** A hardcoded rule standing in for the
 * compile-time ref binding of `taskPlanning/lambda/ephemera/dataSource/positions/AGENT.stableRefs.planning.md`,
 * which replaces this file:
 *
 * - an assign mints every ref it declares, at Plan time (`mintEdgeRefs`), and the change carries the
 *   ids, so dry run and commit agree (as an extend carries its `presenceUuid`);
 * - a dissolve binds each ref it declares to the stored id of the edge its entry matches by structure,
 *   and leaves it unbound when that edge is absent or has no id.
 */

/** A fresh id for every `edgeRef` the entries declare. Called by whoever plans an assign. */
export const mintEdgeRefs = (entries: readonly EdgeRelationEntry[]): Record<string, string> => (
    Object.fromEntries(entries.flatMap(({ edgeRef }) => (edgeRef === undefined ? [] : [[edgeRef, mintActionId()]])))
)

/**
 * The id each declared ref stands for. `edgeOf` gives an entry's edge when every end of it is a thing
 * (so the edge can be matched by structure); a dissolve's ref on any other entry stays unbound.
 */
export const bindEdgeRefs = (
    change: EdgeRelationsChange<GroundedReferent>,
    graph: EphemeraLudicGraph,
    edgeOf: (entry: EdgeRelationEntry<GroundedReferent>) => HostRelationalEdge | undefined
): ReadonlyMap<string, string> => {
    if (change.primitive === 'assignEdgeRelations') {
        return new Map(Object.entries(change.mintedEdgeIds))
    }
    const stored = graph.relationalEdges
    return new Map(change.entries.flatMap((entry) => {
        const edge = entry.edgeRef === undefined ? undefined : edgeOf(entry)
        const edgeId = edge === undefined ? undefined : stored.find((candidate) => edgesMatch(candidate, edge))?.edgeId
        return entry.edgeRef !== undefined && edgeId !== undefined ? [[entry.edgeRef, edgeId] as const] : []
    }))
}
