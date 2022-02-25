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
            importTree: {
                assets: {},
                stories: {}
            }
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
                assets: {
                    BASE: {
                        assets: {},
                        stories: {}
                    }    
                },
                stories: {}
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
                            assets: {
                                BASE: {
                                    assets: {},
                                    stories: {}
                                }
                            },
                            stories: {}
                        }
                    }
                case 'ASSET#BASE': return {
                        importTree: {
                            assets: {},
                            stories: {}
                        }
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
                assets: {
                    BASE: {
                        assets: {},
                        stories: {}
                    },
                    LayerA: {
                        assets: {
                            BASE: {
                                assets: {},
                                stories: {}
                            }
                        },
                        stories: {}
                    }
                },
                stories: {}
            }
        })
    })

})

describe('assetIdsFromTree', () => {
    it('should return empty list from empty tree', () => {
        expect(assetIdsFromTree({
            assets: {},
            stories: {}
        })).toEqual([])
    })

    it('should parse a nested tree', () => {
        expect(assetIdsFromTree({
            assets: {
                MixedLayerA: {
                    assets: {
                        LayerA: {
                            assets: {
                                BASE: {
                                    assets: {},
                                    stories: {}
                                }
                            },
                            stories: {}
                        },
                        LayerB: {
                            assets: {
                                BASE: {
                                    assets: {},
                                    stories: {}
                                }
                            },
                            stories: {}
                        }
                    },
                    stories: {}
                }
            },
            stories: {}
        })).toEqual(['MixedLayerA', 'LayerA', 'BASE', 'LayerB'])
    })
})