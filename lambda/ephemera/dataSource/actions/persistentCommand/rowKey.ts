import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'

export const PERSISTENT_COMMAND_CHARACTER_PREFIX = 'CHARACTER#'
export const PERSISTENT_COMMAND_SESSION_PREFIX = 'SESSION#'

export const persistentCommandDataCategory = (sessionId: string): string => (
    `${PERSISTENT_COMMAND_SESSION_PREFIX}${sessionId}`
)

/** One row per character per session; `characterId` is already the `CHARACTER#...` ephemera id. */
export const persistentCommandKey = (characterId: EphemeraCharacterId, sessionId: string) => ({
    EphemeraId: characterId,
    DataCategory: persistentCommandDataCategory(sessionId),
})
