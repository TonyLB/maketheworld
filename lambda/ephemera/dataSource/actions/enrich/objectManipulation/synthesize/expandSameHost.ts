import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { HostRelationalEdgeKind } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import type { MutationKernelStep } from '../../../../positions/manipulation/kernel/kernelStep'
import { findShardBoundary } from './findShardBoundary'
import { buildCrossingLegs, buildCrossingDissolveLegs } from './buildCrossingLegs'
import { findRelationalChain } from './findRelationalChain'
import type { ExpansionEnvironment } from './executorTypes'

/**
 * `error` is hard-terminal and `defer` today only ever escalates to an LLM
 * validator (BD-10) --- same caveat as `GroundReferentResult`/
 * `ExpandTransferMembershipResult` (BD-18, `AGENT.backtrackChannel.planning.md`):
 * keep this union open to further outcomes rather than letting the Pipeline
 * A -> B migration harden call sites around just these.
 */
export type ExpandSameHostResult =
    | { verdict: 'crossed'; steps: MutationKernelStep[] }
    | { verdict: 'defer'; decidable: boolean; reason: string }
    | { verdict: 'error'; reason: string }

/**
 * BD-16's second Expansion instance: "a relation is intended --- where does it
 * go?" Originally the mirror image of `expandTransferMembership.ts` (BD-13),
 * answering it with a *transfer*: move the subject onto the object's host and
 * call the precondition repaired. **That answer was retired, 2026-09-01.**
 * A violated `sameHost` on a peer relation is not a sign that something is in
 * the wrong place --- it is the ordinary case of two things in different shards
 * that a relation must span, which is what crossing ports exist for. So the
 * question this now answers is "which shard boundary does this relation cross,
 * and what legs express it?", and a peer relation that cannot be expressed
 * declines rather than relocating either endpoint.
 *
 * **The `satisfied` fast path was retired too, 2026-09-01.** It used to
 * decide "do these already share a host?" by fetching the subject's current
 * host graph and calling `bothObjectsOnGraph` directly, entirely bypassing
 * `findShardBoundary`/`buildCrossingLegs` below --- a second implementation of
 * exactly the degenerate case those two already handle correctly (an endpoint is its own zero-hop ancestor, so an already-shared
 * host resolves to a single portless leg, not a boundary crossing). Every
 * peer-kind candidate, same-host included, now walks (`findShardBoundary`)
 * then builds (`buildCrossingLegs`) unconditionally; there is no longer a
 * `getCurrentHost`/`getGraph` short-circuit ahead of that.
 *
 * Hosting kinds (`On`/`In`/`PartOf`) reach no branch here but an error, and
 * deliberately: "put the cup on the table" is a membership move, not a
 * relational placement. Conflating the two is exactly what made the old repair
 * outcome look load-bearing. If CD2h ever routes hosting kinds through this
 * function they need their own branch built for them.
 *
 * `env` carries plain injected callbacks, not live DB calls --- matches
 * `GroundingContext`/`expandTransferMembership.ts`'s convention. Standalone and unwired: does
 * not decide how Grounding and Expansion interleave (`AGENT.concepts.md`, "Synthesize's three
 * sub-roles") --- this function only operates on already-grounded ids.
 *
 * **`establishRelation` and `dissolveRelation` ask genuinely different questions of
 * genuinely different state**, and now call genuinely different primitives --- `findShardBoundary`
 * (containment ancestry: "where do I mint a fresh chain?") for establish,
 * `findRelationalChain` (existing relational edges/ports: "what chain already connects them?")
 * for dissolve. Before this, both operation kinds walked containment ancestry unconditionally;
 * that was silently correct for dissolve only in the portless/same-host case, where "where
 * ancestries meet" and "where the existing edge already is" coincide by construction --- it was
 * never exercised for a genuine crossing dissolve, which `buildCrossingLegs` refused
 * (`notYetImplemented`) before the coincidence could break. `findRelationalChain` needs
 * `getGraph`/`getCurrentHost`, which the old bare `getMembershipContainers` callback didn't
 * carry, hence the widened `env` parameter.
 */
export const expandSameHost = (
    input: {
        subjectId: EphemeraObjectId
        objectId: EphemeraObjectId
        relationKind: HostRelationalEdgeKind
        /** `relationKind: 'Custom'` only --- see `GroundedBinaryAssertion`'s doc comment. */
        relationLabel?: string
        /**
         * the collapsed ingress seed carries no sibling relational step any more, so
         * this is now the only place that knows whether the relation being expressed is an
         * establish or a dissolve --- `buildCrossingLegs`/`buildCrossingDissolveLegs` need it.
         */
        operationKind: 'establishRelation' | 'dissolveRelation'
    },
    envArg: Partial<Pick<ExpansionEnvironment, 'getMembershipContainers' | 'getGraph' | 'getCurrentHost'>> = {}
): ExpandSameHostResult => {
    const { subjectId, objectId, relationKind, relationLabel, operationKind } = input
    // Every caller (establish-side tests included) that never seeds a `sameHost` assertion of
    // the operation kind these stubs back can safely omit them --- same convention as
    // `ExpansionEnvironment.getMembershipContainers`'s own doc comment.
    const env = {
        getMembershipContainers: envArg.getMembershipContainers ?? (() => []),
        getGraph: envArg.getGraph ?? (() => undefined),
        getCurrentHost: envArg.getCurrentHost ?? (() => undefined),
    }

    // input validation, deliberately above every state lookup --- this asks nothing
    // about the world. `relationKind`/`relationLabel` arrive as two flat fields here (via
    // `GroundedBinaryAssertion`, which unions predicates and so cannot use
    // `RelationalKindAndLabel`'s discriminated pairing), which makes a label-less `Custom`
    // expressible at this boundary even though no producer of one exists: the live seed builds
    // the pair from an `EstablishRelationStep`/`DissolveRelationStep`, where the union
    // guarantees a label. Erroring rather than falling through to the `Custom` defer below,
    // which would route a malformed assertion to an LLM validator that has nothing to say
    // about a `Custom` relation with no text.
    if (relationKind === 'Custom' && relationLabel === undefined) {
        return {
            verdict: 'error',
            reason: `Custom sameHost assertion for ${subjectId}/${objectId} carries no relationLabel --- a Custom relation is its label, so this is malformed input rather than a semantic question (BD-10 does not apply)`,
        }
    }

    // Peer kinds only (AB-54). A hosting kind puts the subordinate node *inside* the superior's
    // own shard, so there is no boundary between them to cross and a minted crossing port would
    // be a false record of one --- they fall to the error below instead. `Present` is the port
    // mechanism's own kind and is never an assertion's subject.
    const isPeerKind = relationKind === 'Under' || relationKind === 'Against' || relationKind === 'Custom'

    if (isPeerKind) {
        if (operationKind === 'establishRelation') {
            // a violated peer relation is not a misplacement to be repaired --- it may
            // legitimately cross a shard boundary via a port pair (BD-16's third outcome, this
            // union's own doc comment). This was widened from `Custom`-only:
            // `buildCrossingLegs` was already general over kinds (it mints a bare-`kind` port for
            // the enum relations), and the gate was the only thing holding `Under`/`Against` back.
            const boundary = findShardBoundary({ subjectId, targetId: objectId }, env.getMembershipContainers)
            if (boundary.verdict === 'crossed') {
                const legs = buildCrossingLegs({
                    subjectId,
                    targetId: objectId,
                    commonAncestor: boundary.commonAncestor,
                    subjectPath: boundary.subjectPath,
                    targetPath: boundary.targetPath,
                    operationKind,
                    // Narrowed once, so both arms of `RelationalKindAndLabel`'s discriminated
                    // union spread cleanly --- `relationLabel` is checked non-undefined by the
                    // malformed-input guard at the top of the function, which is why
                    // the cast is safe.
                    ...(relationKind === 'Custom'
                        ? { relationKind: 'Custom' as const, relationLabel: relationLabel as string }
                        : { relationKind }),
                })
                if (legs.verdict === 'built') {
                    return { verdict: 'crossed', steps: legs.steps }
                }
            }
        } else {
            // dissolve asks a different question than establish --- not "where do I
            // mint a fresh chain?" (containment ancestry) but "what chain already connects them,
            // so a dissolve can remove it?" (existing relational edges/ports). This also
            // subsumes the old portless/same-host case: `findRelationalChain` finds the single
            // matching edge already sitting in the shared host's graph, the same step
            // `findShardBoundary`'s ancestry coincidence used to produce, without depending on
            // that coincidence. `findRelationalChain` takes the flat `relationKind`/
            // `relationLabel` pairing directly (unlike `buildCrossingLegs`, it has no
            // discriminated-union parameter to narrow into).
            const chain = findRelationalChain(
                { subjectId, targetId: objectId, relationKind, relationLabel },
                { getGraph: env.getGraph, getCurrentHost: env.getCurrentHost }
            )
            if (chain.verdict === 'found') {
                return { verdict: 'crossed', steps: buildCrossingDissolveLegs(chain.steps) }
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
        // uncertain. For establish, the relation is well understood and the endpoints are in
        // different shards; what is missing is a crossing this slice's leg producer can express
        // (no common ancestor, an ambiguous one, or a shape past its one-extra-hop-per-side
        // scope). For dissolve, either no matching chain exists or `findRelationalChain` found
        // more than one and declined to pick. An LLM has nothing to add to either, so
        // borrowing BD-10's wording would misroute the follow-up.
        const reason = operationKind === 'establishRelation'
            ? `No crossing could be built for the ${relationKind} relation between ${subjectId} and ${objectId} --- they share no host, and their shard boundary is unreachable or has a shape buildCrossingLegs does not yet support`
            : `No existing ${relationKind} relation chain found to dissolve between ${subjectId} and ${objectId} --- either none exists, or more than one qualifying chain was found and findRelationalChain declined to pick`
        return {
            verdict: 'defer',
            decidable: false,
            reason,
        }
    }

    return {
        verdict: 'error',
        reason: `sameHost violation for hosting kind ${relationKind} --- a hosting relation is a membership move, not a relational placement, and has no branch on this route (CD2h)`,
    }
}
