import { decacheAsset } from './decacheAsset'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    assetDB: {
        deleteItem: jest.fn(),
        query: jest.fn(),
        optimisticUpdate: jest.fn()
    }
}))

const assetDBMock = jest.mocked(assetDB, { shallow: false })

// Mock streamEvent function
const mockStreamEvent = jest.fn()

describe('Decache Asset (Data Source)', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockStreamEvent.mockResolvedValue(undefined)
    })

    it('should remove all components associated with an asset', async () => {
        // Mock query to return components
        assetDBMock.query.mockResolvedValue([
            { AssetId: 'ROOM#VORTEX', DataCategory: 'ASSET#Test' },
            { AssetId: 'KNOWLEDGE#knowledgeRoot', DataCategory: 'ASSET#Test' }
        ])

        await decacheAsset({ assetId: 'Test', streamEvent: mockStreamEvent })

        // Should call deleteItem for each component
        expect(assetDBMock.deleteItem).toHaveBeenCalledTimes(2)
        expect(assetDBMock.deleteItem).toHaveBeenCalledWith({
            AssetId: 'ROOM#VORTEX',
            DataCategory: 'ASSET#Test'
        })
        expect(assetDBMock.deleteItem).toHaveBeenCalledWith({
            AssetId: 'KNOWLEDGE#knowledgeRoot',
            DataCategory: 'ASSET#Test'
        })

        // Should call optimisticUpdate for each component to remove from cached lists
        expect(assetDBMock.optimisticUpdate).toHaveBeenCalledTimes(2)

        // Should emit Component Removed streaming events for each component
        expect(mockStreamEvent).toHaveBeenCalledWith({
            update: {
                type: 'Component Removed',
                assetId: 'Test',
                componentId: 'ROOM#VORTEX'
            },
            streamKey: 'Test',
            detailType: 'Component Removed'
        })
        expect(mockStreamEvent).toHaveBeenCalledWith({
            update: {
                type: 'Component Removed',
                assetId: 'Test',
                componentId: 'KNOWLEDGE#knowledgeRoot'
            },
            streamKey: 'Test',
            detailType: 'Component Removed'
        })
    })

    it('should filter out non-ephemera components', async () => {
        // Mock query to return mix of ephemera and non-ephemera components
        assetDBMock.query.mockResolvedValue([
            { AssetId: 'ROOM#VORTEX', DataCategory: 'ASSET#Test' }, // Ephemera component
            { AssetId: 'NONEPHEMERA#123', DataCategory: 'ASSET#Test' } // Non-ephemera component
        ])

        await decacheAsset({ assetId: 'Test', streamEvent: mockStreamEvent })

        // Should only call deleteItem for ephemera components
        expect(assetDBMock.deleteItem).toHaveBeenCalledTimes(1)
        expect(assetDBMock.deleteItem).toHaveBeenCalledWith({
            AssetId: 'ROOM#VORTEX',
            DataCategory: 'ASSET#Test'
        })

        // Should only call optimisticUpdate for ephemera components
        expect(assetDBMock.optimisticUpdate).toHaveBeenCalledTimes(1)

        // Should only emit Component Removed event for ephemera components
        expect(mockStreamEvent).toHaveBeenCalledTimes(1)
        expect(mockStreamEvent).toHaveBeenCalledWith({
            update: {
                type: 'Component Removed',
                assetId: 'Test',
                componentId: 'ROOM#VORTEX'
            },
            streamKey: 'Test',
            detailType: 'Component Removed'
        })
    })

    it('should handle empty component list', async () => {
        // Mock query to return empty list
        assetDBMock.query.mockResolvedValue([])

        await decacheAsset({ assetId: 'Test', streamEvent: mockStreamEvent })

        // Should not call any database operations
        expect(assetDBMock.deleteItem).not.toHaveBeenCalled()
        expect(assetDBMock.optimisticUpdate).not.toHaveBeenCalled()

        // Should not emit any streaming events
        expect(mockStreamEvent).not.toHaveBeenCalled()
    })

    it('should update component metadata to remove asset from cached lists', async () => {
        // Mock query to return components
        assetDBMock.query.mockResolvedValue([
            { AssetId: 'ROOM#VORTEX', DataCategory: 'ASSET#Test' }
        ])

        await decacheAsset({ assetId: 'Test', streamEvent: mockStreamEvent })

        // Should call optimisticUpdate to remove asset from cached list
        expect(assetDBMock.optimisticUpdate).toHaveBeenCalledWith({
            Key: {
                AssetId: 'ROOM#VORTEX',
                DataCategory: 'Meta::Room'
            },
            updateKeys: ['cached'],
            updateReducer: expect.any(Function),
            deleteCondition: expect.any(Function)
        })
    })

    it('should handle asset ID with ASSET# prefix', async () => {
        // Mock query to return components
        assetDBMock.query.mockResolvedValue([
            { AssetId: 'ROOM#VORTEX', DataCategory: 'ASSET#TestAsset' }
        ])

        await decacheAsset({ assetId: 'ASSET#TestAsset', streamEvent: mockStreamEvent })

        // Should call query with correct DataCategory
        expect(assetDBMock.query).toHaveBeenCalledWith({
            Key: { DataCategory: 'ASSET#ASSET#TestAsset' },
            IndexName: "DataCategoryIndex"
        })
    })
})
