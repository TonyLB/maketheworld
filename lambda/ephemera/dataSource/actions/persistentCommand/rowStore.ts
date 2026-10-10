import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

import { isPersistentCommandExpired, persistentCommandDeleteAt } from './lifetime'
import type { PersistentCommandPayload } from './payload'
import { isPersistentCommandPayload } from './payload'
import { persistentCommandKey } from './rowKey'

/** Replaces the character's row for the session (a new command answers or replaces the pending one) and restarts its TTL. */
export const put = async (
    characterId: EphemeraCharacterId,
    sessionId: string,
    payload: PersistentCommandPayload
): Promise<void> => {
    await ephemeraDB.putItem({
        ...persistentCommandKey(characterId, sessionId),
        ...payload,
        deleteAt: persistentCommandDeleteAt(),
    })
}

/** The stored payload, or `undefined` when there is no row, it is past its `deleteAt`, or it fails the guard. Never throws on content. */
export const get = async (
    characterId: EphemeraCharacterId,
    sessionId: string
): Promise<PersistentCommandPayload | undefined> => {
    const row = await ephemeraDB.getItem<Record<string, unknown> & { deleteAt?: number }>({
        Key: persistentCommandKey(characterId, sessionId),
        getAllFields: true,
    })
    if (row === undefined || isPersistentCommandExpired(row)) {
        return undefined
    }
    const { root, transcript, pending, selectedAttempt, referentAnswers, challengeAnswers } = row
    const payload = { root, transcript, pending, selectedAttempt, referentAnswers, challengeAnswers }
    return isPersistentCommandPayload(payload) ? payload : undefined
}
