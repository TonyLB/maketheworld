import { jest, describe, it, expect } from '@jest/globals'

jest.mock('../dynamoDB/index.js')
import { ephemeraDB } from '../dynamoDB/index.js'
jest.mock('../perception/assetRender.js')
import { assetRender } from '../perception/assetRender.js'
import { testAssetsFactory, resultStateFactory, testMockImplementation } from './testAssets.js'

import updateAssets from './updateAssets.js'

describe('updateAssets', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
    })

    it('should update single state when passed', async () => {
        const testAssets = testAssetsFactory()
        await updateAssets({
            newStates: { BASE: testAssets.BASE },
            recalculated: { BASE: [] }
        })
        expect(assetRender).toHaveBeenCalledTimes(0)
        expect(ephemeraDB.update).toHaveBeenCalledTimes(1)
        expect(ephemeraDB.update).toHaveBeenCalledWith({
            EphemeraId: 'ASSET#BASE',
            DataCategory: 'Meta::Asset',
            UpdateExpression: 'SET #state = :state',
            ExpressionAttributeNames: {
                ['#state']: 'State'
            },
            ExpressionAttributeValues: {
                [':state']: {
                    foo: { value: true },
                    antiFoo: {
                        computed: true,
                        src: '!foo',
                        value: false
                    }
                }
            }
        })
    })

    it('should update entire cascade when passed', async () => {
        const cascadedAssets = testAssetsFactory({
            foo: false,
            antiFoo: true,
            layerAFoo: false,
            layerBFoo: false,
            fooBar: false,
            exclude: ['MixLayerB']
        })
        await updateAssets({
            newStates: cascadedAssets,
            recalculated: {
                BASE: ['foo', 'antiFoo'],
                LayerA: ['foo', 'fooBar'],
                LayerB: ['foo'],
                MixLayerA: ['fooBar']
            }
        })
        expect(assetRender).toHaveBeenCalledTimes(0)
        expect(ephemeraDB.update).toHaveBeenCalledTimes(4)
        expect(ephemeraDB.update).toHaveBeenCalledWith({
            EphemeraId: 'ASSET#BASE',
            DataCategory: 'Meta::Asset',
            UpdateExpression: 'SET #state = :state',
            ExpressionAttributeNames: {
                ['#state']: 'State'
            },
            ExpressionAttributeValues: {
                [':state']: {
                    foo: { value: false },
                    antiFoo: {
                        computed: true,
                        src: '!foo',
                        value: true
                    }
                }
            }
        })
        expect(ephemeraDB.update).toHaveBeenCalledWith({
            EphemeraId: 'ASSET#LayerA',
            DataCategory: 'Meta::Asset',
            UpdateExpression: 'SET #state = :state',
            ExpressionAttributeNames: {
                ['#state']: 'State'
            },
            ExpressionAttributeValues: {
                [':state']: {
                    foo: {
                        imported: true,
                        asset: 'BASE',
                        key: 'foo',
                        value: false
                    },
                    bar: { value: true },
                    antiBar: {
                        computed: true,
                        src: '!bar',
                        value: false
                    },
                    fooBar: {
                        computed: true,
                        src: 'foo && bar',
                        value: false
                    }
                }
            }
        })
        expect(ephemeraDB.update).toHaveBeenCalledWith({
            EphemeraId: 'ASSET#LayerB',
            DataCategory: 'Meta::Asset',
            UpdateExpression: 'SET #state = :state',
            ExpressionAttributeNames: {
                ['#state']: 'State'
            },
            ExpressionAttributeValues: {
                [':state']: {
                    foo: {
                        imported: true,
                        asset: 'BASE',
                        key: 'foo',
                        value: false
                    },
                    baz: { value: true },
                    antiBaz: {
                        computed: true,
                        src: '!baz',
                        value: false
                    },
                    fooBaz: {
                        computed: true,
                        src: 'foo || baz',
                        value: true
                    }
                }
            }
        })
        expect(ephemeraDB.update).toHaveBeenCalledWith({
            EphemeraId: 'ASSET#MixLayerA',
            DataCategory: 'Meta::Asset',
            UpdateExpression: 'SET #state = :state',
            ExpressionAttributeNames: {
                ['#state']: 'State'
            },
            ExpressionAttributeValues: {
                [':state']: {
                    fooBar: {
                        imported: true,
                        asset: 'LayerA',
                        key: 'fooBar',
                        value: false
                    }
                }
            }
        })
    })

    it('should rerender mapCache when needed', async () => {
        const testRender = {
            Vortex: {
                EphemeraId: 'ROOM#VORTEX',
                name: ['Vortex'],
                exits: []
            },
        }
        assetRender.mockResolvedValue(testRender)
        const mapCacheAssets = {
            BASE: {
                State: {
                    foo: { value: false },
                    antiFoo: { computed: true, src: '!foo', value: true }
                },
                Dependencies: {
                    foo: {
                        computed: ['antiFoo'],
                        room: ['VORTEX'],
                        mapCache: ['VORTEX'],
                        imported: [{
                            asset: 'LayerA',
                            key: 'foo'
                        },
                        {
                            asset: 'LayerB',
                            key: 'foo'
                        }]
                    }
                },
                importTree: {}
            }
        }
        await updateAssets({
            newStates: mapCacheAssets,
            recalculated: { BASE: ['foo'] }
        })
        expect(assetRender).toHaveBeenCalledTimes(1)
        expect(assetRender).toHaveBeenCalledWith({
            assetId: 'BASE',
            existingStatesByAsset: mapCacheAssets
        })
        expect(ephemeraDB.update).toHaveBeenCalledTimes(1)
        expect(ephemeraDB.update).toHaveBeenCalledWith({
            EphemeraId: 'ASSET#BASE',
            DataCategory: 'Meta::Asset',
            UpdateExpression: 'SET #state = :state, mapCache = :mapCache',
            ExpressionAttributeNames: {
                ['#state']: 'State'
            },
            ExpressionAttributeValues: {
                [':state']: mapCacheAssets.BASE.State,
                [':mapCache']: testRender
            }
        })
    })

    it('should not rerender mapCache when a non-mapCache variable is updated', async () => {
        const mapCacheAssets = {
            BASE: {
                State: {
                    foo: { value: false },
                    bar: { value: true }
                },
                Dependencies: {
                    foo: {
                        room: ['VORTEX'],
                        mapCache: ['VORTEX'],
                    }
                },
                importTree: {}
            }
        }
        await updateAssets({
            newStates: mapCacheAssets,
            recalculated: { BASE: ['bar'] }
        })
        expect(assetRender).toHaveBeenCalledTimes(0)
        expect(ephemeraDB.update).toHaveBeenCalledTimes(1)
        expect(ephemeraDB.update).toHaveBeenCalledWith({
            EphemeraId: 'ASSET#BASE',
            DataCategory: 'Meta::Asset',
            UpdateExpression: 'SET #state = :state',
            ExpressionAttributeNames: {
                ['#state']: 'State'
            },
            ExpressionAttributeValues: {
                [':state']: mapCacheAssets.BASE.State,
            }
        })
    })

})