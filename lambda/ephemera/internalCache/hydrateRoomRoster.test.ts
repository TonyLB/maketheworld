jest.mock('@tonylb/mtw-utilities/ts/dynamoDB/index')
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB/index'

import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { testLudicGraph } from '../dataSource/positions/ludicGraph/testFixtures'
import internalCache from './index'
import { getRoomCharacterList, hydrateRoomRosterFromCharacterIds } from './hydrateRoomRoster'

const ephemeraMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>

const CHARACTER_A = 'CHARACTER#Alpha' as EphemeraCharacterId
const CHARACTER_B = 'CHARACTER#Beta' as EphemeraCharacterId
const CHARACTER_MISSING = 'CHARACTER#Missing' as EphemeraCharacterId
const TOWN_SQUARE = 'ROOM#TownSquare' as EphemeraRoomId

describe('hydrateRoomRosterFromCharacterIds', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        internalCache.clear()
    })

    it('maps CharacterMeta.Name to DisplayName and SessionIds from CharacterSessions', async () => {
        const metaGet = jest.spyOn(internalCache.CharacterMeta, 'get')
        metaGet.mockImplementation(async (characterId) => {
            if (characterId === CHARACTER_A) {
                return {
                    EphemeraId: CHARACTER_A,
                    Name: 'Alpha',
                    RoomStack: [],
                    HomeId: 'ROOM#Home',
                    assets: [],
                    Color: 'blue',
                    fileURL: 'https://example.com/alpha.png',
                }
            }
            return {
                EphemeraId: CHARACTER_B,
                Name: 'Beta',
                RoomStack: [],
                HomeId: 'ROOM#Home',
                assets: [],
            }
        })
        jest.spyOn(internalCache.CharacterSessions, 'get').mockImplementation(async (characterId) => {
            if (characterId === CHARACTER_A) {
                return ['sess-a-1', 'sess-a-2']
            }
            if (characterId === CHARACTER_B) {
                return ['sess-b-1']
            }
            return undefined
        })

        await expect(hydrateRoomRosterFromCharacterIds([CHARACTER_A, CHARACTER_B])).resolves.toEqual([
            {
                EphemeraId: CHARACTER_A,
                DisplayName: 'Alpha',
                SessionIds: ['sess-a-1', 'sess-a-2'],
                Color: 'blue',
                fileURL: 'https://example.com/alpha.png',
            },
            {
                EphemeraId: CHARACTER_B,
                DisplayName: 'Beta',
                SessionIds: ['sess-b-1'],
            },
        ])
    })

    it('returns empty array for empty character id list', async () => {
        const metaSpy = jest.spyOn(internalCache.CharacterMeta, 'get')
        const sessionsSpy = jest.spyOn(internalCache.CharacterSessions, 'get')

        await expect(hydrateRoomRosterFromCharacterIds([])).resolves.toEqual([])

        expect(metaSpy).not.toHaveBeenCalled()
        expect(sessionsSpy).not.toHaveBeenCalled()
    })

    it('omits characters missing CharacterMeta', async () => {
        const metaGet = jest.spyOn(internalCache.CharacterMeta, 'get') as jest.Mock
        metaGet.mockImplementation(async (characterId: EphemeraCharacterId, options?: { check?: boolean }) => {
            if (options?.check && characterId === CHARACTER_MISSING) {
                return undefined
            }
            return {
                EphemeraId: CHARACTER_A,
                Name: 'Alpha',
                RoomStack: [],
                HomeId: 'ROOM#Home',
                assets: [],
            }
        })
        jest.spyOn(internalCache.CharacterSessions, 'get').mockResolvedValue(['sess-a-1'])

        await expect(
            hydrateRoomRosterFromCharacterIds([CHARACTER_MISSING, CHARACTER_A])
        ).resolves.toEqual([
            {
                EphemeraId: CHARACTER_A,
                DisplayName: 'Alpha',
                SessionIds: ['sess-a-1'],
            },
        ])
    })

    it('uses empty SessionIds when CharacterSessions is undefined', async () => {
        jest.spyOn(internalCache.CharacterMeta, 'get').mockResolvedValue({
            EphemeraId: CHARACTER_A,
            Name: 'Alpha',
            RoomStack: [],
            HomeId: 'ROOM#Home',
            assets: [],
        })
        jest.spyOn(internalCache.CharacterSessions, 'get').mockResolvedValue(undefined)

        await expect(hydrateRoomRosterFromCharacterIds([CHARACTER_A])).resolves.toEqual([
            {
                EphemeraId: CHARACTER_A,
                DisplayName: 'Alpha',
                SessionIds: [],
            },
        ])
    })
})

describe('getRoomCharacterList', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCache.clear()
    })

    const alphaMeta: Awaited<ReturnType<typeof internalCache.CharacterMeta.get>> = {
        EphemeraId: CHARACTER_A,
        Name: 'Alpha',
        RoomStack: [],
        HomeId: 'ROOM#Home',
        assets: [],
        Color: 'blue',
        fileURL: 'https://example.com/alpha.png',
    }

    it('hydrates the roster from the complete characters row, reading no room graph', async () => {
        ephemeraMock.getItem.mockImplementation(async ({ Key }) => {
            if (Key.DataCategory === 'LudicCache::Characters') {
                return { EphemeraId: TOWN_SQUARE, DataCategory: 'LudicCache::Characters', complete: true, [CHARACTER_A]: ['PRESENCE#a1'] }
            }
            throw new Error(`Unexpected Dynamo read: ${Key.DataCategory}`)
        })
        jest.spyOn(internalCache.CharacterMeta, 'get').mockResolvedValue(alphaMeta)
        jest.spyOn(internalCache.CharacterSessions, 'get').mockResolvedValue(['sess-1'])

        await expect(getRoomCharacterList(TOWN_SQUARE)).resolves.toEqual([
            {
                EphemeraId: CHARACTER_A,
                DisplayName: 'Alpha',
                SessionIds: ['sess-1'],
                Color: 'blue',
                fileURL: 'https://example.com/alpha.png',
            },
        ])

        expect(ephemeraMock.getItem).toHaveBeenCalledTimes(1)
        expect(ephemeraMock.getItem).toHaveBeenCalledWith(expect.objectContaining({
            Key: { EphemeraId: TOWN_SQUARE, DataCategory: 'LudicCache::Characters' },
            ConsistentRead: true,
        }))
    })

    it('ignores the memo-patched room graph', async () => {
        internalCache.Positions.set(
            testLudicGraph(TOWN_SQUARE, {
                nodes: [{ tag: 'Character', universalKey: CHARACTER_B }],
            })
        )
        ephemeraMock.getItem.mockResolvedValue({ complete: true, [CHARACTER_A]: ['PRESENCE#a1'] })
        jest.spyOn(internalCache.CharacterMeta, 'get').mockResolvedValue(alphaMeta)
        jest.spyOn(internalCache.CharacterSessions, 'get').mockResolvedValue(['sess-1'])

        const roster = await getRoomCharacterList(TOWN_SQUARE)
        expect(roster.map(({ EphemeraId }) => EphemeraId)).toEqual([CHARACTER_A])
    })

    it('rebuilds an absent row from the room graph rather than answering empty', async () => {
        ephemeraMock.getItem.mockImplementation(async ({ Key, ProjectionFields }) => {
            if (Key.DataCategory === 'LudicCache::Characters') {
                return undefined
            }
            if (ProjectionFields?.includes('ludicGraph')) {
                return Key.EphemeraId === TOWN_SQUARE
                    ? { ludicGraph: { nodes: [{ tag: 'Character', universalKey: CHARACTER_A }] } }
                    : {}
            }
            throw new Error(`Unexpected Dynamo read: ${Key.DataCategory}`)
        })
        // the shared dynamoDB mock predates `strictPrimitiveUpdate`; the rebuild's completing write is a no-op here
        ;(ephemeraMock as any).strictPrimitiveUpdate = jest.fn().mockResolvedValue(undefined)
        jest.spyOn(internalCache.CharacterMeta, 'get').mockResolvedValue(alphaMeta)
        jest.spyOn(internalCache.CharacterSessions, 'get').mockResolvedValue(['sess-1'])

        const roster = await getRoomCharacterList(TOWN_SQUARE)
        expect(roster.map(({ EphemeraId }) => EphemeraId)).toEqual([CHARACTER_A])
    })
})
