import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { HostRelationalEdgeKind } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import type { EphemeraLudicGraph } from '../../../../positions/ludicGraph'
import type { TransferMembershipStep } from '../parsePlanStep'

/**
 * `error` is hard-terminal and `defer` today only ever escalates to an LLM
 * validator (BD-10) --- same caveat as `GroundReferentResult`/
 * `ExpandTransferMembershipResult` (BD-18, `AGENT.backtrackChannel.planning.md`):
 * keep this union open to a third outcome rather than letting the Pipeline
 * A -> B migration harden call sites around just these two.
 */
export type ExpandSameHostResult =
    | { verdict: 'satisfied'; hostId: EphemeraMembershipHostId }
    | { verdict: 'repaired'; hostId: EphemeraMembershipHostId; transferStep: TransferMembershipStep }
    | { verdict: 'defer'; decidable: boolean; reason: string }
    | { verdict: 'error'; reason: string }

/**
 * BD-16's second Expansion instance --- the mirror image of
 * `expandTransferMembership.ts` (BD-13): that one asks "a transfer is
 * happening, what happens to existing relations touching the moved object?";
 * this one asks "a relation is intended, what transfer satisfies a violated
 * `sameHost` precondition?" Same enum-deterministic / `Custom`-deferred
 * shape, opposite direction of inference.
 *
 * Satisfaction is determined by fetching the subject's current host graph
 * and calling **its own** `bothObjectsOnGraph` (`positionGraph/index.ts`)
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
        negate: boolean
    },
    getCurrentHost: (id: EphemeraObjectId) => EphemeraMembershipHostId | undefined,
    getGraph: (hostId: EphemeraMembershipHostId) => EphemeraLudicGraph | undefined
): ExpandSameHostResult => {
    const { subjectId, objectId, relationKind, negate } = input

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

    const bothOnGraph = subjectGraph.bothObjectsOnGraph(subjectId, objectId)
    const violated = negate ? bothOnGraph : !bothOnGraph

    if (!violated) {
        return { verdict: 'satisfied', hostId: subjectHost }
    }

    if (relationKind === 'Custom') {
        return {
            verdict: 'defer',
            decidable: false,
            reason: 'Custom relation sameHost violation requires LLM validation (BD-10)',
        }
    }

    if (negate) {
        return {
            verdict: 'error',
            reason: 'No repair rule defined for a negated sameHost assertion --- BD-15/16 only model "subject moves to object\'s host" for the affirmative case',
        }
    }

    return {
        verdict: 'repaired',
        hostId: objectHost,
        transferStep: {
            kind: 'transferMembership',
            objectIds: new Set([subjectId]),
            fromHostId: subjectHost,
            toHostId: objectHost,
        },
    }
}
