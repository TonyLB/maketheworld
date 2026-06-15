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
            threadKind: 'roomDescription',
            componentId: 'ROOM#C',
            perspectiveKey: 'p',
            characterId: 'CHARACTER#viewer',
        })
        expect(internalCache.PerceptionThreads.list('ROOM#C', 'p')).toHaveLength(1)
        internalCache.clear()
        expect(internalCache.PerceptionThreads.list('ROOM#C', 'p')).toHaveLength(0)
    })

    it('should fetch room roster via Positions.getRoomRoster only once', async () => {
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
        const getRoomRosterSpy = jest.spyOn(internalCache.Positions, 'getRoomRoster')
            .mockResolvedValue(expectedOutput)

        expect(await internalCache.RoomCharacterList.get('ROOM#1234')).toEqual(expectedOutput)
        expect(getRoomRosterSpy).toHaveBeenCalledTimes(1)
        expect(getRoomRosterSpy).toHaveBeenCalledWith('ROOM#1234')
        expect(await internalCache.RoomCharacterList.get('ROOM#1234')).toEqual(expectedOutput)
        expect(getRoomRosterSpy).toHaveBeenCalledTimes(1)

        getRoomRosterSpy.mockRestore()
    })

    it('flush includes GenerationContext handler', async () => {
        const flushSpy = jest.spyOn(internalCache.GenerationContext, 'flush')
        await internalCache.flush()
        expect(flushSpy).toHaveBeenCalledTimes(1)
    })

})