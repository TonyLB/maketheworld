import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { Referent } from '../plan/ungroundedPrimitive'
import type { EphemeraThingId } from '../thing'

export type ResolvedSpan =
    | { verdict: 'resolved'; candidateIds: readonly EphemeraThingId[] }
    | { verdict: 'unresolved'; reason: string }

/**
 * Grounding's input (BD-23, 2026-07-19): ranked candidate pools per stableRefKey,
 * not one settled verdict per span. Two objectSpan referents with distinct
 * stableRefKeys can carry the same or different candidate lists --- Grounding's
 * job is to enumerate combinations across a Change's referents (see
 * groundChange.ts), never to collapse to one answer or reject a same-object
 * combination itself. That legality judgment belongs to Validation, a later,
 * separate step.
 */
export type GroundingContext = {
    actingCharacterId: EphemeraCharacterId
    resolvedSpans: ReadonlyMap<string, ResolvedSpan>
    getCurrentHost: (
        componentId: EphemeraThingId | EphemeraMembershipHostId
    ) => EphemeraMembershipHostId | undefined
}

/**
 * `ok: false` is hard-terminal today --- no caller distinguishes "genuinely
 * unresolvable" from "Identify should be asked to reconsider with this new
 * constraint." The latter (a Synthesize -> Identify backtrack/correction
 * channel) is a named-but-unbuilt future direction (see
 * `AGENT.backtrackChannel.planning.md`, BD-18) --- don't let the
 * Pipeline A -> B migration harden this shape in a way that forecloses adding
 * a third outcome later.
 */
export type GroundReferentResult =
    | { ok: true; candidates: readonly (EphemeraThingId | EphemeraMembershipHostId)[] }
    | { ok: false; reason: string }

/**
 * Resolves a `Referent` (`objectSpan` / `actingCharacter` / `currentHost`) into
 * its full candidate list --- the compositional interpretation `AGENT.concepts.md`
 * calls Grounding. `currentHost(X)` grounds `X` first (possibly multiple
 * candidates), then looks up each candidate's current host via the injected
 * callback, dropping any that don't resolve rather than failing the whole
 * referent --- one candidate's host lookup failing doesn't invalidate another
 * candidate. Fails only when no candidate produces a host at all.
 */
export const groundReferent = (
    referent: Referent,
    context: GroundingContext
): GroundReferentResult => {
    switch (referent.referentType) {
        case 'objectSpan': {
            if (referent.stableRefKey === undefined) {
                return {
                    ok: false,
                    reason: `objectSpan referent for span "${referent.span}" has no stableRefKey to ground against`,
                }
            }
            const resolved = context.resolvedSpans.get(referent.stableRefKey)
            if (!resolved) {
                return { ok: false, reason: `No resolution supplied for stableRefKey "${referent.stableRefKey}"` }
            }
            if (resolved.verdict === 'unresolved') {
                return { ok: false, reason: resolved.reason }
            }
            return { ok: true, candidates: resolved.candidateIds }
        }
        case 'actingCharacter':
            return { ok: true, candidates: [context.actingCharacterId] }
        case 'currentHost': {
            const target = groundReferent(referent.referentTarget, context)
            if (!target.ok) {
                return target
            }
            const hosts = [...new Set(
                target.candidates
                    .map((candidate) => context.getCurrentHost(candidate))
                    .filter((host): host is EphemeraMembershipHostId => host !== undefined)
            )]
            if (hosts.length === 0) {
                return { ok: false, reason: `No current host found for any candidate of ${referent.referentTarget.referentType}` }
            }
            return { ok: true, candidates: hosts }
        }
    }
}
