import type { PersistentCommandPayload } from './payload'

/** The echo bubble a command's outcome is republished onto (a revision resends the whole body). */
export type TranscriptContext = {
    messageId: string
    createdTime: number
    command: string
    sessionId: string
}

/**
 * The bubble a resumed command's outcome lands on: the id the row stored, plus the session from the
 * row's key. Undefined when the row has no echo, so the outcome falls back to an OOC line.
 */
export const transcriptContextForResume = (
    payload: PersistentCommandPayload,
    sessionId: string
): TranscriptContext | undefined => (
    payload.transcript ? { ...payload.transcript, sessionId } : undefined
)
