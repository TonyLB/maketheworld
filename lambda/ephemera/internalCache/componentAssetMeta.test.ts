jest.mock('@tonylb/mtw-utilities/ts/dynamoDB/index')
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB/index'

import internalCache from "."
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
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
            AssetId: 'FEATURE#TestOne',
            situations: [{ reference: 'SITUATION#ExampleOne', payload: {} }],
        },
        {
            DataCategory: 'ASSET#Layer',
            AssetId: 'FEATURE#TestOne',
            situations: [{ reference: 'SITUATION#ExampleTwo', payload: {} }],
        }])
        const output = await internalCache.ComponentAssetMeta.getAcrossAssets('FEATURE#TestOne', ['ASSET#Base', 'ASSET#Layer'])
        expect(mapToJSON(output)).toEqual({
            Base: {
                tag: 'Feature',
                universalKey: 'FEATURE#TestOne',
                situations: [{ reference: 'SITUATION#ExampleOne', payload: {} }],
            },
            Layer: {
                tag: 'Feature',
                universalKey: 'FEATURE#TestOne',
                situations: [{ reference: 'SITUATION#ExampleTwo', payload: {} }],
            }
        })
        expect(assetMock.getItems).toHaveBeenCalledTimes(1)
        expect(assetMock.getItems).toHaveBeenCalledWith({
            Keys: [
                { AssetId: 'FEATURE#TestOne', DataCategory: 'ASSET#Base' },
                { AssetId: 'FEATURE#TestOne', DataCategory: 'ASSET#Layer' }
            ],
            getAllFields: true
        })
    })

    it('should send already cached items', async () => {
        internalCache.ComponentAssetMeta.set('FEATURE#TestOne', 'ASSET#Layer', new StandardFeature({
            universalKey: 'FEATURE#TestOne',
            tag: 'Feature',
            situations: [{ reference: { key: 'base', tag: 'Situation' }, payload: {} }],
        }))
        assetMock.getItems.mockResolvedValue([{
            AssetId: 'FEATURE#TestOne',
            DataCategory: 'ASSET#Base',
            situations: [{ reference: { key: 'test', tag: 'Situation' }, payload: {} }],
            tag: 'Feature',
        }])
        const output = await internalCache.ComponentAssetMeta.getAcrossAssets('FEATURE#TestOne', ['ASSET#Base', 'ASSET#Layer'])
        expect(mapToJSON(output)).toEqual({
            Base: {
                universalKey: 'FEATURE#TestOne',
                tag: 'Feature',
                situations: [{ reference: { key: 'test', tag: 'Situation' }, payload: {} }],
            },
            Layer: {
                universalKey: 'FEATURE#TestOne',
                tag: 'Feature',
                situations: [{ reference: { key: 'base', tag: 'Situation' }, payload: {} }],
            },
        })
        expect(assetMock.getItems).toHaveBeenCalledTimes(1)
        expect(assetMock.getItems).toHaveBeenCalledWith({
            Keys: [
                { AssetId: 'FEATURE#TestOne', DataCategory: 'ASSET#Base' }
            ],
            getAllFields: true
        })
    })

    it('should default fetches that do not return', async () => {
        assetMock.getItems.mockResolvedValue([{
            DataCategory: 'ASSET#Base',
            situations: [{ reference: { key: 'test', tag: 'Situation' }, payload: {} }],
            AssetId: 'FEATURE#TestOne'
        }])
        const output = await internalCache.ComponentAssetMeta.getAcrossAssets('FEATURE#TestOne', ['ASSET#Base', 'ASSET#Layer'])
        expect(mapToJSON(output)).toEqual({
            Base: {
                tag: 'Feature',
                universalKey: 'FEATURE#TestOne',
                situations: [{ reference: { key: 'test', tag: 'Situation' }, payload: {} }],
            },
            Layer: {
                universalKey: 'FEATURE#TestOne',
                tag: 'Feature'
            }
        })
        expect(assetMock.getItems).toHaveBeenCalledTimes(1)
        expect(assetMock.getItems).toHaveBeenCalledWith({
            Keys: [
                { AssetId: 'FEATURE#TestOne', DataCategory: 'ASSET#Base' },
                { AssetId: 'FEATURE#TestOne', DataCategory: 'ASSET#Layer' }
            ],
            getAllFields: true
        })
    })

    it('should handle invalid DataCategory values gracefully', async () => {
        assetMock.getItems.mockResolvedValue([
            {
                DataCategory: 'ASSET#Base',
                shortName: 'ValidRecord',
                AssetId: 'ROOM#TestOne'
            },
            {
                DataCategory: '',
                shortName: 'shouldBeFiltered',
                AssetId: 'ROOM#TestOne'
            },
            {
                DataCategory: undefined,
                shortName: 'alsoFiltered',
                AssetId: 'ROOM#TestOne'
            },
            {
                DataCategory: 'INVALIDFORMAT',
                shortName: 'stillFiltered',
                AssetId: 'ROOM#TestOne'
            }
        ])

        const output = await internalCache.ComponentAssetMeta.getAcrossAssets('ROOM#TestOne', ['ASSET#Base', 'ASSET#Layer'])
        expect(mapToJSON(output)).toEqual({
            Base: {
                tag: 'Room',
                universalKey: 'ROOM#TestOne',
                shortName: 'ValidRecord'
            },
            Layer: {
                universalKey: 'ROOM#TestOne',
                tag: 'Room'
            }
        })

        expect(assetMock.getItems).toHaveBeenCalledTimes(1)
    })

})
