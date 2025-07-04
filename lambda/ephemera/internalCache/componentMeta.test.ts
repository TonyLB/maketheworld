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

describe('ComponentMeta', () => {
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
        const output = await internalCache.ComponentMeta.getAcrossAssets('ROOM#TestOne', ['ASSET#Base', 'ASSET#Layer'])
        expect(mapToJSON(output)).toEqual({
            Base: {
                tag: 'Room',
                universalKey: 'ROOM#TestOne',
                examples: ['EXAMPLE#ExampleOne'],
                exits: []
            },
            Layer: {
                tag: 'Room',
                universalKey: 'ROOM#TestOne',
                examples: ['EXAMPLE#ExampleTwo'],
                exits: []
            }
        })
        expect(assetMock.getItems).toHaveBeenCalledTimes(1)
        expect(assetMock.getItems).toHaveBeenCalledWith({
            Keys: [
                { AssetId: 'ROOM#TestOne', DataCategory: 'ASSET#Base' },
                { AssetId: 'ROOM#TestOne', DataCategory: 'ASSET#Layer' }
            ]
        })
    })

    it('should send already cached items', async () => {
        internalCache.ComponentMeta.set('ROOM#TestOne', 'ASSET#Layer', new StandardRoom({
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
        const output = await internalCache.ComponentMeta.getAcrossAssets('ROOM#TestOne', ['ASSET#Base', 'ASSET#Layer'])
        expect(mapToJSON(output)).toEqual({
            Base: {
                universalKey: 'ROOM#TestOne',
                tag: 'Room',
                examples: [{ key: 'test', tag: 'Example' }],
                exits: [],
            },
            Layer: {
                universalKey: 'ROOM#TestOne',
                tag: 'Room',
                examples: [{ key: 'base', tag: 'Example' }],
                exits: [],
            }
        })
        expect(assetMock.getItems).toHaveBeenCalledTimes(1)
        expect(assetMock.getItems).toHaveBeenCalledWith({
            Keys: [
                { AssetId: 'ROOM#TestOne', DataCategory: 'ASSET#Base' }
            ]
        })
    })

    it('should default fetches that do not return', async () => {
        assetMock.getItems.mockResolvedValue([{
            DataCategory: 'ASSET#Base',
            examples: [{ key: 'test', tag: 'Example' }],
            exits: [],
            AssetId: 'ROOM#TestOne'
        }])
        const output = await internalCache.ComponentMeta.getAcrossAssets('ROOM#TestOne', ['ASSET#Base', 'ASSET#Layer'])
        expect(mapToJSON(output)).toEqual({
            Base: {
                tag: 'Room',
                universalKey: 'ROOM#TestOne',
                examples: [{ key: 'test', tag: 'Example' }],
                exits: [],
            },
            Layer: {
                universalKey: 'ROOM#TestOne',
                tag: 'Room',
                exits: [],
            }
        })
        expect(assetMock.getItems).toHaveBeenCalledTimes(1)
        expect(assetMock.getItems).toHaveBeenCalledWith({
            Keys: [
                { AssetId: 'ROOM#TestOne', DataCategory: 'ASSET#Base' },
                { AssetId: 'ROOM#TestOne', DataCategory: 'ASSET#Layer' }
            ]
        })
    })

})
