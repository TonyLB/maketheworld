import { jest, describe, expect, it } from '@jest/globals'

jest.mock('uuid')
import { v4 as uuidMock } from 'uuid'

jest.mock('../apiManagement/index.js')
import { SocketQueue } from '../apiManagement/index.js'
jest.mock('../dynamoDB/index.js')
import { publishMessage, ephemeraDB } from '../dynamoDB/index.js'

import { deliverRenders  } from './deliverRenders.js'

describe('displayRenders', () => {

    const realDateNow = Date.now.bind(global.Date);

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        jest.restoreAllMocks()
        uuidMock.mockReturnValue('UUID')
        const dateNowStub = jest.fn(() => 1000000000000)
        global.Date.now = dateNowStub
    })

    afterEach(() => {
        global.Date.now = realDateNow
    })

    it('should deliver Rooms, Features and Maps', async () => {
        const socketSendMock = jest.fn()
        const socketFlushMock = jest.fn()
        SocketQueue.mockImplementation(() => ({
            send: socketSendMock,
            flush: socketFlushMock
        }))
        ephemeraDB.query.mockResolvedValue([{
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
        })

        expect(publishMessage).toHaveBeenCalledTimes(3)
        expect(publishMessage).toHaveBeenCalledWith({
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
        expect(publishMessage).toHaveBeenCalledWith({
            MessageId: 'MESSAGE#UUID',
            CreatedTime: 1000000000000,
            DisplayProtocol: 'FeatureDescription',
            Targets: ['CHARACTER#TESS'],
            Description: ['A cheery clock-tower of pale yellow stone.'],
            FeatureId: 'MNO',
            Name: "Clock Tower",
            Features: []
        })
        expect(publishMessage).toHaveBeenCalledWith({
            MessageId: 'MESSAGE#UUID',
            CreatedTime: 1000000000000,
            DisplayProtocol: 'CharacterDescription',
            Targets: ['CHARACTER#TESS'],
            CharacterId: 'GHI',
            Name: "Marco",
            fileURL: 'marco.png'
        })
        expect(socketSendMock).toHaveBeenCalledTimes(1)
        expect(socketSendMock).toHaveBeenCalledWith({
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
