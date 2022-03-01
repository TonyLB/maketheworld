import { jest, expect } from '@jest/globals'
import { marshall } from "@aws-sdk/util-dynamodb"

jest.mock('../clients.js')
import { streamToString } from '/opt/utilities/stream.js'
import {
    ephemeraDB,
    batchWriteDispatcher
} from '/opt/utilities/dynamoDB/index.js'

import initializeRooms, { initializeFeatures } from './initializeRooms.js'

describe('initializeRooms', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })
    it('should send rooms in need of update', async () => {
        ephemeraDB.batchGetItem.mockResolvedValue([])
        ephemeraDB.query.mockResolvedValue([{
            EphemeraId: 'CHARACTERINPLAY#123',
            RoomId: 'ABC',
            Name: 'Tess',
            Connected: true,
            ConnectionId: '1234',
        },
        {
            EphemeraId: 'CHARACTERINPLAY#456',
            RoomId: 'ABC',
            Name: 'Marco',
            Connected: false
        }])
        batchWriteDispatcher.mockResolvedValue([])
        await initializeRooms(['ROOM#ABC'])
        expect(batchWriteDispatcher).toHaveBeenCalledWith({
            table: "undefined_ephemera",
            items: [{
                PutRequest: {
                    Item: marshall({
                        EphemeraId: 'ROOM#ABC',
                        DataCategory: 'Meta::Room',
                        activeCharacters: {
                            ['CHARACTERINPLAY#123']: {
                                EphemeraId: 'CHARACTERINPLAY#123',
                                Name: 'Tess',
                                ConnectionId: '1234'
                            }
                        },
                        inactiveCharacters: {
                            ['CHARACTERINPLAY#456']: {
                                EphemeraId: 'CHARACTERINPLAY#456',
                                Name: 'Marco'
                            }
                        }
                    })
                }
            }]
        })
    })
})

describe('initializeFeatures', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })
    it('should send features in need of update', async () => {
        ephemeraDB.batchGetItem.mockResolvedValue([])
        batchWriteDispatcher.mockResolvedValue([])
        await initializeFeatures(['FEATURE#ABC'])
        expect(batchWriteDispatcher).toHaveBeenCalledWith({
            table: "undefined_ephemera",
            items: [{
                PutRequest: {
                    Item: marshall({
                        EphemeraId: 'FEATURE#ABC',
                        DataCategory: 'Meta::Feature'
                    })
                }
            }]
        })
    })
})