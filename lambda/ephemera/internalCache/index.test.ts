jest.mock('@tonylb/mtw-utilities/ts/dynamoDB/index')
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB/index'

import { testPositionGraph } from '../dataSource/positions/ludicGraph/testFixtures'
import internalCache from "."
import { getRoomCharacterList } from './hydrateRoomRoster'

const ephemeraMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>

describe('InternalCache', () => {
    const defaultGameRooms = ['VORTEX', 'STRAIGHTAWAY', 'CLIFFTOP', 'CORNER', 'BRIDGE']

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCache.clear()
    })

    it('should return undefined on KeyValue cache when not set', async () => {
        expect(await internalCache.Global.get('ConnectionId')).toBe(undefined)
    })

    it('should return set value on KeyValue cache when set', async () => {
        internalCache.Global.set({ key: 'ConnectionId', value: 'TestConnection' })
        expect(await internalCache.Global.get('ConnectionId')).toEqual('TestConnection')
    })

    it('returns default CoyoteGame room list', async () => {
        expect(await internalCache.CoyoteGame.get('gameRooms')).toEqual(defaultGameRooms)
    })

    it('returns overridden CoyoteGame room list when set', async () => {
        internalCache.CoyoteGame.set({ key: 'gameRooms', value: ['ROOM#1', 'ROOM#2'] })
        expect(await internalCache.CoyoteGame.get('gameRooms')).toEqual(['ROOM#1', 'ROOM#2'])
    })

    it('clear restores default CoyoteGame room list', async () => {
        internalCache.CoyoteGame.set({ key: 'gameRooms', value: ['ROOM#1'] })
        internalCache.clear()
        expect(await internalCache.CoyoteGame.get('gameRooms')).toEqual(defaultGameRooms)
    })

    it('clear resets PerceptionThreads', () => {
        internalCache.PerceptionThreads.register({
            threadKind: 'roomHeaderBroadcast',
            componentId: 'ROOM#C',
            perspectiveKey: 'p',
            targets: ['CHARACTER#viewer'],
        })
        expect(internalCache.PerceptionThreads.list('ROOM#C', 'p')).toHaveLength(1)
        internalCache.clear()
        expect(internalCache.PerceptionThreads.list('ROOM#C', 'p')).toHaveLength(0)
    })

    it('getRoomCharacterList derives roster from Positions.getLudicGraph on each call', async () => {
        const expectedOutput = [
            {
                EphemeraId: 'CHARACTER#123' as const,
                Color: 'green' as const,
                DisplayName: 'Tess',
                SessionIds: ['sess-1'],
            },
            {
                EphemeraId: 'CHARACTER#456' as const,
                Color: 'purple' as const,
                DisplayName: 'Marco',
                SessionIds: [],
            },
        ]
        const getLudicGraphSpy = jest.spyOn(internalCache.Positions, 'getLudicGraph')
            .mockResolvedValue(testPositionGraph('ROOM#1234', {
                nodes: [
                    { tag: 'Character', universalKey: 'CHARACTER#123' },
                    { tag: 'Character', universalKey: 'CHARACTER#456' },
                ],
            }))
        jest.spyOn(internalCache.CharacterMeta, 'get').mockImplementation(async (characterId) => {
            if (characterId === 'CHARACTER#123') {
                return {
                    EphemeraId: 'CHARACTER#123',
                    Name: 'Tess',
                    RoomId: 'ROOM#1234',
                    RoomStack: [],
                    HomeId: 'ROOM#Home',
                    assets: [],
                    Color: 'green',
                }
            }
            return {
                EphemeraId: 'CHARACTER#456',
                Name: 'Marco',
                RoomId: 'ROOM#1234',
                RoomStack: [],
                HomeId: 'ROOM#Home',
                assets: [],
                Color: 'purple',
            }
        })
        jest.spyOn(internalCache.CharacterSessions, 'get').mockImplementation(async (characterId) => {
            if (characterId === 'CHARACTER#123') {
                return ['sess-1']
            }
            return []
        })

        expect(await getRoomCharacterList('ROOM#1234')).toEqual(expectedOutput)
        expect(getLudicGraphSpy).toHaveBeenCalledTimes(1)
        expect(getLudicGraphSpy).toHaveBeenCalledWith('ROOM#1234')
        expect(await getRoomCharacterList('ROOM#1234')).toEqual(expectedOutput)
        expect(getLudicGraphSpy).toHaveBeenCalledTimes(2)

        getLudicGraphSpy.mockRestore()
    })

    it('flush includes GenerationContext handler', async () => {
        const flushSpy = jest.spyOn(internalCache.GenerationContext, 'flush')
        await internalCache.flush()
        expect(flushSpy).toHaveBeenCalledTimes(1)
    })

})