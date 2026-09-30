import type { CommandAttemptData, CommandAttemptReferent } from './index'
import { CommandAttempt } from './index'
import type { AttemptActionData } from './action'
import type { ChallengeData } from './challenge'
import type { VerdictData } from './verdict'

/**
 * The Adjudicate seam (CA-3, slice 2): resolved to run positions-side, in
 * `positions/index.ts`'s dispatch, right after reconstructing the attempt from the
 * published payload --- the one place every route already crosses the bus, and where
 * a future `met` verdict needs to land to reach the commit recheck (CA-7).
 *
 * Slice 2's body is a documented no-op: it records no verdicts. A challenge-free
 * attempt already resolves to `succeeded` via `CommandAttempt.result` (nothing to
 * adjudicate), and any attempt carrying a real graph challenge stays `pending` ---
 * matching today's silent defer exactly (corpus row 6 stays silently unadjudicated on
 * purpose). Slice 3 is what records `met` on every graph challenge here.
 */
export const adjudicateAttempt = (attempt: CommandAttempt): CommandAttempt => attempt

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
    if (v.kind === 'worldKnowledge') {
        return true
    }
    if (v.kind === 'customEdge' || v.kind === 'underDefer') {
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
    return Array.isArray(v.actions) && v.actions.every(isAttemptActionData)
}
