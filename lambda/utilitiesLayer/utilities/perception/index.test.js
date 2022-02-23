import { jest, describe, expect, it } from '@jest/globals'

jest.mock('./dynamoDB.js')
import { getCharacterAssets, getRoomMeta, getStateByAsset } from './dynamoDB.js'

jest.mock('../dynamoDB/index.js')
import { ephemeraDB } from '../dynamoDB/index.js'

import { resultStateFactory, testMockImplementation } from '../executeCode/testAssets.js'

import { render } from './index.js'

describe('dependencyCascade', () => {

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        jest.restoreAllMocks()
    })

    it('should return empty on an empty list', async () => {
        ephemeraDB.getItem.mockResolvedValue({
            assets: []
        })
        const output = await render([])
        expect(output).toEqual([])
    })

    it('should render with no provided state data', async () => {
        const testAssets = resultStateFactory()
        ephemeraDB.getItem.mockResolvedValue({
            assets: ['BASE', 'LayerA', 'LayerB', 'MixLayerA', 'MixLayerB']
        })
        getStateByAsset.mockImplementation(async (assets) => {
            return assets.reduce((previous, asset) => ({ ...previous, [asset]: testAssets[asset] || {} }), {})
        })
        getRoomMeta.mockResolvedValue({
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
        const output = await render([{
            EphemeraId: 'ROOM#MNO',
            CharacterId: 'QRS'
        }])
        expect(output).toEqual([{
            Ancestry: '',
            CharacterId: 'QRS',
            Characters: [],
            Description: ['Test One. '],
            EphemeraId: 'ROOM#MNO',
            RoomId: 'MNO',
            Name: "",
            Exits: []
        }])
        expect(getStateByAsset).toHaveBeenCalledWith(['BASE'])
    })

    it('should render with provided state data', async () => {
        const testAssets = resultStateFactory()
        ephemeraDB.getItem.mockResolvedValue({
            assets: ['BASE', 'LayerA', 'LayerB', 'MixLayerA', 'MixLayerB']
        })
        getRoomMeta.mockResolvedValue({
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
        const output = await render([{
            EphemeraId: 'ROOM#MNO',
            CharacterId: 'QRS'
        }], testAssets)
        expect(output).toEqual([{
            Ancestry: '',
            CharacterId: 'QRS',
            Characters: [],
            Description: ['Test One. '],
            EphemeraId: 'ROOM#MNO',
            RoomId: 'MNO',
            Name: "",
            Exits: []
        }])
        expect(getStateByAsset).toHaveBeenCalledWith([])

    })

    it('should render fetch data only where needed', async () => {
        const testAssets = resultStateFactory()
        ephemeraDB.getItem.mockResolvedValue({
            assets: ['BASE']
        })
        getStateByAsset.mockImplementation(async (assets) => {
            return assets.reduce((previous, asset) => ({ ...previous, [asset]: testAssets[asset] || {} }), {})
        })
        getRoomMeta.mockResolvedValue({
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
        const output = await render([{
            EphemeraId: 'ROOM#MNO',
            CharacterId: 'XYZ'
        },
        {
            EphemeraId: 'ROOM#TUV',
            CharacterId: 'QRS'
        }], { BASE: testAssets.BASE })
        expect(output).toEqual([{
            Ancestry: '',
            CharacterId: 'XYZ',
            Characters: [],
            Description: ['Test One. '],
            EphemeraId: 'ROOM#MNO',
            RoomId: 'MNO',
            Name: "",
            Exits: []
        },
        {
            Ancestry: '',
            CharacterId: 'QRS',
            Characters: [],
            Description: ['Test Two. '],
            EphemeraId: 'ROOM#TUV',
            RoomId: 'TUV',
            Name: "",
            Exits: []
        }])

        expect(getStateByAsset).toHaveBeenCalledWith(['LayerB'])

    })

})