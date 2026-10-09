import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

import {
    PERSISTENT_COMMAND_CHARACTER_PREFIX,
    persistentCommandDataCategory,
    persistentCommandKey,
} from './rowKey'

export const clear = async (characterId: EphemeraCharacterId, sessionId: string): Promise<void> => {
    await ephemeraDB.deleteItem(persistentCommandKey(characterId, sessionId))
}

/**
 * Deletes every character's row for the session. Queries by session rather than taking the
 * disconnect event's `characterIds`, since a character the session already left can still have a row.
 */
export const clearSession = async (sessionId: string): Promise<void> => {
    const rows = await ephemeraDB.query<{ EphemeraId: EphemeraCharacterId; DataCategory: string }>({
        IndexName: 'DataCategoryIndex',
        Key: { DataCategory: persistentCommandDataCategory(sessionId) },
        KeyConditionExpression: 'begins_with(EphemeraId, :characterPrefix)',
        ExpressionAttributeValues: { ':characterPrefix': PERSISTENT_COMMAND_CHARACTER_PREFIX },
    })
    await Promise.all(
        rows.map(({ EphemeraId, DataCategory }) => ephemeraDB.deleteItem({ EphemeraId, DataCategory }))
    )
}
