import { jest, describe, it, expect } from '@jest/globals'

jest.mock('../dynamoDB/index.js')
import { ephemeraDB } from '../dynamoDB/index.js'
jest.mock('../perception/index.js')
import { render } from '../perception/index.js'
jest.mock('../perception/deliverRenders.js')
import { deliverRenders } from '../perception/deliverRenders.js'
jest.mock('../perception/dynamoDB.js')
import { getGlobalAssets, getCharacterAssets } from '../perception/dynamoDB.js'
jest.mock('uuid')
import { v4 as uuidMock } from 'uuid'
import { testAssetsFactory, testMockImplementation } from './testAssets.js'

import { updateRooms } from './updateRooms.js'

describe('updateRooms', () => {

    const realDateNow = Date.now.bind(global.Date);

    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
        uuidMock.mockReturnValue('UUID')
        const dateNowStub = jest.fn(() => 1000000000000)
        global.Date.now = dateNowStub
    })

    afterEach(() => {
        global.Date.now = realDateNow
    })

    it('should publish whatever render returns', async() => {
        ephemeraDB.getItem.mockResolvedValue({
            activeCharacters: {}
        })
        render.mockResolvedValue([{
            tag: 'Room',
            RoomId: 'VORTEX',
            CharacterId: 'TESS',
            Name: 'Vortex',
            Exits: [],
            Description: ['A swirling vortex '],
        }])
        getGlobalAssets.mockResolvedValue(['BASE'])
        getCharacterAssets.mockResolvedValue({})

        await updateRooms({
            assetsChangedByRoom: { VORTEX: ['BASE'] }
        })

        expect(render).toHaveBeenCalledWith({
            renderList: [],
            assetMeta: {},
            assetLists: { global: ['BASE'], characters: {} }
        })
        expect(deliverRenders).toHaveBeenCalledWith({
            renderOutputs: [{
                tag: 'Room',
                CharacterId: 'TESS',
                Name: 'Vortex',
                RoomId: 'VORTEX',
                Description: ['A swirling vortex '],
                Exits: []
            }]
        })
    })

    it('should render no rooms on an empty check-list', async () => {
        render.mockResolvedValue([])
        await updateRooms({
            assetsChangedByRoom: {}
        })
        expect(render).toHaveBeenCalledTimes(0)
        expect(deliverRenders).toHaveBeenCalledTimes(0)
    })

    it('should publish to all characters on a global-asset update', async() => {
        ephemeraDB.getItem.mockResolvedValue({
            EphemeraId: 'ROOM#VORTEX',
            activeCharacters: {
                ['CHARACTERINPLAY#TESS']: { Name: 'Tess' },
                ['CHARACTERINPLAY#MARCO']: { Name: 'Marco' }
            },
            Dependencies: {}
        })
        render.mockResolvedValue([])
        getGlobalAssets.mockResolvedValue(['BASE', 'LayerA', 'LayerB'])
        getCharacterAssets.mockResolvedValue({})

        await updateRooms({
            assetsChangedByRoom: {
                VORTEX: ['LayerA', 'LayerB']
            }
        })

        expect(render).toHaveBeenCalledWith({
            renderList: [{
                    EphemeraId: 'ROOM#VORTEX',
                    CharacterId: 'TESS'
                },
                {
                    EphemeraId: 'ROOM#VORTEX',
                    CharacterId: 'MARCO'
            }],
            assetMeta: {},
            assetLists: { global: ['BASE', 'LayerA', 'LayerB'], characters: {} }
        })
    })

    it('should publish to characters who see a change on a character-asset update', async() => {
        ephemeraDB.getItem.mockResolvedValue({
            EphemeraId: 'ROOM#VORTEX',
            activeCharacters: {
                ['CHARACTERINPLAY#TESS']: { Name: 'Tess' },
                ['CHARACTERINPLAY#MARCO']: { Name: 'Marco' }
            }
        })
        render.mockResolvedValue([])
        getGlobalAssets.mockResolvedValue(['BASE'])
        getCharacterAssets.mockResolvedValue({
            TESS: ['LayerA'],
            MARCO: ['LayerB']
        })

        await updateRooms({
            assetsChangedByRoom: {
                VORTEX: ['LayerA']
            }
        })

        expect(render).toHaveBeenCalledWith({
            renderList: [{
                EphemeraId: 'ROOM#VORTEX',
                CharacterId: 'TESS'
            }],
            assetMeta: {},
            assetLists: { global: ['BASE'], characters: {
                TESS: ['LayerA'],
                MARCO: ['LayerB']
            } }
        })
    })

    it('should publish map updates to everyone on a global map-dependency change', async () => {
        ephemeraDB.getItem.mockResolvedValue({
            EphemeraId: 'ROOM#VORTEX',
            activeCharacters: {
                ['CHARACTERINPLAY#TESS']: { Name: 'Tess' },
                ['CHARACTERINPLAY#MARCO']: { Name: 'Marco' }
            },
            Dependencies: {
                map: ['MAP#TestMap']
            }
        })
        ephemeraDB.query.mockImplementation(({ IndexName }) => {
            if (IndexName === 'DataCategoryIndex') {
                return [{
                    EphemeraId: 'CHARACTERINPLAY#TESS',
                    Connected: true
                },
                {
                    EphemeraId: 'CHARACTERINPLAY#MARCO',
                    Connected: true
                },
                {
                    EphemeraId: 'CHARACTERINPLAY#AKUA',
                    Connected: false
                }]
            }
            return [{
                EphemeraId: 'MAP#TestMap',
                DataCategory: 'ASSET#BASE'
            }]
        })
        render.mockResolvedValue([])
        getGlobalAssets.mockResolvedValue(['BASE'])
        getCharacterAssets.mockResolvedValue({
            TESS: ['LayerA'],
            MARCO: ['LayerB']
        })

        await updateRooms({
            assetsChangedByRoom: {
                VORTEX: ['LayerA']
            }
        })

        expect(render).toHaveBeenCalledWith({
            renderList: [{
                EphemeraId: 'ROOM#VORTEX',
                CharacterId: 'TESS'
            },
            {
                EphemeraId: 'MAP#TestMap',
                CharacterId: 'TESS'
            },
            {
                EphemeraId: 'MAP#TestMap',
                CharacterId: 'MARCO'
            }],
            assetMeta: {},
            assetLists: { global: ['BASE'], characters: {
                TESS: ['LayerA'],
                MARCO: ['LayerB']
            } }
        })
    })

    //
    // Test that it renders characters needing a rerender for global
    //

    //
    // Test that it renders characters needing a rerender for personal and
    // DOESN'T render for characters with no changes in personal-asset values
    //
})