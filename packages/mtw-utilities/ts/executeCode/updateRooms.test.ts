jest.mock('../dynamoDB')
import { ephemeraDB } from '../dynamoDB'
jest.mock('../perception/index')
import { render } from '../perception/index'
jest.mock('../perception/deliverRenders')
import { deliverRenders } from '../perception/deliverRenders'
jest.mock('../perception/dynamoDB')
import { getGlobalAssets, getCharacterAssets } from '../perception/dynamoDB'
jest.mock('uuid')
import { v4 as uuid } from 'uuid'
import { testAssetsFactory, testMockImplementation } from './testAssets'

import { updateRooms } from './updateRooms'

const uuidMock = uuid as jest.Mock
const mockedEphemeraDB = ephemeraDB as jest.Mocked<typeof ephemeraDB>
const mockedRender = render as jest.Mock
const mockedDeliverRenders = deliverRenders as jest.Mock
const mockedGetGlobalAssets = getGlobalAssets as jest.Mock
const mockedGetCharacterAssets = getCharacterAssets as jest.Mock

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
        mockedEphemeraDB.getItem.mockResolvedValue({
            activeCharacters: {}
        })
        mockedRender.mockResolvedValue([{
            tag: 'Room',
            RoomId: 'VORTEX',
            CharacterId: 'TESS',
            Name: 'Vortex',
            Exits: [],
            Description: ['A swirling vortex '],
        }])
        mockedGetGlobalAssets.mockResolvedValue(['BASE'])
        mockedGetCharacterAssets.mockResolvedValue({})

        await updateRooms({
            assetsChangedByRoom: { VORTEX: ['BASE'] }
        })

        expect(mockedRender).toHaveBeenCalledWith({
            renderList: [],
            assetMeta: {},
            assetLists: { global: ['BASE'], characters: {} }
        })
        expect(mockedDeliverRenders).toHaveBeenCalledWith({
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
        mockedRender.mockResolvedValue([])
        await updateRooms({
            assetsChangedByRoom: {}
        })
        expect(render).toHaveBeenCalledTimes(0)
        expect(deliverRenders).toHaveBeenCalledTimes(0)
    })

    it('should publish to all characters on a global-asset update', async() => {
        mockedEphemeraDB.getItem.mockResolvedValue({
            EphemeraId: 'ROOM#VORTEX',
            activeCharacters: {
                ['CHARACTERINPLAY#TESS']: { Name: 'Tess' },
                ['CHARACTERINPLAY#MARCO']: { Name: 'Marco' }
            },
            Dependencies: {}
        })
        mockedRender.mockResolvedValue([])
        mockedGetGlobalAssets.mockResolvedValue(['BASE', 'LayerA', 'LayerB'])
        mockedGetCharacterAssets.mockResolvedValue({})

        await updateRooms({
            assetsChangedByRoom: {
                VORTEX: ['LayerA', 'LayerB']
            }
        })

        expect(mockedRender).toHaveBeenCalledWith({
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
        mockedEphemeraDB.getItem.mockResolvedValue({
            EphemeraId: 'ROOM#VORTEX',
            activeCharacters: {
                ['CHARACTERINPLAY#TESS']: { Name: 'Tess' },
                ['CHARACTERINPLAY#MARCO']: { Name: 'Marco' }
            }
        })
        mockedRender.mockResolvedValue([])
        mockedGetGlobalAssets.mockResolvedValue(['BASE'])
        mockedGetCharacterAssets.mockResolvedValue({
            TESS: { assets: ['LayerA'] },
            MARCO: { assets: ['LayerB'] }
        })

        await updateRooms({
            assetsChangedByRoom: {
                VORTEX: ['LayerA']
            }
        })

        expect(mockedRender).toHaveBeenCalledWith({
            renderList: [{
                EphemeraId: 'ROOM#VORTEX',
                CharacterId: 'TESS'
            }],
            assetMeta: {},
            assetLists: { global: ['BASE'], characters: {
                TESS: { assets: ['LayerA'] },
                MARCO: { assets: ['LayerB'] }
            } }
        })
    })

    it('should publish map updates to everyone on a global map-dependency change', async () => {
        mockedEphemeraDB.getItem.mockResolvedValue({
            EphemeraId: 'ROOM#VORTEX',
            activeCharacters: {
                ['CHARACTERINPLAY#TESS']: { Name: 'Tess' },
                ['CHARACTERINPLAY#MARCO']: { Name: 'Marco' }
            },
            Dependencies: {
                map: ['MAP#TestMap']
            }
        })
        mockedEphemeraDB.query.mockImplementation(async ({ IndexName }: { IndexName?: string }) => {
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
        mockedRender.mockResolvedValue([])
        mockedGetGlobalAssets.mockResolvedValue(['BASE'])
        mockedGetCharacterAssets.mockResolvedValue({
            TESS: { assets: ['LayerA'] },
            MARCO: { assets: ['LayerB'] }
        })

        await updateRooms({
            assetsChangedByRoom: {
                VORTEX: ['LayerA']
            },
            assetsChangedByMap: {
                TestMapTwo: ['LayerB']
            },
            roomsWithMapUpdates: ['VORTEX'],
        })

        expect(render).toHaveBeenCalledWith({
            renderList: [{
                EphemeraId: 'ROOM#VORTEX',
                CharacterId: 'TESS'
            },
            {
                EphemeraId: 'MAP#TestMapTwo',
                CharacterId: 'MARCO'
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
                TESS: { assets: ['LayerA'] },
                MARCO: { assets: ['LayerB'] }
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