jest.mock('@tonylb/mtw-utilities/ts/dynamoDB/index')
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB/index'

import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { testPositionGraph } from '../dataSource/positions/positionGraph/testFixtures'
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
                    RoomId: 'ROOM#TownSquare',
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
                RoomId: 'ROOM#TownSquare',
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
                RoomId: 'ROOM#TownSquare',
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
            RoomId: 'ROOM#TownSquare',
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

    it('hydrates roster from stored positionGraph without activeCharacters Dynamo read', async () => {
        ephemeraMock.getItem.mockImplementation(async ({ ProjectionFields }) => {
            if (ProjectionFields?.includes('positionGraph')) {
                return {
                    positionGraph: {
                        nodes: [{ tag: 'Character', universalKey: CHARACTER_A }],
                    },
                }
            }
            throw new Error(`Unexpected Dynamo projection: ${ProjectionFields?.join(',')}`)
        })

        jest.spyOn(internalCache.CharacterMeta, 'get').mockResolvedValue({
            EphemeraId: CHARACTER_A,
            Name: 'Alpha',
            RoomId: TOWN_SQUARE,
            RoomStack: [],
            HomeId: 'ROOM#Home',
            assets: [],
            Color: 'blue',
            fileURL: 'https://example.com/alpha.png',
        })
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
        expect(ephemeraMock.getItem).toHaveBeenCalledWith(
            expect.objectContaining({
                ProjectionFields: ['positionGraph'],
            })
        )
    })

    it('uses memo-patched graph without Dynamo read', async () => {
        internalCache.Positions.set(
            testPositionGraph(TOWN_SQUARE, {
                nodes: [{ tag: 'Character', universalKey: CHARACTER_A }],
            })
        )

        jest.spyOn(internalCache.CharacterMeta, 'get').mockResolvedValue({
            EphemeraId: CHARACTER_A,
            Name: 'Alpha',
            RoomId: TOWN_SQUARE,
            RoomStack: [],
            HomeId: 'ROOM#Home',
            assets: [],
        })
        jest.spyOn(internalCache.CharacterSessions, 'get').mockResolvedValue(['sess-1'])

        await expect(getRoomCharacterList(TOWN_SQUARE)).resolves.toEqual([{
            EphemeraId: CHARACTER_A,
            DisplayName: 'Alpha',
            SessionIds: ['sess-1'],
        }])

        expect(ephemeraMock.getItem).not.toHaveBeenCalled()
    })

    it('returns empty roster when stored positionGraph is absent', async () => {
        ephemeraMock.getItem.mockImplementation(async ({ ProjectionFields }) => {
            if (ProjectionFields?.includes('positionGraph')) {
                return {}
            }
            throw new Error(`Unexpected Dynamo projection: ${ProjectionFields?.join(',')}`)
        })

        await expect(getRoomCharacterList(TOWN_SQUARE)).resolves.toEqual([])
        expect(ephemeraMock.getItem).toHaveBeenCalledTimes(1)
    })
})
