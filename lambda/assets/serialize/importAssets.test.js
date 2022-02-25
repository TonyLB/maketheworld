import { jest, describe, it, expect } from '@jest/globals'

import { assetDB } from '/opt/utilities/dynamoDB/index.js'

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
            VORTEX: { asset: 'BASE', scopedId: 'VORTEX' },
            Welcome: { asset: 'BASE', scopedId: 'Welcome' }
        })
        expect(output).toEqual({
            scopeMap: {
                VORTEX: 'VORTEX',
                Welcome: '12345'
            },
            importTree: {
                BASE: {
                    type: 'Asset',
                    tree: {}
                }
            }
        })
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
                            BASE: {
                                type: 'Asset',
                                tree: {}
                            }
                        }
                    }
                case 'ASSET#BASE': return {
                        importTree: {}
                    }
            }
        })
        const output = await importedAssetIds({
            VORTEX: { asset: 'BASE', scopedId: 'VORTEX' },
            Welcome: { asset: 'LayerA', scopedId: 'Welcome' }
        })
        expect(output).toEqual({
            scopeMap: {
                VORTEX: 'VORTEX',
                Welcome: '12345'
            },
            importTree: {
                BASE: {
                    type: 'Asset',
                    tree: {}
                },
                LayerA: {
                    type: 'Asset',
                    tree: {
                        BASE: {
                            type: 'Asset',
                            tree: {}
                        }
                    }
                }
            }
        })
    })

})

describe('assetIdsFromTree', () => {
    it('should return empty list from empty tree', () => {
        expect(assetIdsFromTree({})).toEqual([])
    })

    it('should parse a nested tree', () => {
        expect(assetIdsFromTree({
            MixedLayerA: {
                type: 'Asset',
                tree: {
                    LayerA: {
                        type: 'Asset',
                        tree: {
                            BASE: {
                                type: 'Asset',
                                tree: {}
                            }
                        }
                    },
                    LayerB: {
                        type: 'Asset',
                        tree: {
                            BASE: {
                                type: 'Asset',
                                tree: {}
                            }
                        }
                    }
                }
            }
        })).toEqual([
            { key: 'MixedLayerA', type: 'Asset' },
            { key: 'LayerA', type: 'Asset' },
            { key: 'BASE', type: 'Asset' },
            { key: 'LayerB', type: 'Asset' }
        ])
    })
})