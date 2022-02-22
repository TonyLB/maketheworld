import { jest, describe, expect, it } from '@jest/globals'
jest.mock('../dynamoDB/index.js')
import { ephemeraDB } from '../dynamoDB/index.js'
import { splitType } from '../types.js'

import dependencyCascade from './dependencyCascade.js'

//
// For testing clarity, this is more of an integration test:  dependencyCascade
// and recalculateComputes are so closely intertwined that it doesn't make much
// sense to attempt to mock recalculateComputes everywhere it would need to
// be mocked.
//
describe('dependencyCascade', () => {
    const testAssetsFactory = ({
        foo = true,
        antiFoo = false,
        layerAFoo = true,
        bar = true,
        antiBar = false,
        fooBar = true,
        layerBFoo = true,
        baz = true,
        antiBaz = false,
        fooBaz = true,
    } = {}) => ({
        BASE: {
            State: {
                foo: { value: foo },
                antiFoo: { computed: true, src: '!foo', value: antiFoo }
            },
            Dependencies: {
                foo: {
                    computed: ['antiFoo'],
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
        },
        LayerA: {
            State: {
                bar: { value: bar },
                foo: { imported: true, value: layerAFoo, asset: 'BASE', key: 'foo' },
                antiBar: { computed: true, src: '!bar', value: antiBar },
                fooBar: { computed: true, src: 'foo && bar', value: fooBar }
            },
            Dependencies: {
                bar: {
                    computed: ['antiBar', 'fooBar']
                },
                foo: {
                    computed: ['fooBar']
                },
                fooBar: {
                    imported: [{
                        asset: 'MixLayerA',
                        key: 'fooBar'
                    }]
                }
            },
            importTree: {
                BASE: {},
                Irrelevant: {}
            }
        },
        LayerB: {
            State: {
                baz: { value: baz },
                foo: { imported: true, value: layerBFoo, asset: 'BASE', key: 'foo' },
                antiBaz: { computed: true, src: '!baz', value: antiBaz },
                fooBaz: { computed: true, src: 'foo || baz', value: fooBaz }
            },
            Dependencies: {
                bar: {
                    computed: ['antiBaz', 'fooBaz']
                },
                foo: {
                    computed: ['fooBaz']
                },
                fooBaz: {
                    imported: [{
                        asset: 'MixLayerB',
                        key: 'fooBaz'
                    }]
                }
            },
            importTree: {
                BASE: {}
            }
        },
        MixLayerA: {
            State: {
                fooBar: { imported: true, value: fooBar, asset: 'LayerA', key: 'fooBar' }
            },
            Dependencies: {},
            importTree: {
                LayerA: {
                    BASE: {},
                    Irrelevant: {}
                }
            }
        },
        MixLayerB: {
            State: {
                fooBaz: { imported: true, value: fooBaz, asset: 'LayerB', key: 'fooBaz' }
            },
            Dependencies: {},
            ImportTree: {
                LayerB: { BASE: {} }
            }
        }
    })

    const resultStateFactory = ({ exclude, ...props }) => (
        Object.entries(testAssetsFactory(props))
            .filter(([key]) => (!(exclude.includes(key))))
            .reduce((previous, [key, { State }]) => ({ ...previous, [key]: State }), {})
    )

    const testMockImplementation = (testAssets) => ({ Items }) => {
        return Items.map(({ EphemeraId }) => ({
            EphemeraId,
            ...testAssets[splitType(EphemeraId)[1]]
        }))
    }

    it('should return unchanged state on empty recalculate seed', async () => {
        const testAssets = testAssetsFactory()
        ephemeraDB.batchGetItem.mockImplementation(testMockImplementation(testAssets))
        const output = await dependencyCascade(
            { BASE: testAssets.BASE },
            { BASE: [] }
        )
        expect(output).toEqual({
            states: { BASE: testAssets.BASE.State },
            recalculated: { BASE: [] }
        })
    })

    it('should update an end-to-end cascade', async () => {
        const testAssets = testAssetsFactory({ foo: false })
        ephemeraDB.batchGetItem.mockImplementation(testMockImplementation(testAssets))
        const output = await dependencyCascade(
            { BASE: testAssets.BASE },
            { BASE: ['foo'] }
        )
        expect(output).toEqual({
            states: resultStateFactory({
                foo: false,
                antiFoo: true,
                layerAFoo: false,
                layerBFoo: false,
                fooBar: false,
                exclude: ['MixLayerB']
            }),
            recalculated: {
                BASE: ['foo', 'antiFoo'],
                LayerA: ['foo', 'fooBar'],
                LayerB: ['foo'],
                MixLayerA: ['fooBar']
            }
        })
    })

    it('should update a partial cascade', async () => {
        const testAssets = testAssetsFactory({ bar: false })
        ephemeraDB.batchGetItem.mockImplementation(testMockImplementation(testAssets))
        const output = await dependencyCascade(
            { LayerA: testAssets.LayerA },
            { LayerA: ['bar'] }
        )
        expect(output).toEqual({
            states: resultStateFactory({
                bar: false,
                antiBar: true,
                fooBar: false,
                exclude: ['BASE', 'LayerB', 'MixLayerB']
            }),
            recalculated: {
                LayerA: ['bar', 'antiBar', 'fooBar'],
                MixLayerA: ['fooBar']
            }
        })
    })

})