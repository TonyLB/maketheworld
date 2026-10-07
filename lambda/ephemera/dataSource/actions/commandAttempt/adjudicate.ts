import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { CommandAttempt, CommandAttemptData, CommandAttemptReferent } from './index'
import type { AttemptActionData } from './action'
import type { NarrationUnit } from './narrationUnit'
import type { ChallengeData } from './challenge'
import { CustomEdgeChallenge } from './challenge'
import type { VerdictData } from './verdict'
import { MetVerdict } from './verdict'

/**
 * Adjudicate, the Coyote evaluator: a phase of the actions pipeline, run per candidate by
 * the shared stage's `expandAndAdjudicateCandidates`
 * (`enrich/objectManipulation/attemptCandidates.ts`) before the dry run validates the
 * attempt. Its verdicts ride the published attempt; positions honors them at commit and
 * never judges.
 *
 * Every player command is a preparation command, and in preparation a challenge on whether
 * a facilitating action can physically happen is met. So this records *met* on every
 * unjudged `Custom`-edge challenge and nothing else. It dispatches on challenge type because
 * which kinds a genre may judge is this adjudicator's policy, not something each challenge
 * should answer:
 * - a `Custom` edge's facilitating dissolve is always right: untying or cutting the lashing
 *   leaves the same graph, so the choice is manner;
 * - a peer subject-move (a `Custom` edge the moved object is attached to) is met, whether it
 *   means clearance (pull the rope out) or pinned (the boulder must move first). The graph cannot
 *   tell those apart and `Custom` has no finer kind to split on, so the rule is manner, not
 *   physics: the lashed rope and the rope under the post come out the same way (RD-5, 2026-10-06);
 * - a world-knowledge challenge is not a graph question at all (CA-6).
 *
 * There is no genre source, just as there is no phase source: Coyote is the only genre.
 */
export const adjudicateAttempt = (attempt: CommandAttempt): CommandAttempt =>
    attempt.actions()
        .flatMap((action) => action.challenges())
        .filter((challenge) => challenge instanceof CustomEdgeChallenge && challenge.verdict === undefined)
        .reduce((judged, challenge) => judged.recordVerdict(challenge.id, new MetVerdict()), attempt)

/** What the deferred tier may read: the room the prose renderer takes. */
export type DeferredAdjudicationContext = {
    roomId?: EphemeraRoomId
}

/**
 * The deferred adjudication tier (ISS8203 slice 3). It runs once, from Selection, on the top
 * deferred candidate, and it judges only the challenges the per-candidate tier leaves pending
 * (the exit contact; peer subject-moves are met by the per-candidate tier). The candidate is returned as it went in unless
 * this tier judged something, and a candidate that comes back unchanged abstains. The naive
 * implementation judges nothing; the relational-complexity LLM adjudicator replaces it behind
 * this contract (ladder layer 1's unowned remainder). Synchronous until that LLM lands.
 */
export const adjudicateDeferred = <T extends { attempt: CommandAttempt }>(
    candidate: T,
    _context: DeferredAdjudicationContext
): T => candidate

const isVerdictData = (value: unknown): value is VerdictData => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (v.kind === 'met') {
        return true
    }
    if (v.kind === 'impossible') {
        return typeof v.reason === 'string'
    }
    return false
}

const isChallengeData = (value: unknown): value is ChallengeData => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (typeof v.id !== 'string' || typeof v.description !== 'string') {
        return false
    }
    if (v.verdict !== undefined && !isVerdictData(v.verdict)) {
        return false
    }
    if (v.kind === 'worldKnowledge' || v.kind === 'exitEdge') {
        return true
    }
    if (v.kind === 'customEdge') {
        return typeof v.edge === 'object' && v.edge !== null
    }
    return false
}

const isAttemptActionData = (value: unknown): value is AttemptActionData => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (v.kind !== 'position') {
        return false
    }
    if (typeof v.id !== 'string') {
        return false
    }
    if (v.desiredResultDescription !== undefined && typeof v.desiredResultDescription !== 'string') {
        return false
    }
    return Array.isArray(v.challenges) && v.challenges.every(isChallengeData)
}

const isCommandAttemptReferent = (value: unknown): value is CommandAttemptReferent => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (typeof v.refKey !== 'string' || typeof v.id !== 'string' || typeof v.shortName !== 'string') {
        return false
    }
    return v.gloss === undefined || typeof v.gloss === 'string'
}

const isNarrationPartData = (value: unknown): boolean => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    return typeof v.text === 'string' || v.slot === 'actor' || typeof v.ref === 'string'
}

const isNarrationAudienceData = (value: unknown): boolean => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    return Array.isArray(v.refs) && v.refs.every((ref) => typeof ref === 'string')
        && (v.phase === 'before' || v.phase === 'after')
}

const isNarrationUnitData = (value: unknown): value is NarrationUnit => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (!Array.isArray(v.covers) || !v.covers.every((id) => typeof id === 'string')) {
        return false
    }
    if (!Array.isArray(v.variants)) {
        return false
    }
    return v.variants.every((variant) => {
        if (!variant || typeof variant !== 'object') {
            return false
        }
        const vv = variant as Record<string, unknown>
        return isNarrationAudienceData(vv.audience) && Array.isArray(vv.parts) && vv.parts.every(isNarrationPartData)
    })
}

/** Minimal structural guard for `CommandAttempt` at the published-payload bus boundary. */
export const isCommandAttemptData = (value: unknown): value is CommandAttemptData => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (typeof v.words !== 'string') {
        return false
    }
    if (!Array.isArray(v.referents) || !v.referents.every(isCommandAttemptReferent)) {
        return false
    }
    if (!Array.isArray(v.actions) || !v.actions.every(isAttemptActionData)) {
        return false
    }
    return Array.isArray(v.narrationUnits) && v.narrationUnits.every(isNarrationUnitData)
}
