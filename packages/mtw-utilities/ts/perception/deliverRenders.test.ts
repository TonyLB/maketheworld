jest.mock('uuid')
import { v4 as uuid } from 'uuid'

jest.mock('../apiManagement/index')
import { SocketQueue } from '../apiManagement/index'
jest.mock('../dynamoDB/index.js')
import { publishMessage, ephemeraDB } from '../dynamoDB/index.js'

import { deliverRenders  } from './deliverRenders'

const uuidMock = uuid as jest.Mock
const mockedSocketQueue = SocketQueue as unknown as jest.Mock
const mockedPublishMessage = publishMessage as jest.Mock
const mockedEphemeraDB = ephemeraDB as jest.Mocked<typeof ephemeraDB>

const mockSocketSend = jest.fn()
const mockSocketFlush = jest.fn()

describe('displayRenders', () => {

    const realDateNow = Date.now.bind(global.Date);

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        jest.restoreAllMocks()
        mockedSocketQueue.mockImplementation(() => {
            return {
                send: mockSocketSend,
                flush: mockSocketFlush
            }
        })
        uuidMock.mockReturnValue('UUID')
        const dateNowStub = jest.fn(() => 1000000000000)
        global.Date.now = dateNowStub
    })

    afterEach(() => {
        global.Date.now = realDateNow
    })

    it('should deliver Rooms, Features and Maps', async () => {
        mockedEphemeraDB.query.mockResolvedValue([{
            DataCategory: 'CONNECTION#123'
        }])

        await deliverRenders({
            renderOutputs: [{
                tag: 'Room',
                EphemeraId: 'ROOM#ABC',
                CharacterId: 'TESS',
                Ancestry: '',
                Characters: [],
                Description: ['Test One. '],
                RoomId: 'ABC',
                Name: "",
                Exits: [],
                Features: []
            },
            {
                tag: 'Feature',
                CharacterId: 'TESS',
                Description: ['A cheery clock-tower of pale yellow stone.'],
                EphemeraId: 'FEATURE#MNO',
                FeatureId: 'MNO',
                Name: "Clock Tower",
                Features: []
            },
            {
                tag: 'Character',
                Targets: ['CHARACTER#TESS'],
                EphemeraId: 'CHARACTERINPLAY#GHI',
                CharacterId: 'GHI',
                Name: "Marco",
                fileURL: 'marco.png'
            },
            {
                type: 'Map',
                CharacterId: 'TESS',
                EphemeraId: 'MAP#TestMap',
                MapId: 'TestMap',
                Name: "Grand Bazaar",
                fileURL: 'test.png',
                rooms: {
                    ['BASE#fountainSquare']: {
                        x: 0,
                        y: 100,
                        EphemeraId: 'ROOM#XYZ',
                        name: ['Fountain Square'],
                        exits: [{
                            to: 'BASE#library',
                            name: 'library'
                        }]
                    },
                    ['BASE#library']: {
                        EphemeraId: 'ROOM#Library',
                        x: 0,
                        y: -100
                    }
                }
            }]
        } as any)

        expect(mockedPublishMessage).toHaveBeenCalledTimes(3)
        expect(mockedPublishMessage).toHaveBeenCalledWith({
            MessageId: 'MESSAGE#UUID',
            CreatedTime: 1000000000000,
            DisplayProtocol: 'RoomUpdate',
            Targets: ['CHARACTER#TESS'],
            Ancestry: '',
            Characters: [],
            Description: ['Test One. '],
            RoomId: 'ABC',
            Name: "",
            Exits: [],
            Features: []
        })
        expect(mockedPublishMessage).toHaveBeenCalledWith({
            MessageId: 'MESSAGE#UUID',
            CreatedTime: 1000000000000,
            DisplayProtocol: 'FeatureDescription',
            Targets: ['CHARACTER#TESS'],
            Description: ['A cheery clock-tower of pale yellow stone.'],
            FeatureId: 'MNO',
            Name: "Clock Tower",
            Features: []
        })
        expect(mockedPublishMessage).toHaveBeenCalledWith({
            MessageId: 'MESSAGE#UUID',
            CreatedTime: 1000000000000,
            DisplayProtocol: 'CharacterDescription',
            Targets: ['CHARACTER#TESS'],
            CharacterId: 'GHI',
            Name: "Marco",
            fileURL: 'marco.png'
        })
        expect(mockSocketSend).toHaveBeenCalledTimes(1)
        expect(mockSocketSend).toHaveBeenCalledWith({
            ConnectionId: '123',
            Message: {
                messageType: 'Ephemera',
                updates: [{
                    type: 'Map',
                    CharacterId: 'TESS',
                    EphemeraId: 'MAP#TestMap',
                    MapId: 'TestMap',
                    Name: "Grand Bazaar",
                    fileURL: 'test.png',
                    rooms: {
                        ['BASE#fountainSquare']: {
                            x: 0,
                            y: 100,
                            EphemeraId: 'ROOM#XYZ',
                            name: ['Fountain Square'],
                            exits: [{
                                to: 'BASE#library',
                                name: 'library'
                            }]
                        },
                        ['BASE#library']: {
                            EphemeraId: 'ROOM#Library',
                            x: 0,
                            y: -100
                        }
                    }
                }]
            }
        })
    })
})
