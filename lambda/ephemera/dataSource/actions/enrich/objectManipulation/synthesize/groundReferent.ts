import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { Referent } from '../plan/ungroundedPrimitive'

export type ResolvedSpan =
    | { verdict: 'resolved'; objectId: EphemeraObjectId }
    | { verdict: 'unresolved'; reason: string }

/**
 * Grounding's input: already-resolved per-span ids, not raw ranked candidate
 * pools. Identify (pool emission + selection + LLM-consult-if-ambiguous) is a
 * separate, already-scoped job --- Grounding only interprets the `Referent`
 * tree once each leaf span is a settled verdict.
 */
export type GroundingContext = {
    actingCharacterId: EphemeraCharacterId
    resolvedSpans: ReadonlyMap<string, ResolvedSpan>
    getCurrentHost: (
        componentId: EphemeraObjectId | EphemeraCharacterId | EphemeraMembershipHostId
    ) => EphemeraMembershipHostId | undefined
}

/**
 * `ok: false` is hard-terminal today --- no caller distinguishes "genuinely
 * unresolvable" from "Identify should be asked to reconsider with this new
 * constraint." The latter (a Synthesize -> Identify backtrack/correction
 * channel) is a named-but-unbuilt future direction (see
 * `AGENT.manipulationFrameAndRelational.planning.md`, BD-18) --- don't let the
 * Pipeline A -> B migration harden this shape in a way that forecloses adding
 * a third outcome later.
 */
export type GroundReferentResult =
    | { ok: true; value: EphemeraObjectId | EphemeraCharacterId | EphemeraMembershipHostId }
    | { ok: false; reason: string }

/**
 * Resolves a `Referent` (`objectSpan` / `actingCharacter` / `currentHost`) into
 * a real id --- the compositional interpretation `AGENT.concepts.md` calls
 * Grounding. `currentHost(X)` grounds `X` first, then looks up its current
 * host via the injected callback (a plain dependency, not a live DB call, so
 * unit tests can supply a fixed map --- mirrors this codebase's `deps`
 * injection pattern elsewhere, e.g. `ApplyHostEffectsDependencies`).
 */
export const groundReferent = (
    referent: Referent,
    context: GroundingContext
): GroundReferentResult => {
    switch (referent.referentType) {
        case 'objectSpan': {
            const resolved = context.resolvedSpans.get(referent.span)
            if (!resolved) {
                return { ok: false, reason: `No resolution supplied for span "${referent.span}"` }
            }
            if (resolved.verdict === 'unresolved') {
                return { ok: false, reason: resolved.reason }
            }
            return { ok: true, value: resolved.objectId }
        }
        case 'actingCharacter':
            return { ok: true, value: context.actingCharacterId }
        case 'currentHost': {
            const target = groundReferent(referent.referentTarget, context)
            if (!target.ok) {
                return target
            }
            const host = context.getCurrentHost(target.value)
            if (!host) {
                return { ok: false, reason: `No current host found for ${target.value}` }
            }
            return { ok: true, value: host }
        }
    }
}
