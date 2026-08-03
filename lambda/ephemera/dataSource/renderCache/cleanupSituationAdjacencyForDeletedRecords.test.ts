jest.mock('../../internalCache', () => ({
    __esModule: true,
    default: {
        RenderCache: {
            getCacheRows: jest.fn(),
            getCatalogRows: jest.fn(),
        },
    },
}))
jest.mock('./situationAdjacency')

import internalCache from '../../internalCache'
import { cleanupSituationAdjacencyForDeletedRecords } from './cleanupSituationAdjacencyForDeletedRecords'
import { deleteAdjacencyForRemovedSlice } from './situationAdjacency'

const getCacheRowsMock = internalCache.RenderCache.getCacheRows as jest.Mock
const getCatalogRowsMock = internalCache.RenderCache.getCatalogRows as jest.Mock
const deleteAdjacencyMock = deleteAdjacencyForRemovedSlice as jest.MockedFunction<
    typeof deleteAdjacencyForRemovedSlice
>

const componentId = 'OBJECT#anvil' as const

describe('dataSource/renderCache/cleanupSituationAdjacencyForDeletedRecords', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('deletes the adjacency link for each (situationId, perspectiveKey) pair among the deleted rows', async () => {
        getCacheRowsMock.mockResolvedValue([
            { DataCategory: 'CACHE#one', situationId: 'SITUATION#default' },
            { DataCategory: 'CACHE#two', situationId: undefined },
            { DataCategory: 'CACHE#not-deleted', situationId: 'SITUATION#other' },
        ])
        getCatalogRowsMock.mockResolvedValue([
            { DataCategory: 'Cache::perspective-key' },
            { DataCategory: 'Cache::not-deleted' },
        ])

        await cleanupSituationAdjacencyForDeletedRecords(componentId, [
            'CACHE#one',
            'CACHE#two',
            'Cache::perspective-key',
        ])

        expect(deleteAdjacencyMock).toHaveBeenCalledTimes(1)
        expect(deleteAdjacencyMock).toHaveBeenCalledWith({
            situationId: 'SITUATION#default',
            hostEphemeraId: componentId,
            perspectiveKey: 'perspective-key',
        })
    })

    it('is a no-op when no deleted row carries a situationId', async () => {
        getCacheRowsMock.mockResolvedValue([{ DataCategory: 'CACHE#one', situationId: undefined }])
        getCatalogRowsMock.mockResolvedValue([{ DataCategory: 'Cache::perspective-key' }])

        await cleanupSituationAdjacencyForDeletedRecords(componentId, ['CACHE#one', 'Cache::perspective-key'])

        expect(deleteAdjacencyMock).not.toHaveBeenCalled()
    })

    it('is a no-op when no deleted row is a catalog row', async () => {
        getCacheRowsMock.mockResolvedValue([{ DataCategory: 'CACHE#one', situationId: 'SITUATION#default' }])
        getCatalogRowsMock.mockResolvedValue([{ DataCategory: 'Cache::not-deleted' }])

        await cleanupSituationAdjacencyForDeletedRecords(componentId, ['CACHE#one'])

        expect(deleteAdjacencyMock).not.toHaveBeenCalled()
    })
})
