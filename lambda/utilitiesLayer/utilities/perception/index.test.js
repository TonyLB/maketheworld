import { jest, describe, expect, it } from '@jest/globals'

jest.mock('./dynamoDB.js')
import { getCharacterAssets, getItemMeta, getStateByAsset, getGlobalAssets } from './dynamoDB.js'

import { resultStateFactory, testMockImplementation } from '../executeCode/testAssets.js'

import { render } from './index.js'

describe('dependencyCascade', () => {

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        jest.restoreAllMocks()
    })

    it('should return empty on an empty list', async () => {
        getGlobalAssets.mockResolvedValue([])
        const output = await render({
            renderList: []
        })
        expect(output).toEqual([])
    })

    it('should render with no provided state data', async () => {
        const testAssets = Object.entries(resultStateFactory())
            .reduce((previous, [key, value]) => ({
                ...previous,
                [key]: { state: value }
            }), {})
        getGlobalAssets.mockResolvedValue(['BASE', 'LayerA', 'LayerB', 'MixLayerA', 'MixLayerB'])
        getStateByAsset.mockImplementation(async (assets) => {
            return assets.reduce((previous, asset) => ({
                ...previous,
                [asset]: testAssets[asset] || {}
            }), {})
        })
        getItemMeta.mockResolvedValue({
            ['ROOM#MNO']: [
                {
                    DataCategory: 'ASSET#BASE',
                    appearances: [{
                        conditions: [{
                            if: 'foo',
                            dependencies: ['foo']
                        }],
                        render: ['Test One. '],
                        exits: []
                    }]
                }
            ]
        })
        getCharacterAssets.mockResolvedValue({ QRS: [] })
        const output = await render({
            renderList: [{
                EphemeraId: 'ROOM#MNO',
                CharacterId: 'QRS'
            }]
        })
        expect(output).toEqual([{
            tag: 'Room',
            Ancestry: '',
            CharacterId: 'QRS',
            Characters: [],
            Description: ['Test One. '],
            EphemeraId: 'ROOM#MNO',
            RoomId: 'MNO',
            Name: "",
            Exits: [],
            Features: []
        }])
        expect(getStateByAsset).toHaveBeenCalledWith(['BASE'])
    })

    it('should render with provided state data', async () => {
        const testAssets = Object.entries(resultStateFactory())
            .reduce((previous, [key, value]) => ({
                ...previous,
                [key]: { state: value }
            }), {})
        getGlobalAssets.mockResolvedValue(['BASE', 'LayerA', 'LayerB', 'MixLayerA', 'MixLayerB'])
        getItemMeta.mockResolvedValue({
            ['ROOM#MNO']: [
                {
                    DataCategory: 'ASSET#BASE',
                    appearances: [{
                        conditions: [{
                            if: 'foo',
                            dependencies: ['foo']
                        }],
                        render: ['Test One. '],
                        exits: []
                    }]
                }
            ]
        })
        getCharacterAssets.mockResolvedValue({ QRS: [] })
        const output = await render({
                renderList: [{
                    EphemeraId: 'ROOM#MNO',
                    CharacterId: 'QRS'
                }],
                assetMeta: testAssets
        })
        expect(output).toEqual([{
            tag: 'Room',
            Ancestry: '',
            CharacterId: 'QRS',
            Characters: [],
            Description: ['Test One. '],
            EphemeraId: 'ROOM#MNO',
            RoomId: 'MNO',
            Name: "",
            Exits: [],
            Features: []
        }])
        expect(getStateByAsset).toHaveBeenCalledWith([])

    })

    it('should render when mapValueOnly set true', async () => {
        const testAssets = Object.entries(resultStateFactory())
            .reduce((previous, [key, value]) => ({
                ...previous,
                [key]: { state: value }
            }), {})
        getGlobalAssets.mockResolvedValue(['BASE', 'LayerA', 'LayerB', 'MixLayerA', 'MixLayerB'])
        getItemMeta.mockResolvedValue({
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
        getCharacterAssets.mockResolvedValue({ QRS: [] })
        const output = await render({
                renderList: [{
                    EphemeraId: 'ROOM#MNO',
                    CharacterId: 'QRS',
                    mapValuesOnly: true
                }],
                assetMeta: testAssets
        })
        expect(output).toEqual([{
            tag: 'Room',
            Ancestry: '',
            CharacterId: 'QRS',
            EphemeraId: 'ROOM#MNO',
            RoomId: 'MNO',
            Name: "Test One. Test Two. ",
            Exits: [{
                Name: 'vortex',
                RoomId: 'VORTEX',
                Visibility: "Public"
            }],
        }])
        expect(getStateByAsset).toHaveBeenCalledWith([])

    })

    it('should render features', async () => {
        const featureAssets = {
            BASE: {
                State: {},
                Dependencies: {},
                importTree: {}
            },
        }
        getGlobalAssets.mockResolvedValue(['BASE'])
        getItemMeta.mockResolvedValue({
            ['FEATURE#MNO']: [
                {
                    DataCategory: 'ASSET#BASE',
                    name: 'Clock Tower',
                    appearances: [{
                        render: ['A cheery clock-tower of pale yellow stone.']
                    }]
                }
            ]
        })
        getCharacterAssets.mockResolvedValue({ QRS: [] })
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
            Description: ['A cheery clock-tower of pale yellow stone.'],
            EphemeraId: 'FEATURE#MNO',
            FeatureId: 'MNO',
            Name: "Clock Tower",
            Features: []
        }])
        expect(getStateByAsset).toHaveBeenCalledWith([])

    })

    it('should render maps', async () => {
        const mapAssets = {
            BASE: {
                State: {},
                Dependencies: {},
                importTree: {}
            },
        }
        getGlobalAssets.mockResolvedValue(['BASE'])
        getItemMeta.mockResolvedValue({
            ['MAP#MNO']: [
                {
                    DataCategory: 'ASSET#BASE',
                    name: 'Grand Bazaar',
                    appearances: [{
                        conditions: [],
                        roomLocations: {
                            fountainSquare: { x: 0, y: 100 }
                        }
                    }]
                }
            ]
        })
        getCharacterAssets.mockResolvedValue({ QRS: [] })
        const output = await render({
            renderList: [{
                EphemeraId: 'MAP#MNO',
                CharacterId: 'QRS'
            }],
            assetMeta: mapAssets
        })
        expect(output).toEqual([{
            tag: 'Map',
            CharacterId: 'QRS',
            EphemeraId: 'MAP#MNO',
            MapId: 'MNO',
            Name: "Grand Bazaar",
            roomLocations: {
                fountainSquare: { x: 0, y: 100 }
            }
        }])
        expect(getStateByAsset).toHaveBeenCalledWith([])

    })

    it('should fetch state data only where needed', async () => {
        const testAssets = Object.entries(resultStateFactory())
            .reduce((previous, [key, value]) => ({
                ...previous,
                [key]: { state: value }
            }), {})
        getGlobalAssets.mockResolvedValue(['BASE'])
        getStateByAsset.mockImplementation(async (assets) => {
            return assets.reduce((previous, asset) => ({
                ...previous,
                [asset]: testAssets[asset] || {}
            }), {})
        })
        getItemMeta.mockResolvedValue({
            ['ROOM#MNO']: [
                {
                    DataCategory: 'ASSET#BASE',
                    appearances: [{
                        conditions: [{
                            if: 'foo',
                            dependencies: ['foo']
                        }],
                        render: ['Test One. '],
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
                        render: ['Test Two. '],
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
                        render: ['Test Three. '],
                        exits: []
                    }]
                }
            ]
        })
        getCharacterAssets.mockResolvedValue({ QRS: ['LayerB'], XYZ: ['LayerA'] })
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
        expect(output).toEqual([{
            tag: 'Room',
            Ancestry: '',
            CharacterId: 'XYZ',
            Characters: [],
            Description: ['Test One. '],
            EphemeraId: 'ROOM#MNO',
            RoomId: 'MNO',
            Name: "",
            Exits: [],
            Features: []
        },
        {
            tag: 'Room',
            Ancestry: '',
            CharacterId: 'QRS',
            Characters: [],
            Description: ['Test Two. '],
            EphemeraId: 'ROOM#TUV',
            RoomId: 'TUV',
            Name: "",
            Exits: [],
            Features: []
        }])

        expect(getStateByAsset).toHaveBeenCalledWith(['LayerB'])

    })

    it('should fetch assetList data only where needed', async () => {
        const testAssets = Object.entries(resultStateFactory())
            .reduce((previous, [key, value]) => ({
                ...previous,
                [key]: { state: value }
            }), {})
        getGlobalAssets.mockResolvedValue(['BASE'])
        getItemMeta.mockResolvedValue({
            ['ROOM#MNO']: [
                {
                    DataCategory: 'ASSET#BASE',
                    appearances: [{
                        conditions: [{
                            if: 'foo',
                            dependencies: ['foo']
                        }],
                        render: ['Test One. '],
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
                        render: ['Test Two. '],
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
                        render: ['Test Three. '],
                        exits: []
                    }]
                }
            ]
        })
        getGlobalAssets.mockResolvedValue(['BASE'])
        getCharacterAssets.mockResolvedValue({ QRS: ['LayerB'], XYZ: ['LayerA'] })
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
        expect(output).toEqual([{
            tag: 'Room',
            Ancestry: '',
            CharacterId: 'XYZ',
            Characters: [],
            Description: ['Test One. '],
            EphemeraId: 'ROOM#MNO',
            RoomId: 'MNO',
            Name: "",
            Exits: [],
            Features: []
        },
        {
            tag: 'Room',
            Ancestry: '',
            CharacterId: 'QRS',
            Characters: [],
            Description: ['Test Two. '],
            EphemeraId: 'ROOM#TUV',
            RoomId: 'TUV',
            Name: "",
            Exits: [],
            Features: []
        }])

        expect(getGlobalAssets).toHaveBeenCalledWith(['BASE'])
        expect(getCharacterAssets).toHaveBeenCalledWith(['XYZ', 'QRS'], { QRS: ['LayerB'] })

    })

})