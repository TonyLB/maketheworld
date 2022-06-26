import { splitType } from '../types.ts'

export const testAssetsFactory = ({
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
    exclude = []
} = {}) => {
    const baseAssets = {
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
                    computed: ['antiBar', 'fooBar'],
                    room: ['QRS']
                },
                foo: {
                    computed: ['fooBar']
                },
                fooBar: {
                    imported: [{
                        asset: 'MixLayerA',
                        key: 'fooBar'
                    }],
                    room: ['MNO']
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
                baz: {
                    computed: ['antiBaz', 'fooBaz'],
                    room: ['QRS']
                },
                foo: {
                    computed: ['fooBaz']
                },
                fooBaz: {
                    imported: [{
                        asset: 'MixLayerB',
                        key: 'fooBaz'
                    }],
                    room: ['MNO']
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
    }
    return Object.entries(baseAssets)
        .filter(([key]) => (!(exclude.includes(key))))
        .reduce((previous, [key, value]) => ({ ...previous, [key]: value }), {})
}

export const resultStateFactory = (props) => (
    Object.entries(testAssetsFactory(props))
        .reduce((previous, [key, { State }]) => ({ ...previous, [key]: State }), {})
)

export const testMockImplementation = (testAssets, { type = 'batchGetItem' } = {}) => (props) => {
    switch(type) {
        case 'batchGetItem':
            const { Items } = props
            return Items.map(({ EphemeraId }) => ({
                EphemeraId,
                ...testAssets[splitType(EphemeraId)[1]]
            }))
        case 'getItem':
            const { EphemeraId } = props
            return testAssets[splitType(EphemeraId)[1]]
    }
}