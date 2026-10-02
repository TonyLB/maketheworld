import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { Referent } from '../plan/planStep'
import type { EphemeraThingId } from '../thing'

export type ResolvedSpan =
    | { verdict: 'resolved'; candidateIds: readonly EphemeraThingId[] }
    | { verdict: 'unresolved'; reason: string }

/**
 * Grounding's input (BD-23, 2026-07-19): candidate lists per stableRefKey. The product
 * over a Change's identity candidates is formed by the producer, before Grounding (AP-1,
 * `AGENT.commandAttemptPipeline.planning.md`), so by the time `groundChange` reads this,
 * each list a referent consults should hold one id; `groundChange` fails one that doesn't.
 * Grounding never rejects a same-object assignment itself: that legality judgment belongs
 * to Validation, a later, separate step.
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
 * Resolves a `Referent` into its full candidate list --- the compositional
 * interpretation `AGENT.concepts.md` calls Grounding. A referent whose `groundedId`
 * is already known is its own single candidate, whatever its kind (a `graphNode` is
 * always one). Otherwise: `currentHost(X)` grounds `X` first (possibly multiple
 * candidates), then looks up each candidate's current host via the injected
 * callback, dropping any that don't resolve rather than failing the whole
 * referent --- one candidate's host lookup failing doesn't invalidate another
 * candidate. Fails only when no candidate produces a host at all.
 */
export const groundReferent = (
    referent: Referent,
    context: GroundingContext
): GroundReferentResult => {
    if (referent.groundedId !== undefined) {
        return { ok: true, candidates: [referent.groundedId] }
    }
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
        case 'graphNode':
            // Unreachable: a graphNode is born grounded, so the check above returns first.
            // Kept so the switch stays exhaustive over referent kinds.
            return { ok: true, candidates: [referent.groundedId] }
    }
}
