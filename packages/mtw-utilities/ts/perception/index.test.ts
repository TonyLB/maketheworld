jest.mock('./dynamoDB')
import { getCharacterAssets, getItemMeta, getStateByAsset, getGlobalAssets } from './dynamoDB'

import { resultStateFactory, testMockImplementation } from '../executeCode/testAssets.js'

import { render } from './index'
import { objectMap } from '../objects'

const mockedGetGlobalAssets = getGlobalAssets as jest.Mock
const mockedGetCharacterAssets = getCharacterAssets as jest.Mock
const mockedGetItemMeta = getItemMeta as jest.Mock
const mockedGetStateByAsset = getStateByAsset as jest.Mock

describe('render', () => {

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        jest.restoreAllMocks()
    })

    it('should return empty on an empty list', async () => {
        mockedGetGlobalAssets.mockResolvedValue([])
        const output = await render({
            renderList: []
        })
        expect(output).toEqual([])
    })

    it('should render with no provided state data', async () => {
        const testAssets = objectMap(
            resultStateFactory(),
            (state: Record<string, { value: any }>) => ({ State: objectMap(state, ({ value }) => value) })
        )
        mockedGetGlobalAssets.mockResolvedValue(['BASE', 'LayerA', 'LayerB', 'MixLayerA', 'MixLayerB'])
        mockedGetStateByAsset.mockImplementation(async (assets) => {
            return assets.reduce((previous, asset) => ({
                ...previous,
                [asset]: testAssets[asset] || {}
            }), {})
        })
        mockedGetItemMeta.mockResolvedValue({
            ['ROOM#MNO']: [
                {
                    DataCategory: 'ASSET#BASE',
                    appearances: [{
                        conditions: [{
                            if: 'foo',
                            dependencies: ['foo']
                        }],
                        render: [{
                            tag: 'String',
                            value: 'Test One. '
                        }],
                        exits: []
                    }]
                }
            ]
        })
        mockedGetCharacterAssets.mockResolvedValue({ QRS: { assets: [] } })
        const output = await render({
            renderList: [{
                EphemeraId: 'ROOM#MNO',
                CharacterId: 'QRS'
            }]
        })
        expect(output).toMatchSnapshot()
        expect(mockedGetStateByAsset).toHaveBeenCalledWith(['BASE'], {})
    })

    it('should render with provided state data', async () => {
        const testAssets = objectMap(
            resultStateFactory(),
            (state: Record<string, { value: any }>) => ({ State: objectMap(state, ({ value }) => value) })
        )
        mockedGetGlobalAssets.mockResolvedValue(['BASE', 'LayerA', 'LayerB', 'MixLayerA', 'MixLayerB'])
        mockedGetStateByAsset.mockImplementation(async (assets) => {
            return assets.reduce((previous, asset) => ({
                ...previous,
                [asset]: testAssets[asset] || {}
            }), {})
        })
        mockedGetItemMeta.mockResolvedValue({
            ['ROOM#MNO']: [
                {
                    DataCategory: 'ASSET#BASE',
                    appearances: [{
                        conditions: [{
                            if: 'foo',
                            dependencies: ['foo']
                        }],
                        render: [{
                            tag: 'String',
                            value: 'Test One. '
                        }],
                        exits: []
                    }]
                }
            ]
        })
        mockedGetCharacterAssets.mockResolvedValue({ QRS: { assets: [] } })
        const output = await render({
                renderList: [{
                    EphemeraId: 'ROOM#MNO',
                    CharacterId: 'QRS'
                }],
                assetMeta: testAssets
        })
        expect(output).toMatchSnapshot()
        expect(mockedGetStateByAsset).toHaveBeenCalledWith(['BASE'], testAssets)

    })

    it('should correctly interpret nested conditions', async () => {
        const testAssets = objectMap(
            resultStateFactory(),
            (state: Record<string, { value: any }>) => ({ State: objectMap(state, ({ value }) => value) })
        )
        mockedGetGlobalAssets.mockResolvedValue(['BASE', 'LayerA', 'LayerB', 'MixLayerA', 'MixLayerB'])
        mockedGetStateByAsset.mockImplementation(async (assets) => {
            return assets.reduce((previous, asset) => ({
                ...previous,
                [asset]: testAssets[asset] || {}
            }), {})
        })
        mockedGetItemMeta.mockResolvedValue({
            ['ROOM#MNO']: [
                {
                    DataCategory: 'ASSET#BASE',
                    appearances: [{
                        conditions: [{
                            if: 'foo',
                            dependencies: ['foo']
                        },
                        {
                            if: '!antiFoo',
                            dependencies: ['antiFoo']
                        }],
                        render: [{
                            tag: 'String',
                            value: 'Should render.'
                        }],
                        exits: []
                    },
                    {
                        conditions: [{
                            if: 'foo',
                            dependencies: ['foo']
                        },
                        {
                            if: 'antiFoo',
                            dependencies: ['antiFoo']
                        }],
                        render: [{
                            tag: 'String',
                            value: 'Should not render.'
                        }],
                        exits: []
                    }]
                }
            ]
        })
        mockedGetCharacterAssets.mockResolvedValue({ QRS: { assets: [] } })
        const output = await render({
                renderList: [{
                    EphemeraId: 'ROOM#MNO',
                    CharacterId: 'QRS'
                }],
                assetMeta: testAssets
        })
        expect(output).toMatchSnapshot()
        expect(mockedGetStateByAsset).toHaveBeenCalledWith(['BASE'], testAssets)

    })

    it('should render spacing around tags', async () => {
        const testAssets = objectMap(
            resultStateFactory(),
            (state: Record<string, { value: any }>) => ({ State: objectMap(state, ({ value }) => value) })
        )
        mockedGetGlobalAssets.mockResolvedValue(['BASE'])
        mockedGetStateByAsset.mockImplementation(async (assets) => {
            return assets.reduce((previous, asset) => ({
                ...previous,
                [asset]: testAssets[asset] || {}
            }), {})
        })
        mockedGetItemMeta.mockResolvedValue({
            ['ROOM#MNO']: [
                {
                    DataCategory: 'ASSET#BASE',
                    appearances: [{
                        render: [{
                            tag: 'String',
                            value: 'Test',
                            spaceAfter: true
                        },
                        {
                            tag: 'Link',
                            key: 'testOne',
                            spaceBefore: true,
                            spaceAfter: true
                        },
                        {
                            tag: 'Link',
                            key: 'testTwo',
                            spaceBefore: true,
                            spaceAfter: false
                        },
                        {
                            tag: 'String',
                            value: '-attached',
                            spaceBefore: false
                        }],
                        exits: []
                    }]
                }
            ]
        })
        mockedGetCharacterAssets.mockResolvedValue({ QRS: { assets: [] } })
        const output = await render({
                renderList: [{
                    EphemeraId: 'ROOM#MNO',
                    CharacterId: 'QRS'
                }],
                assetMeta: testAssets
        })
        expect(output).toMatchSnapshot()
    })

    it('should render when mapValueOnly set true', async () => {
        const testAssets = objectMap(
            resultStateFactory(),
            (state: Record<string, { value: any }>) => ({ State: objectMap(state, ({ value }) => value) })
        )
        mockedGetStateByAsset.mockResolvedValue(testAssets)
        mockedGetGlobalAssets.mockResolvedValue(['BASE', 'LayerA', 'LayerB', 'MixLayerA', 'MixLayerB'])
        mockedGetItemMeta.mockResolvedValue({
            ['ROOM#MNO']: [
                {
                    DataCategory: 'ASSET#BASE',
                    appearances: [{
                        conditions: [{
                            if: 'foo',
                            dependencies: ['foo']
                        }],
                        name: ['Test One. '],
                    }]
                },
                {
                    DataCategory: 'ASSET#LayerA',
                    appearances: [{
                        conditions: [],
                        name: ['Test Two. '],
                        exits: [{
                            name: 'vortex',
                            to: 'VORTEX'
                        }]
                    }]
                }
            ]
        })
        mockedGetCharacterAssets.mockResolvedValue({ QRS: { assets: [] } })
        const output = await render({
                renderList: [{
                    EphemeraId: 'ROOM#MNO',
                    CharacterId: 'QRS',
                    mapValuesOnly: true
                }],
                assetMeta: testAssets
        })
        expect(output).toMatchSnapshot()
        expect(mockedGetStateByAsset).toHaveBeenCalledWith(
            ['BASE', 'LayerA'],
            testAssets
        )

    })

    it('should render features', async () => {
        const featureAssets = {
            BASE: {
                State: {},
                Dependencies: {},
                importTree: {}
            },
        }
        mockedGetGlobalAssets.mockResolvedValue(['BASE'])
        mockedGetStateByAsset.mockResolvedValue(featureAssets)
        mockedGetItemMeta.mockResolvedValue({
            ['FEATURE#MNO']: [
                {
                    DataCategory: 'ASSET#BASE',
                    appearances: [{
                        name: 'Clock Tower',
                        render: [{
                            tag: 'String',
                            value: 'A cheery clock-tower of pale yellow stone.'
                        }]
                    }]
                }
            ]
        })
        mockedGetCharacterAssets.mockResolvedValue({ QRS: { assets: [] } })
        const output = await render({
            renderList: [{
                EphemeraId: 'FEATURE#MNO',
                CharacterId: 'QRS'
            }],
            assetMeta: featureAssets
        })
        expect(output).toEqual([{
            tag: 'Feature',
            CharacterId: 'QRS',
            Description: [{ tag: 'String', value: 'A cheery clock-tower of pale yellow stone.' }],
            EphemeraId: 'FEATURE#MNO',
            FeatureId: 'MNO',
            Name: "Clock Tower",
            Features: []
        }])
        expect(mockedGetStateByAsset).toHaveBeenCalledWith(
            ['BASE'],
            featureAssets
        )

    })

    it('should render maps', async () => {
        const mapAssets = {
            BASE: {
                State: {},
                Dependencies: {},
                mapCache: {
                    fountainSquare: {
                        EphemeraId: 'ROOM#XYZ',
                        name: ['Fountain Square'],
                        exits: [{
                            to: 'alley',
                            toEphemeraId: 'TUV',
                            name: 'alley'
                        },
                        {
                            to: 'library',
                            toEphemeraId: 'Library',
                            name: 'library'
                        }]
                    }
                },
                importTree: {}
            },
        }
        mockedGetGlobalAssets.mockResolvedValue(['BASE'])
        mockedGetStateByAsset.mockResolvedValue(mapAssets)
        mockedGetItemMeta.mockResolvedValue({
            ['MAP#MNO']: [
                {
                    DataCategory: 'ASSET#BASE',
                    name: 'Grand Bazaar',
                    appearances: [{
                        conditions: [],
                        fileURL: 'test.png',
                        rooms: {
                            fountainSquare: {
                                EphemeraId: 'ROOM#XYZ',
                                x: 0,
                                y: 100
                            },
                            library: {
                                EphemeraId: 'ROOM#Library',
                                x: 0,
                                y: -100
                            }
                        }
                    }]
                }
            ]
        })
        mockedGetCharacterAssets.mockResolvedValue({ QRS: { assets: [] } })
        const output = await render({
            renderList: [{
                EphemeraId: 'MAP#MNO',
                CharacterId: 'QRS'
            }],
            assetMeta: mapAssets
        })
        expect(output).toMatchSnapshot()
        expect(mockedGetStateByAsset).toHaveBeenCalledWith(['BASE'], mapAssets)

    })

    it('should render characters', async () => {
        const characterAssets = {}
        mockedGetGlobalAssets.mockResolvedValue(['BASE'])
        mockedGetStateByAsset.mockResolvedValue(characterAssets)
        mockedGetItemMeta.mockResolvedValue({
            ['CHARACTERINPLAY#QRS']: [
                {
                    DataCategory: 'Meta::Character',
                    Name: 'Tess',
                    fileURL: 'tess.png',
                    FirstImpression: 'Frumpy Goth',
                    Outfit: 'Black',
                    OneCoolThing: 'Thousand yard stare',
                    Pronouns: {
                        subject: 'she',
                        object: 'her',
                        reflexive: 'herself',
                        possessive: 'her',
                        adjective: 'hers'
                    }
                }
            ]
        })
        mockedGetCharacterAssets.mockResolvedValue({ QRS: { assets: [] } })
        const output = await render({
            renderList: [{
                EphemeraId: 'CHARACTERINPLAY#QRS',
                CharacterId: 'QRS'
            }],
            assetMeta: characterAssets
        })
        expect(output).toEqual([{
            tag: 'Character',
            Targets: ['CHARACTER#QRS'],
            CharacterId: 'QRS',
            EphemeraId: 'CHARACTERINPLAY#QRS',
            Name: "Tess",
            fileURL: 'tess.png',
            FirstImpression: 'Frumpy Goth',
            Outfit: 'Black',
            OneCoolThing: 'Thousand yard stare',
            Pronouns: {
                subject: 'she',
                object: 'her',
                reflexive: 'herself',
                possessive: 'her',
                adjective: 'hers'
            }
        }])
        expect(mockedGetItemMeta).toHaveBeenCalledWith(['CHARACTERINPLAY#QRS'])
        expect(mockedGetStateByAsset).toHaveBeenCalledWith([], characterAssets)

    })

    it('should fetch state data only where needed', async () => {
        const testAssets = objectMap(
            resultStateFactory(),
            (state: Record<string, { value: any }>) => ({ State: objectMap(state, ({ value }) => value) })
        )
        mockedGetGlobalAssets.mockResolvedValue(['BASE'])
        mockedGetStateByAsset.mockImplementation(async (assets) => {
            return assets.reduce((previous, asset) => ({
                ...previous,
                [asset]: testAssets[asset] || {}
            }), {})
        })
        mockedGetItemMeta.mockResolvedValue({
            ['ROOM#MNO']: [
                {
                    DataCategory: 'ASSET#BASE',
                    appearances: [{
                        conditions: [{
                            if: 'foo',
                            dependencies: ['foo']
                        }],
                        render: [{
                            tag: 'String',
                            value: 'Test One. '
                        }],
                        exits: []
                    }]
                }
            ],
            ['ROOM#TUV']: [
                {
                    DataCategory: 'ASSET#LayerB',
                    appearances: [{
                        conditions: [{
                            if: 'baz',
                            dependencies: ['baz']
                        }],
                        render: [{
                            tag: 'String',
                            value: 'Test Two. '
                        }],
                        exits: []
                    }]
                },
                {
                    DataCategory: 'ASSET#LayerA',
                    appearances: [{
                        conditions: [{
                            if: 'bar',
                            dependencies: ['bar']
                        }],
                        render: [{
                            tag: 'String',
                            value: 'Test Three. '
                        }],
                        exits: []
                    }]
                }
            ]
        })
        mockedGetCharacterAssets.mockResolvedValue({ QRS: { assets: ['LayerB'] }, XYZ: { assets: ['LayerA'] } })
        const output = await render({
            renderList:
            [{
                EphemeraId: 'ROOM#MNO',
                CharacterId: 'XYZ'
            },
            {
                EphemeraId: 'ROOM#TUV',
                CharacterId: 'QRS'
            }],
            assetMeta: { BASE: testAssets.BASE }
        })
        expect(output).toMatchSnapshot()

        expect(mockedGetStateByAsset).toHaveBeenCalledWith(
            ['BASE', 'LayerB'],
            { BASE: testAssets.BASE }
        )

    })

    it('should fetch assetList data only where needed', async () => {
        const testAssets = objectMap(
            resultStateFactory(),
            (state: Record<string, { value: any }>) => ({ State: objectMap(state, ({ value }) => value) })
        )
        mockedGetStateByAsset.mockImplementation(async (assets) => {
            return assets.reduce((previous, asset) => ({
                ...previous,
                [asset]: testAssets[asset] || {}
            }), {})
        })
        mockedGetGlobalAssets.mockResolvedValue(['BASE'])
        mockedGetItemMeta.mockResolvedValue({
            ['ROOM#MNO']: [
                {
                    DataCategory: 'ASSET#BASE',
                    appearances: [{
                        conditions: [{
                            if: 'foo',
                            dependencies: ['foo']
                        }],
                        render: [{
                            tag: 'String',
                            value: 'Test One. '
                        }],
                        exits: []
                    }]
                }
            ],
            ['ROOM#TUV']: [
                {
                    DataCategory: 'ASSET#LayerB',
                    appearances: [{
                        conditions: [{
                            if: 'baz',
                            dependencies: ['baz']
                        }],
                        render: [{
                            tag: 'String',
                            value: 'Test Two. '
                        }],
                        exits: []
                    }]
                },
                {
                    DataCategory: 'ASSET#LayerA',
                    appearances: [{
                        conditions: [{
                            if: 'bar',
                            dependencies: ['bar']
                        }],
                        render: [{
                            tag: 'String',
                            value: 'Test Three. '
                        }],
                        exits: []
                    }]
                }
            ]
        })
        mockedGetGlobalAssets.mockResolvedValue(['BASE'])
        mockedGetCharacterAssets.mockResolvedValue({ QRS: { assets: ['LayerB'] }, XYZ: { assets: ['LayerA'] } })
        const output = await render({
            renderList: [{
                    EphemeraId: 'ROOM#MNO',
                    CharacterId: 'XYZ'
                },
                {
                    EphemeraId: 'ROOM#TUV',
                    CharacterId: 'QRS'
                }],
            assetMeta: testAssets,
            assetLists: {
                    global: ['BASE'],
                    characters: {
                        QRS: ['LayerB']
                    }
                }
        })
        expect(output).toMatchSnapshot()

        expect(mockedGetGlobalAssets).toHaveBeenCalledWith(['BASE'])
        expect(mockedGetCharacterAssets).toHaveBeenCalledWith(['XYZ', 'QRS'], { QRS: { assets: ['LayerB'] } })

    })

})