import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

import { isPersistentCommandExpired } from './lifetime'
import type { PersistentCommandPayload, PersistentCommandTranscript } from './payload'
import { isPersistentCommandPayload } from './payload'
import { persistentCommandKey } from './rowKey'

type StoredRow = Record<string, unknown> & { deleteAt?: number }

const ROW_FIELDS = ['root', 'transcript', 'pending', 'selectedAttempt', 'referentAnswers', 'challengeAnswers', 'deleteAt']

export type AnswerPendingResult =
    /** This call marked the question answered: `payload` is the command to resume, with the chosen option's answers merged in and no `pending`. */
    | { outcome: 'answered'; payload: PersistentCommandPayload }
    /** The question was already answered (by this option or another): the bubble shows, or is about to show, the command's real outcome, so the caller must leave it alone. */
    | { outcome: 'duplicate' }
    /** Nothing was answered (no row, expired, no open question, or unknown option). `transcript` is the row's bubble when a valid row exists. */
    | { outcome: 'stale'; transcript?: PersistentCommandTranscript }

const payloadOf = (row: StoredRow | undefined): PersistentCommandPayload | undefined => {
    if (!row || isPersistentCommandExpired(row)) {
        return undefined
    }
    const { root, transcript, pending, selectedAttempt, referentAnswers, challengeAnswers } = row
    const payload = { root, transcript, pending, selectedAttempt, referentAnswers, challengeAnswers }
    return isPersistentCommandPayload(payload) ? payload : undefined
}

/**
 * Marks the open question answered with `optionId`, in place and atomically: the reducer sets
 * `pending.answer` only when the option exists and the question is unanswered, and the write is
 * conditional on `pending` being unchanged, so of two racing answers (or an answer racing a new
 * question that overwrote the row) at most one wins. The winner's pre-answer row comes back through
 * `successCallback`, so no separate read is needed.
 */
export const answerPending = async (
    characterId: EphemeraCharacterId,
    sessionId: string,
    optionId: string
): Promise<AnswerPendingResult> => {
    let prior: StoredRow | undefined
    const returned = await ephemeraDB.optimisticUpdate<StoredRow>({
        Key: persistentCommandKey(characterId, sessionId),
        updateKeys: ROW_FIELDS,
        checkKeys: ['pending'],
        updateReducer: (draft) => {
            const pending = draft.pending as { options?: Record<string, unknown>; answer?: string } | undefined
            if (
                !pending
                || pending.answer !== undefined
                || !Object.prototype.hasOwnProperty.call(pending.options ?? {}, optionId)
                || isPersistentCommandExpired(draft as { deleteAt?: number })
            ) {
                return
            }
            pending.answer = optionId
        },
        successCallback: async (_next, previous) => {
            // Immer revokes drafts after the reducer returns; `previous` is the plain fetched row.
            prior = previous
        },
    })
    const payload = payloadOf(prior)
    const chosen = payload?.pending?.options[optionId]
    if (payload && chosen) {
        const { pending, ...rest } = payload
        return { outcome: 'answered', payload: { ...rest, referentAnswers: { ...payload.referentAnswers, ...chosen } } }
    }
    const row = payloadOf(returned as StoredRow | undefined)
    if (row?.pending?.answer !== undefined) {
        return { outcome: 'duplicate' }
    }
    return { outcome: 'stale', ...(row?.transcript ? { transcript: row.transcript } : {}) }
}
