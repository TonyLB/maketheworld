jest.mock('@tonylb/mtw-utilities/ts/dynamoDB/index')
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB/index'

import internalCache from "."
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import { StandardComponentData } from '@tonylb/mtw-wml/ts/standardize/baseClasses'
import { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'

const assetMock = assetDB as jest.Mocked<typeof assetDB>

const mapToJSON = (data: Record<AssetUUID, StandardComponent>): Record<string, StandardComponentData> => {
    return Object.fromEntries(
        Object.entries(data).map(([assetId, component]) => {
            return [assetId.split('#')[1], component.toJSON()]
        })
    )
}

describe('ComponentAssetMeta', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCache.clear()
    })

    it('should send multiple fetches correctly', async () => {
        assetMock.getItems.mockResolvedValue([{
            DataCategory: 'ASSET#Base',
            AssetId: 'ROOM#TestOne',
            examples: ['EXAMPLE#ExampleOne'],
            exits: []
        },
        {
            DataCategory: 'ASSET#Layer',
            AssetId: 'ROOM#TestOne',
            examples: ['EXAMPLE#ExampleTwo'],
            exits: []
        }])
        const output = await internalCache.ComponentAssetMeta.getAcrossAssets('ROOM#TestOne', ['ASSET#Base', 'ASSET#Layer'])
        expect(mapToJSON(output)).toEqual({
            Base: {
                tag: 'Room',
                universalKey: 'ROOM#TestOne',
                examples: ['EXAMPLE#ExampleOne']
            },
            Layer: {
                tag: 'Room',
                universalKey: 'ROOM#TestOne',
                examples: ['EXAMPLE#ExampleTwo']
            }
        })
        expect(assetMock.getItems).toHaveBeenCalledTimes(1)
        expect(assetMock.getItems).toHaveBeenCalledWith({
            Keys: [
                { AssetId: 'ROOM#TestOne', DataCategory: 'ASSET#Base' },
                { AssetId: 'ROOM#TestOne', DataCategory: 'ASSET#Layer' }
            ],
            getAllFields: true
        })
    })

    it('should send already cached items', async () => {
        internalCache.ComponentAssetMeta.set('ROOM#TestOne', 'ASSET#Layer', new StandardRoom({
            universalKey: 'ROOM#TestOne',
            tag: 'Room',
            examples: [{ key: 'base', tag: 'Example' }],
            exits: [],
        }))
        assetMock.getItems.mockResolvedValue([{
            AssetId: 'ROOM#TestOne',
            DataCategory: 'ASSET#Base',
            examples: [{ key: 'test', tag: 'Example' }],
            tag: 'Room',
            exits: []
        }])
        const output = await internalCache.ComponentAssetMeta.getAcrossAssets('ROOM#TestOne', ['ASSET#Base', 'ASSET#Layer'])
        expect(mapToJSON(output)).toEqual({
            Base: {
                universalKey: 'ROOM#TestOne',
                tag: 'Room',
                examples: [{ key: 'test', tag: 'Example' }]
            },
            Layer: {
                universalKey: 'ROOM#TestOne',
                tag: 'Room',
                examples: [{ key: 'base', tag: 'Example' }]
            }
        })
        expect(assetMock.getItems).toHaveBeenCalledTimes(1)
        expect(assetMock.getItems).toHaveBeenCalledWith({
            Keys: [
                { AssetId: 'ROOM#TestOne', DataCategory: 'ASSET#Base' }
            ],
            getAllFields: true
        })
    })

    it('should default fetches that do not return', async () => {
        assetMock.getItems.mockResolvedValue([{
            DataCategory: 'ASSET#Base',
            examples: [{ key: 'test', tag: 'Example' }],
            exits: [],
            AssetId: 'ROOM#TestOne'
        }])
        const output = await internalCache.ComponentAssetMeta.getAcrossAssets('ROOM#TestOne', ['ASSET#Base', 'ASSET#Layer'])
        expect(mapToJSON(output)).toEqual({
            Base: {
                tag: 'Room',
                universalKey: 'ROOM#TestOne',
                examples: [{ key: 'test', tag: 'Example' }]
            },
            Layer: {
                universalKey: 'ROOM#TestOne',
                tag: 'Room'
            }
        })
        expect(assetMock.getItems).toHaveBeenCalledTimes(1)
        expect(assetMock.getItems).toHaveBeenCalledWith({
            Keys: [
                { AssetId: 'ROOM#TestOne', DataCategory: 'ASSET#Base' },
                { AssetId: 'ROOM#TestOne', DataCategory: 'ASSET#Layer' }
            ],
            getAllFields: true
        })
    })

    it('should handle invalid DataCategory values gracefully', async () => {
        // Simulate bootstrap database scenario with records that have invalid/missing DataCategory
        assetMock.getItems.mockResolvedValue([
            {
                DataCategory: 'ASSET#Base',
                examples: [{ key: 'validRecord', tag: 'Example' }],
                AssetId: 'ROOM#TestOne'
            },
            {
                DataCategory: '', // Empty string - invalid AssetUUID
                examples: [{ key: 'shouldBeFiltered', tag: 'Example' }],
                AssetId: 'ROOM#TestOne'
            },
            {
                DataCategory: undefined, // Missing DataCategory - invalid AssetUUID
                examples: [{ key: 'alsoFiltered', tag: 'Example' }],
                AssetId: 'ROOM#TestOne'
            },
            {
                DataCategory: 'INVALIDFORMAT', // Invalid AssetUUID format
                examples: [{ key: 'stillFiltered', tag: 'Example' }],
                AssetId: 'ROOM#TestOne'
            }
        ])
        
        // Should only return the valid record, filtering out invalid ones
        const output = await internalCache.ComponentAssetMeta.getAcrossAssets('ROOM#TestOne', ['ASSET#Base', 'ASSET#Layer'])
        expect(mapToJSON(output)).toEqual({
            Base: {
                tag: 'Room',
                universalKey: 'ROOM#TestOne',
                examples: [{ key: 'validRecord', tag: 'Example' }]
            },
            Layer: {
                universalKey: 'ROOM#TestOne',
                tag: 'Room'
            }
        })
        
        // Should not crash and should process the request normally
        expect(assetMock.getItems).toHaveBeenCalledTimes(1)
    })

})
