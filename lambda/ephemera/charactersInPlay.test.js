jest.mock('@aws-sdk/client-dynamodb', () => ({
    DynamoDBClient: jest.fn(),
    QueryCommand: () => 'Query',
    UpdateItemCommand: () => 'Update'
}))

jest.mock('uuid', () => ({
    v4: jest.fn()
}))

const { getCharactersInPlay, putCharacterInPlay } = require('./charactersInPlay')
const { documentClient, graphqlClient } = require('./utilities')
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { v4: uuid } = require('uuid')

describe("getCharactersInPlay", () => {
    const dbClient = {
        send: jest.fn()
    }
    beforeEach(() => {
        DynamoDBClient.mockReturnValue(dbClient)
    })
    it("should return empty when no CharacterInPlay records", async () => {
        dbClient.send.mockReturnValue(Promise.resolve({ Items: [] }))
        const data = await getCharactersInPlay()
        expect(data).toEqual([])
    })
    it("should return CharactersInPlay when present", async () => {
        dbClient.send.mockReturnValue(Promise.resolve({ Items: [
            {
                EphemeraId: 'CHARACTERINPLAY#ABC',
                DataCategory: 'Connection',
                RoomId: '123',
                Connected: true
            },
            {
                EphemeraId: 'CHARACTERINPLAY#DEF',
                DataCategory: 'Connection',
                RoomId: '456',
                Connected: false
            }
        ] }))
        const data = await getCharactersInPlay()
        expect(data).toEqual([
            {
                CharacterId: 'ABC',
                RoomId: '123',
                Connected: true
            },
            {
                CharacterId: 'DEF',
                RoomId: '456',
                Connected: false
            }
        ])

    })
})

describe("putCharacterInPlay", () => {
    const dbClient = {
        send: jest.fn()
    }
    beforeEach(() => {
        DynamoDBClient.mockReturnValue(dbClient)
    })
    afterEach(() => {
        jest.clearAllMocks()
    })

    it("should return empty when no CharacterId provided", async () => {
        const data = await putCharacterInPlay({ RoomId: '123', Connected: false })
        expect(data).toEqual([])
    })

    it("should correctly fetch RoomId from ephemera table if available", async () => {
        dbClient.send.mockReturnValueOnce(Promise.resolve({ Item:
            {
                EphemeraId: 'CHARACTERINPLAY#ABC',
                DataCategory: 'Connection',
                RoomId: '123',
                Connected: true
            }
        })).mockReturnValue(Promise.resolve({ DataCategory: 'Connection' }))
        const data = await putCharacterInPlay({ CharacterId: 'ABC', Connected: false })
        // expect(dbClient.put.mock.calls.length).toBe(1)
        // expect(documentClient.put.mock.calls[0][0]).toEqual({
        //     TableName: 'undefined_ephemera',
        //     Item: {
        //         EphemeraId: 'CHARACTERINPLAY#ABC',
        //         DataCategory: 'Connection',
        //         RoomId: '123',
        //         Connected: false
        //     }
        // })
        // expect(data).toEqual([{ CharacterInPlay: {
        //     CharacterId: 'ABC',
        //     RoomId: '123',
        //     Connected: false
        // }}])
    })

})
