import type { CommandAttemptData } from '../commandAttempt'
import type { VerdictData } from '../commandAttempt/verdict'
import { isCommandAttemptData, isVerdictData } from '../commandAttempt/adjudicate'
import type { ParseSkeleton } from '../enrich/objectManipulation/parse/parseToken'

/**
 * Plan's output, frozen: everything up to and including Plan reads only the command text, so
 * this is the point a resume restarts from (`compileAttemptsFromSkeleton`). World inputs
 * (character, host room, catalogs) are read fresh on resume and are deliberately not stored.
 */
export type PersistentCommandRoot = {
    command: string
    skeleton: ParseSkeleton
    attempts: CommandAttemptData[]
    confidence: number
}

/**
 * A verdict given to a challenge, and who gave it. `askedAs` records that adjudication decided
 * to ask the player about this challenge: the recorded question challenge's key (by convention
 * `ask:<challengeKey>`), so the question is re-added on resume even if a nondeterministic judge
 * would not ask again.
 */
export type ChallengeAnswer = {
    verdict: VerdictData
    source: 'player' | 'process'
    askedAs?: string
}

/**
 * The echo bubble this attempt answers: what a resume needs to republish its outcome under the
 * original `MessageId` (a revision resends the whole body, hence `command`). The session comes from
 * the row's key. Describes this attempt, not Plan's output, so it sits beside `root`, not inside it.
 */
export type PersistentCommandTranscript = {
    messageId: string
    createdTime: number
    command: string
}

export type PersistentCommandPayload = {
    root: PersistentCommandRoot
    /** Absent for a command with no echo (no session), and for rows written before it existed. */
    transcript?: PersistentCommandTranscript
    /** An attempt's action id (Plan-minted, so stable across reruns of the frozen root). */
    selectedAttempt?: string
    /** `stableRefKey` to thing id; narrows that span's candidate pool. */
    referentAnswers: Record<string, string>
    /** Challenge id (structural, see `expandBoundaryChallenges.ts`) to answer. */
    challengeAnswers: Record<string, ChallengeAnswer>
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
)

const isParseToken = (value: unknown): boolean => {
    if (!isRecord(value)) {
        return false
    }
    if (value.type === 'text') {
        return typeof value.text === 'string'
    }
    return value.type === 'objectSpan' && typeof value.span === 'string' && typeof value.stableRefKey === 'string'
}

const isChallengeAnswer = (value: unknown): value is ChallengeAnswer => (
    isRecord(value)
    && isVerdictData(value.verdict)
    && (value.source === 'player' || value.source === 'process')
    && (value.askedAs === undefined || typeof value.askedAs === 'string')
)

const isRecordOf = (check: (value: unknown) => boolean) => (value: unknown): boolean => (
    isRecord(value) && Object.values(value).every(check)
)

export const isPersistentCommandRoot =(value: unknown): value is PersistentCommandRoot => (
    isRecord(value)
    && typeof value.command === 'string'
    && Array.isArray(value.skeleton) && value.skeleton.every(isParseToken)
    && Array.isArray(value.attempts) && value.attempts.every(isCommandAttemptData)
    && typeof value.confidence === 'number'
)

const isPersistentCommandTranscript = (value: unknown): value is PersistentCommandTranscript => (
    isRecord(value)
    && typeof value.messageId === 'string'
    && typeof value.createdTime === 'number'
    && typeof value.command === 'string'
)

/** Structural guard: a stored row that fails it is treated as absent, so a later shape change can't break a session. */
export const isPersistentCommandPayload = (value: unknown): value is PersistentCommandPayload => (
    isRecord(value)
    && isPersistentCommandRoot(value.root)
    && (value.transcript === undefined || isPersistentCommandTranscript(value.transcript))
    && (value.selectedAttempt === undefined || typeof value.selectedAttempt === 'string')
    && isRecordOf((answer) => typeof answer === 'string')(value.referentAnswers)
    && isRecordOf(isChallengeAnswer)(value.challengeAnswers)
)
