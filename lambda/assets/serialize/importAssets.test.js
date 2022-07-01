import { jest, describe, it, expect } from '@jest/globals'

jest.mock('@tonylb/mtw-utilities/dist/dynamoDB/index')
import { assetDB } from '@tonylb/mtw-utilities/dist/dynamoDB/index'

import { importedAssetIds, assetIdsFromTree } from './importedAssets'

describe('importedAssetIds', () => {
    it('should return scopedIds and aggregate of import trees for dependencies', async () => {
        assetDB.query.mockImplementation(async ({ scopedId }) => {
            switch(scopedId) {
                case 'VORTEX': return [{ AssetId: 'ROOM#VORTEX' }]
                case 'Welcome': return [{ AssetId: 'ROOM#12345' }]
            }
        })
        assetDB.getItem.mockResolvedValue({
            importTree: {}
        })
        const output = await importedAssetIds({
            VORTEX: { asset: 'BASE', scopedId: { key: 'VORTEX' } },
            Welcome: { asset: 'BASE', scopedId: { key: 'Welcome' } }
        })
        expect(output).toMatchSnapshot()
    })

    it('should nest import trees of dependencies', async () => {
        assetDB.query.mockImplementation(async ({ scopedId }) => {
            switch(scopedId) {
                case 'VORTEX': return [{ AssetId: 'ROOM#VORTEX' }]
                case 'Welcome': return [{ AssetId: 'ROOM#12345' }]
            }
        })
        assetDB.getItem.mockImplementation(async ({ AssetId }) => {
            switch(AssetId) {
                case 'ASSET#LayerA': 
                    return {
                        importTree: {
                            BASE: {}
                        }
                    }
                case 'ASSET#BASE': return {
                        importTree: {}
                    }
            }
        })
        const output = await importedAssetIds({
            VORTEX: { asset: 'BASE', scopedId: { key: 'VORTEX' } },
            Welcome: { asset: 'LayerA', scopedId: { key: 'Welcome' } }
        })
        expect(output).toMatchSnapshot()
    })

})

describe('assetIdsFromTree', () => {
    it('should return empty list from empty tree', () => {
        expect(assetIdsFromTree({})).toEqual([])
    })

    it('should parse a nested tree', () => {
        expect(assetIdsFromTree({
            MixedLayerA: {
                LayerA: {
                    BASE: {}
                },
                LayerB: {
                    BASE: {}
                }
            }
        })).toEqual([
            'MixedLayerA',
            'LayerA',
            'BASE',
            'LayerB'
        ])
    })
})