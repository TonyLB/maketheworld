import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId, EphemeraPositionAdjacencyContainedId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { HostRelationalEdgeKind } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import type { EphemeraLudicGraph } from '../../../../positions/ludicGraph'
import type { MutationKernelStep } from '../../../../positions/manipulation/kernel/kernelStep'
import { findShardBoundary } from './findShardBoundary'
import { buildCrossingLegs } from './buildCrossingLegs'

/**
 * `error` is hard-terminal and `defer` today only ever escalates to an LLM
 * validator (BD-10) --- same caveat as `GroundReferentResult`/
 * `ExpandTransferMembershipResult` (BD-18, `AGENT.backtrackChannel.planning.md`):
 * keep this union open to a third outcome rather than letting the Pipeline
 * A -> B migration harden call sites around just these two.
 */
export type ExpandSameHostResult =
    | { verdict: 'satisfied'; hostId: EphemeraMembershipHostId }
    | { verdict: 'crossed'; steps: MutationKernelStep[] }
    | { verdict: 'defer'; decidable: boolean; reason: string }
    | { verdict: 'error'; reason: string }

/**
 * BD-16's second Expansion instance: "a relation is intended --- where does it
 * go?" Originally the mirror image of `expandTransferMembership.ts` (BD-13),
 * answering it with a *transfer*: move the subject onto the object's host and
 * call the precondition repaired. **PV1-3b-9 (2026-09-01) retired that answer.**
 * A violated `sameHost` on a peer relation is not a sign that something is in
 * the wrong place --- it is the ordinary case of two things in different shards
 * that a relation must span, which is what crossing ports exist for. So the
 * question this now answers is "which shard boundary does this relation cross,
 * and what legs express it?", and a peer relation that cannot be expressed
 * declines rather than relocating either endpoint.
 *
 * Hosting kinds (`On`/`In`/`PartOf`) reach no branch here but an error, and
 * deliberately: "put the cup on the table" is a membership move, not a
 * relational placement. Conflating the two is exactly what made the old repair
 * outcome look load-bearing. If CD2h ever routes hosting kinds through this
 * function they need their own branch built for them.
 *
 * Satisfaction is determined by fetching the subject's current host graph
 * and calling **its own** `bothObjectsOnGraph` (`ludicGraph/index.ts`)
 * --- the exact pure method `applyRelationalPatch` already uses --- rather
 * than comparing `subjectHost`/`objectHost` for equality. That keeps this
 * Expansion step and any future commit-time re-verification (BD-15 slice 3,
 * generalizing `applyRelationalPatch` to re-check atomically, mirroring how
 * `applyTransferSet` re-verifies transfer-set completeness) provably calling
 * the same predicate, not two independently-drifting copies.
 *
 * `getCurrentHost`/`getGraph` are plain injected callbacks, not live DB
 * calls --- matches `GroundingContext`/`expandTransferMembership.ts`'s
 * convention. Standalone and unwired: does not decide how Grounding and
 * Expansion interleave (`AGENT.concepts.md`, "Synthesize's three
 * sub-roles") --- this function only operates on already-grounded ids.
 */
export const expandSameHost = (
    input: {
        subjectId: EphemeraObjectId
        objectId: EphemeraObjectId
        relationKind: HostRelationalEdgeKind
        /** `relationKind: 'Custom'` only --- see `GroundedBinaryAssertion`'s doc comment. */
        relationLabel?: string
    },
    getCurrentHost: (id: EphemeraObjectId) => EphemeraMembershipHostId | undefined,
    getGraph: (hostId: EphemeraMembershipHostId) => EphemeraLudicGraph | undefined,
    getMembershipContainers: (id: EphemeraPositionAdjacencyContainedId) => EphemeraMembershipHostId[] = () => []
): ExpandSameHostResult => {
    const { subjectId, objectId, relationKind, relationLabel } = input

    const subjectHost = getCurrentHost(subjectId)
    if (!subjectHost) {
        return { verdict: 'error', reason: `No current host found for ${subjectId}` }
    }

    const objectHost = getCurrentHost(objectId)
    if (!objectHost) {
        return { verdict: 'error', reason: `No current host found for ${objectId}` }
    }

    const subjectGraph = getGraph(subjectHost)
    if (!subjectGraph) {
        return { verdict: 'error', reason: `No graph found for host ${subjectHost}` }
    }

    const violated = !subjectGraph.bothObjectsOnGraph(subjectId, objectId)

    if (!violated) {
        return { verdict: 'satisfied', hostId: subjectHost }
    }

    // Peer kinds only (AB-54). A hosting kind puts the subordinate node *inside* the superior's
    // own shard, so there is no boundary between them to cross and a minted crossing port would
    // be a false record of one --- they fall to the error below instead. `Present` is the port
    // mechanism's own kind and is never an assertion's subject.
    const isPeerKind = relationKind === 'Under' || relationKind === 'Against' || relationKind === 'Custom'

    if (isPeerKind && (relationKind !== 'Custom' || relationLabel !== undefined)) {
        // PV1-3: a violated peer relation is not a misplacement to be repaired --- it may
        // legitimately cross a shard boundary via a port pair (BD-16's third outcome, this
        // union's own doc comment). PV1-3b-9 widened this from `Custom`-only: `buildCrossingLegs`
        // was already general over kinds (it mints a bare-`kind` port for the enum relations),
        // and the gate was the only thing holding `Under`/`Against` back.
        const boundary = findShardBoundary({ subjectId, targetId: objectId }, getMembershipContainers)
        if (boundary.verdict === 'crossed') {
            const legs = buildCrossingLegs({
                subjectId,
                targetId: objectId,
                commonAncestor: boundary.commonAncestor,
                subjectPath: boundary.subjectPath,
                targetPath: boundary.targetPath,
                // Narrowed once, so both arms of `RelationalKindAndLabel`'s discriminated union
                // spread cleanly --- `relationLabel` is checked non-undefined by the gate above.
                ...(relationKind === 'Custom'
                    ? { relationKind: 'Custom' as const, relationLabel: relationLabel as string }
                    : { relationKind }),
            })
            if (legs.verdict === 'built') {
                return { verdict: 'crossed', steps: legs.steps }
            }
        }
    }

    if (relationKind === 'Custom') {
        return {
            verdict: 'defer',
            decidable: false,
            reason: 'Custom relation sameHost violation requires LLM validation (BD-10)',
        }
    }

    if (isPeerKind) {
        // Distinct from the Custom defer above, deliberately: nothing here is semantically
        // uncertain. The relation is well understood and the endpoints are in different shards;
        // what is missing is a crossing this slice's leg producer can express (no common
        // ancestor, an ambiguous one, or a shape past its one-extra-hop-per-side scope). An LLM
        // has nothing to add to that, so borrowing BD-10's wording would misroute the follow-up.
        return {
            verdict: 'defer',
            decidable: false,
            reason: `No crossing could be built for the ${relationKind} relation between ${subjectId} and ${objectId} --- they share no host, and their shard boundary is unreachable or has a shape buildCrossingLegs does not yet support`,
        }
    }

    return {
        verdict: 'error',
        reason: `sameHost violation for hosting kind ${relationKind} --- a hosting relation is a membership move, not a relational placement, and has no branch on this route (CD2h)`,
    }
}
