jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')

import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { deleteCacheRecord } from './deleteCacheRecord'

const ephemeraDBMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>

const componentId = 'ROOM#test-room-uuid' as const

describe('dataSource/renderCache/deleteCacheRecord', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('calls deleteItem with EphemeraId and DataCategory', async () => {
        ephemeraDBMock.deleteItem.mockResolvedValue(undefined)

        await deleteCacheRecord(componentId, 'CACHE#some-uuid')

        expect(ephemeraDBMock.deleteItem).toHaveBeenCalledTimes(1)
        expect(ephemeraDBMock.deleteItem).toHaveBeenCalledWith({
            EphemeraId: componentId,
            DataCategory: 'CACHE#some-uuid'
        })
    })
})
