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
            }
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
                }
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
                }
            }
        },
        MixLayerA: {
            State: {
                fooBar: { imported: true, value: fooBar, asset: 'LayerA', key: 'fooBar' }
            },
            Dependencies: {}
        },
        MixLayerB: {
            State: {
                fooBaz: { imported: true, value: fooBaz, asset: 'LayerB', key: 'fooBaz' }
            },
            Dependencies: {}
        }
    })

    const testMockImplementation = (testAssets) => ({ Items }) => {
        return Items.map(({ EphemeraId }) => (testAssets[splitType(EphemeraId)[1]]))
    }

    xit('should return unchanged state on empty recalculate seed', () => {
        const testAssets = testAssetsFactory()
        ephemeraDB.batchGetItem.mockImplementation(testMockImplementation(testAssets))
        expect(dependencyCascade(
            { BASE: testAssets.BASE },
            { BASE: [] }
        )).toEqual({
            states: { BASE: testAssets.BASE },
            recalculate: { BASE: [] }
        })
    })
})