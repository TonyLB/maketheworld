import { decacheAsset } from './decacheAsset'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import internalCache from '../../internalCache'
import { emitTopologyInvalidatedForRoomTargets } from '../../componentTopology'
import { invalidateExhaustivePartitionCache } from '../components/verticals/exhaustivePartitionLoader'

jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    assetDB: {
        deleteItem: jest.fn(),
        putItem: jest.fn(),
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
        },
        ComponentData: {
            invalidate: jest.fn()
        }
    }
}))

jest.mock('../../componentTopology', () => ({
    emitTopologyInvalidatedForRoomTargets: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../components/verticals/exhaustivePartitionLoader', () => ({
    invalidateExhaustivePartitionCache: jest.fn(),
}))

const assetDBMock = jest.mocked(assetDB, { shallow: false })
const internalCacheMock = jest.mocked(internalCache, { shallow: false })
const emitTopologyInvalidatedForRoomTargetsMock = jest.mocked(emitTopologyInvalidatedForRoomTargets, { shallow: false })
const invalidateExhaustivePartitionCacheMock = jest.mocked(invalidateExhaustivePartitionCache, { shallow: false })

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

        // Should emit Component Updated and Component Removed events for each component
        const calls = mockStreamEvent.mock.calls.map(([arg]) => arg)
        const updatedCalls = calls.filter((arg) => arg.header?.type === 'Component Updated')
        const removedCalls = calls.filter((arg) => arg.header?.type === 'Component Removed')
        expect(updatedCalls.length).toBe(2)
        expect(removedCalls.length).toBe(2)
        const updatedKeys = updatedCalls.map((arg) => arg.update.component.universalKey)
        const removedKeys = removedCalls.map((arg) => arg.update.component.universalKey)
        expect(updatedKeys).toEqual(expect.arrayContaining(['ROOM#VORTEX', 'KNOWLEDGE#knowledgeRoot']))
        expect(removedKeys).toEqual(expect.arrayContaining(['ROOM#VORTEX', 'KNOWLEDGE#knowledgeRoot']))
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

    describe('single-pass alignment (Phase 4)', () => {
        it('deleteItem for edge-only room stub without putItem recreation', async () => {
            internalCacheMock.AssetData.get.mockResolvedValueOnce([
                {
                    AssetId: 'ASSET#test',
                    standardForm: new StandardForm(deIndentWML(`
                        <Asset uuid=(test)>
                            <Area uuid=(region) key=(region)>
                                <Room uuid=(highway) key=(highway) />
                                <Exit uuid=(e1)>
                                    <From>ROOM#highway</From>
                                    <To>ROOM#outsideRoom</To>
                                    <Forward>east</Forward>
                                    <Back>west</Back>
                                </Exit>
                            </Area>
                        </Asset>
                    `))
                }
            ])

            await decacheAsset({ assetId: 'test', streamEvent: mockStreamEvent })

            expect(assetDBMock.putItem).not.toHaveBeenCalled()
            expect(assetDBMock.deleteItem).toHaveBeenCalledWith({
                AssetId: 'ROOM#outsideRoom',
                DataCategory: 'ASSET#test',
            })
            expect(emitTopologyInvalidatedForRoomTargetsMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    roomIds: expect.arrayContaining(['ROOM#outsideRoom', 'ROOM#highway']),
                    editAssetId: 'ASSET#test',
                })
            )
        })

        it('invalidates ComponentData and exhaustive partition cache for diff components', async () => {
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

            expect(internalCacheMock.ComponentData.invalidate).toHaveBeenCalledWith('ROOM#VORTEX', 'ASSET#Test')
            expect(internalCacheMock.ComponentData.invalidate).toHaveBeenCalledWith('KNOWLEDGE#knowledgeRoot', 'ASSET#Test')
            expect(invalidateExhaustivePartitionCacheMock).toHaveBeenCalledWith('ROOM#VORTEX')
            expect(invalidateExhaustivePartitionCacheMock).toHaveBeenCalledWith('KNOWLEDGE#knowledgeRoot')
        })

        it('emits Component Removed only for branch-C removals', async () => {
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

            const calls = mockStreamEvent.mock.calls.map(([arg]) => arg)
            const updatedCalls = calls.filter((arg) => arg.header?.type === 'Component Updated')
            const removedCalls = calls.filter((arg) => arg.header?.type === 'Component Removed')
            expect(updatedCalls.length).toBe(1)
            expect(removedCalls.length).toBe(1)
            expect(updatedCalls[0].update.component.universalKey).toBe('ROOM#VORTEX')
            expect(removedCalls[0].update.component.universalKey).toBe('ROOM#VORTEX')
        })
    })
})
