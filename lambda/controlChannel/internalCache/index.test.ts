jest.mock('@tonylb/mtw-utilities/dist/dynamoDB/index')
import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB/index'
import exp from 'constants'

import internalCache from "."

const ephemeraMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>

describe('InternalCache', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCache.clear()
    })

    it('should return undefined on KeyValue cache when not set', async () => {
        expect(await internalCache.get({ category: 'Global', key: 'ConnectionId' })).toBe(undefined)
    })

    it('should return set value on KeyValue cache when set', async () => {
        internalCache.set({ category: 'Global', key: 'ConnectionId', value: 'TestConnection' })
        expect(await internalCache.get({ category: 'Global', key: 'ConnectionId' })).toEqual('TestConnection')
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
                Name: 'Tess'
            },
            {
                EphemeraId: 'CHARACTER#456',
                ConnectionIds: ['Test2'],
                Color: 'purple',
                Name: 'Marco'
            }
        ]
        ephemeraMock.getItem.mockResolvedValue({
            activeCharacters: testActiveCharacters
        })
        expect(await internalCache.get({ category: 'RoomCharacterList', key: '1234' })).toEqual(expectedOutput)
        expect(ephemeraMock.getItem).toHaveBeenCalledTimes(1)
        expect(ephemeraMock.getItem).toHaveBeenCalledWith({
            DataCategory: 'Meta::Room',
            EphemeraId: 'ROOM#1234',
            ProjectionFields: ['activeCharacters']
        })
        expect(await internalCache.get({ category: 'RoomCharacterList', key: '1234' })).toEqual(expectedOutput)
        expect(ephemeraMock.getItem).toHaveBeenCalledTimes(1)
        
    })

})