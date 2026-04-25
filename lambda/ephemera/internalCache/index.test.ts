jest.mock('@tonylb/mtw-utilities/ts/dynamoDB/index')
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB/index'

import internalCache from "."

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
            threadKind: 'stub',
            componentId: 'FEATURE#C',
            perspectiveKey: 'p',
        })
        expect(internalCache.PerceptionThreads.list('FEATURE#C', 'p')).toHaveLength(1)
        internalCache.clear()
        expect(internalCache.PerceptionThreads.list('FEATURE#C', 'p')).toHaveLength(0)
    })

    it('should fetch an async lookup only once', async () => {
        const testActiveCharacters = [
            {
                EphemeraId: 'CHARACTER#123',
                ConnectionIds: ['Test1'],
                Color: 'green',
                Name: 'Tess'
            },
            {
                EphemeraId: 'CHARACTER#456',
                ConnectionIds: ['Test2'],
                Color: 'purple',
                Name: 'Marco'
            }
        ]
        const expectedOutput = [
            {
                EphemeraId: 'CHARACTER#123',
                ConnectionIds: ['Test1'],
                Color: 'green',
                DisplayName: 'Tess',
                SessionIds: []
            },
            {
                EphemeraId: 'CHARACTER#456',
                ConnectionIds: ['Test2'],
                Color: 'purple',
                DisplayName: 'Marco',
                SessionIds: []
            }
        ]
        ephemeraMock.getItem.mockResolvedValue({
            activeCharacters: testActiveCharacters
        })
        expect(await internalCache.RoomCharacterList.get('ROOM#1234')).toEqual(expectedOutput)
        expect(ephemeraMock.getItem).toHaveBeenCalledTimes(1)
        expect(ephemeraMock.getItem).toHaveBeenCalledWith({
            Key: {
                DataCategory: 'Meta::Room',
                EphemeraId: 'ROOM#1234'
            },
            ProjectionFields: ['activeCharacters']
        })
        expect(await internalCache.RoomCharacterList.get('ROOM#1234')).toEqual(expectedOutput)
        expect(ephemeraMock.getItem).toHaveBeenCalledTimes(1)
        
    })

    it('flush includes GenerationContext handler', async () => {
        const flushSpy = jest.spyOn(internalCache.GenerationContext, 'flush')
        await internalCache.flush()
        expect(flushSpy).toHaveBeenCalledTimes(1)
    })

})