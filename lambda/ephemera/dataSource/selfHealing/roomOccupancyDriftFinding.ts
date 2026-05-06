import { connectionDB, ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { isEphemeraRoomId, type EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { MessageBus } from '../../messageBus/baseClasses'
import internalCache from '../../internalCache'

type RoomOccupancyEntry = {
    EphemeraId: string
    DisplayName?: string
    Name?: string
    fileURL?: string
    Color?: string
    SessionIds?: string[]
    sessions?: string[]
}

type CharacterMetaRow = {
    EphemeraId: string
    DataCategory: string
    RoomId?: string
    Name?: string
    fileURL?: string
    Color?: string
}

const normalizeRoomId = (value: string | undefined): EphemeraRoomId | null => {
    if (!value) {
        return null
    }
    const normalized = value.startsWith('ROOM#') ? value : `ROOM#${value}`
    return isEphemeraRoomId(normalized) ? normalized : null
}

const normalizeSessionIds = (entry: RoomOccupancyEntry): string[] => {
    const base = Array.isArray(entry.SessionIds) ? entry.SessionIds : (Array.isArray(entry.sessions) ? entry.sessions : [])
    return [...new Set(base.filter((sessionId): sessionId is string => (typeof sessionId === 'string' && sessionId.length > 0)))].sort()
}

const occupancyFingerprint = (entries: RoomOccupancyEntry[]): string =>
    JSON.stringify(entries
        .map((entry) => ({
            EphemeraId: entry.EphemeraId,
            DisplayName: entry.DisplayName ?? '',
            fileURL: entry.fileURL ?? '',
            Color: entry.Color ?? '',
            SessionIds: normalizeSessionIds(entry)
        }))
        .sort((a, b) => a.EphemeraId.localeCompare(b.EphemeraId)))

const queryCharacterSessions = async (characterId: string): Promise<string[]> => {
    const row = await connectionDB.getItem<{ sessions?: unknown[] }>({
        Key: {
            ConnectionId: characterId,
            DataCategory: 'Meta::Character'
        },
        ProjectionFields: ['sessions']
    })
    const rowSessions = row?.sessions
    const sessions = Array.isArray(rowSessions) ? rowSessions : []
    return [...new Set(sessions
        .filter((sessionId): sessionId is string => (typeof sessionId === 'string' && sessionId.length > 0)))].sort()
}

const listAllCharacterMetaRows = async (): Promise<CharacterMetaRow[]> =>
    await ephemeraDB.query<CharacterMetaRow>({
        IndexName: 'DataCategoryIndex',
        Key: { DataCategory: 'Meta::Character' },
        ProjectionFields: ['EphemeraId', 'DataCategory', 'RoomId', 'Name', 'fileURL', 'Color']
    })

export const handleRoomOccupancyDriftFinding = async ({ roomId, messageBus }: {
    roomId: EphemeraRoomId
    messageBus: MessageBus
}): Promise<{ changed: boolean; checkLocationQueued: boolean }> => {
    const [roomMeta, characterMetaRows] = await Promise.all([
        ephemeraDB.getItem<{ activeCharacters?: RoomOccupancyEntry[] }>({
            Key: {
                EphemeraId: roomId,
                DataCategory: 'Meta::Room'
            },
            ProjectionFields: ['activeCharacters']
        }),
        listAllCharacterMetaRows()
    ])
    const currentOccupancy = Array.isArray(roomMeta?.activeCharacters) ? roomMeta?.activeCharacters ?? [] : []
    const roomByCharacter = new Map(
        characterMetaRows.map(({ EphemeraId, RoomId }) => [EphemeraId, normalizeRoomId(RoomId)] as const)
    )
    const checkLocationQueued = currentOccupancy.some((entry) => (
        normalizeSessionIds(entry).length > 0 && !roomByCharacter.get(entry.EphemeraId)
    ))

    const authoritativeCharacters = characterMetaRows.filter(({ RoomId }) => (normalizeRoomId(RoomId) === roomId))
    const previousByCharacter = new Map(currentOccupancy.map((entry) => ([entry.EphemeraId, entry])))
    const repairedOccupancy = (await Promise.all(authoritativeCharacters.map(async (character) => {
        const sessions = await queryCharacterSessions(character.EphemeraId)
        if (!sessions.length) {
            return null
        }
        const previous = previousByCharacter.get(character.EphemeraId)
        return {
            EphemeraId: character.EphemeraId,
            DisplayName: previous?.DisplayName ?? previous?.Name ?? character.Name ?? '',
            fileURL: previous?.fileURL ?? character.fileURL,
            Color: previous?.Color ?? character.Color,
            SessionIds: sessions
        } as RoomOccupancyEntry
    }))).filter((value): value is RoomOccupancyEntry => Boolean(value))
        .sort((a, b) => a.EphemeraId.localeCompare(b.EphemeraId))

    const changed = occupancyFingerprint(currentOccupancy) !== occupancyFingerprint(repairedOccupancy)
    if (changed) {
        await ephemeraDB.optimisticUpdate({
            Key: {
                EphemeraId: roomId,
                DataCategory: 'Meta::Room'
            },
            updateKeys: ['activeCharacters'],
            updateReducer: (draft) => {
                draft.activeCharacters = repairedOccupancy
            },
            successCallback: ({ activeCharacters }) => {
                internalCache.ComponentEphemeraMeta.invalidate(roomId)
                internalCache.ComponentStackMerge.invalidate(roomId)
                internalCache.RoomCharacterList.set({ key: roomId, value: activeCharacters ?? [] })
                messageBus.send({
                    type: 'RoomUpdate',
                    roomId
                })
            }
        })
    }

    if (checkLocationQueued) {
        messageBus.send({
            type: 'CheckLocation',
            roomId
        })
    }

    return { changed, checkLocationQueued }
}
