jest.mock('@tonylb/mtw-utilities/dist/dynamoDB/index')
import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB/index'

import internalCache from "."

const ephemeraMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>

describe('InternalCache', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCache.clear()
    })

    it('should return undefined on KeyValue cache when not set', async () => {
        expect(await internalCache.get({ category: 'Global', key: 'connectionId' })).toBe(undefined)
    })

    it('should return set value on KeyValue cache when set', async () => {
        internalCache.set({ category: 'Global', key: 'connectionId', value: 'TestConnection' })
        expect(await internalCache.get({ category: 'Global', key: 'connectionId' })).toEqual('TestConnection')
    })

    it('should fetch an async lookup only once', async () => {
        const testActiveCharacters = {
            'CHARACTER#123': {
                EphemeraId: 'CHARACTER#123',
                ConnectionIds: ['Test1'],
                Color: 'green',
                Name: 'Tess'
            },
            'CHARACTER#456': {
                EphemeraId: 'CHARACTER#456',
                ConnectionIds: ['Test2'],
                Color: 'purple',
                Name: 'Marco'
            }
        }
        ephemeraMock.getItem.mockResolvedValue({
            activeCharacters: testActiveCharacters
        })
        expect(await internalCache.get({ category: 'RoomCharacterList', key: 'ROOM#1234' })).toEqual(testActiveCharacters)
        expect(ephemeraMock.getItem).toHaveBeenCalledTimes(1)
        expect(await internalCache.get({ category: 'RoomCharacterList', key: 'ROOM#1234' })).toEqual(testActiveCharacters)
        expect(ephemeraMock.getItem).toHaveBeenCalledTimes(1)
        
    })

})