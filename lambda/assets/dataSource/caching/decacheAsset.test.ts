import { decacheAsset } from './decacheAsset'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import internalCache from '../../internalCache'

jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    assetDB: {
        deleteItem: jest.fn(),
        query: jest.fn(),
        optimisticUpdate: jest.fn()
    }
}))

jest.mock('../../internalCache', () => ({
    __esModule: true,
    default: {
        AssetData: {
            get: jest.fn()
        },
        AssetMetaData: {
            invalidate: jest.fn()
        }
    }
}))

const assetDBMock = jest.mocked(assetDB, { shallow: false })
const internalCacheMock = jest.mocked(internalCache, { shallow: false })

// Mock streamEvent function
const mockStreamEvent = jest.fn()

describe('Decache Asset (Data Source)', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockStreamEvent.mockResolvedValue(undefined)
    })

    it('should remove all components associated with an asset', async () => {
        internalCacheMock.AssetData.get.mockResolvedValueOnce([
            {
                AssetId: 'ASSET#Test',
                standardForm: new StandardForm(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Room key=(VORTEX) uuid=(VORTEX) />
                        <Knowledge key=(knowledgeRoot) uuid=(knowledgeRoot) />
                    </Asset>
                `))
            }
        ])

        await decacheAsset({ assetId: 'Test', streamEvent: mockStreamEvent })

        // Should call deleteItem for each component plus the Meta::Asset record
        expect(assetDBMock.deleteItem).toHaveBeenCalledTimes(3)
        expect(assetDBMock.deleteItem).toHaveBeenCalledWith({
            AssetId: 'ROOM#VORTEX',
            DataCategory: 'ASSET#Test'
        })
        expect(assetDBMock.deleteItem).toHaveBeenCalledWith({
            AssetId: 'KNOWLEDGE#knowledgeRoot',
            DataCategory: 'ASSET#Test'
        })
        expect(assetDBMock.deleteItem).toHaveBeenCalledWith({
            AssetId: 'ASSET#Test',
            DataCategory: 'Meta::Asset'
        })
        expect(internalCacheMock.AssetMetaData.invalidate).toHaveBeenCalledWith('ASSET#Test')

        // Should call optimisticUpdate for each component to remove from cached lists
        expect(assetDBMock.optimisticUpdate).toHaveBeenCalledTimes(2)

        // Should emit Component Updated events with StandardRemove payloads for each component
        const calls = mockStreamEvent.mock.calls.map(([arg]) => arg)
        const updatedCalls = calls.filter((arg) => arg.update.type === 'Component Updated')
        expect(updatedCalls.length).toBe(2)
        const keys = updatedCalls.map((arg) => arg.update.component.universalKey)
        expect(keys).toEqual(expect.arrayContaining(['ROOM#VORTEX', 'KNOWLEDGE#knowledgeRoot']))
    })

    it('should handle empty component list', async () => {
        internalCacheMock.AssetData.get.mockResolvedValueOnce([
            {
                AssetId: 'ASSET#Test',
                standardForm: new StandardForm(deIndentWML(`
                    <Asset uuid=(Test) />
                `))
            }
        ])

        await decacheAsset({ assetId: 'Test', streamEvent: mockStreamEvent })

        // Should only delete the Meta::Asset record (no component-level deletes or updates)
        expect(assetDBMock.deleteItem).toHaveBeenCalledTimes(1)
        expect(assetDBMock.deleteItem).toHaveBeenCalledWith({
            AssetId: 'ASSET#Test',
            DataCategory: 'Meta::Asset'
        })
        expect(internalCacheMock.AssetMetaData.invalidate).toHaveBeenCalledWith('ASSET#Test')
        expect(assetDBMock.optimisticUpdate).not.toHaveBeenCalled()

        // Should not emit any streaming events
        expect(mockStreamEvent).not.toHaveBeenCalled()
    })

    it('should update component metadata to remove asset from cached lists', async () => {
        internalCacheMock.AssetData.get.mockResolvedValueOnce([
            {
                AssetId: 'ASSET#Test',
                standardForm: new StandardForm(deIndentWML(`
                    <Asset uuid=(Test)>
                        <Room key=(VORTEX) uuid=(VORTEX) />
                    </Asset>
                `))
            }
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
        internalCacheMock.AssetData.get.mockResolvedValueOnce([
            {
                AssetId: 'ASSET#TestAsset',
                standardForm: new StandardForm(deIndentWML(`
                    <Asset uuid=(TestAsset)>
                        <Room key=(VORTEX) uuid=(VORTEX) />
                    </Asset>
                `))
            }
        ])

        await decacheAsset({ assetId: 'ASSET#TestAsset', streamEvent: mockStreamEvent })

        // Decache now derives from internal cache diff; query path is no longer used here
        expect(assetDBMock.query).not.toHaveBeenCalled()
    })
})
