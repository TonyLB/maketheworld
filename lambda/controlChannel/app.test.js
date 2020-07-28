jest.mock('./utilities', () => ({
    documentClient: {
        get: jest.fn(),
        query: jest.fn(),
        update: jest.fn(),
        put: jest.fn()
    },
    graphqlClient: {
        mutate: jest.fn(async () => {})
    },
    gql: jest.fn((strings, ...args) => {
        const returnVal = strings.reduce((previous, entry, index) => (previous + entry + (args[index] || '')), '')
        return returnVal.split("\n").map((innerVal) => (innerVal.trim())).join('\n')
    }),
    SNS: {
        publish: jest.fn(() => ({ promise: () => ( Promise.resolve({}) )}))
    }
}))
const { disconnect, registerCharacter } = require('./app')
const { documentClient, graphqlClient } = require('./utilities')

describe("disconnect", () => {
    it("should change nothing when called against a non-connected character", async () => {
        documentClient.query.mockReturnValue({ promise: () => (Promise.resolve({ Items: [] })) })
        const data = await disconnect('123')
        expect(graphqlClient.mutate.mock.calls.length).toBe(0)
        expect(data).toEqual({ statusCode: 200 })
    })
    it("should update when called against a connected character", async () => {
        const expectedGraphQL = `mutation DisconnectCharacter {\nbroadcastEphemera (Ephemera: [{ CharacterInPlay: { CharacterId: "ABC", RoomId: "123", Connected: false } }]) {\nCharacterInPlay {\nCharacterId\nRoomId\nConnected\n}\n}\n}`
        documentClient.query.mockReturnValueOnce({ promise: () => (
                Promise.resolve({ Items: [
                    {
                        EphemeraId: 'CHARACTERINPLAY#ABC',
                        ConnectionId: '123',
                        RoomId: '123',
                        Connected: true
                    }
                ]})
            )})
            .mockReturnValueOnce({ promise: () => (
                Promise.resolve({ Items: [
                    {
                        EphemeraId: 'CHARACTERINPLAY#ABC',
                        RoomId: '123',
                        Connected: true
                    },
                    {
                        EphemeraId: 'CHARACTERINPLAY#DEF',
                        RoomId: '123',
                        Connected: true
                    },
                    {
                        EphemeraId: 'CHARACTERINPLAY#GHI',
                        RoomId: '123',
                        Connected: false
                    }
                ]})
            )})
        documentClient.put.mockReturnValue({ promise: () => ({}) })
        documentClient.get.mockReturnValue({ promise: () => (
            Promise.resolve({ Item: {
                Name: 'Test'
            }})
        ) })
        const data = await disconnect('123')
        expect(graphqlClient.mutate.mock.calls.length).toBe(1)
        expect(graphqlClient.mutate.mock.calls[0][0]).toEqual({ mutation: expectedGraphQL })
        expect(data).toEqual({ statusCode: 200 })
    })
})

describe("registerCharacter", () => {
    afterEach(() => {
        jest.clearAllMocks()
    })

    it("should change nothing, return not-found when character is not in ephemera table", async () => {
        documentClient.get.mockReturnValue({ promise: () => (Promise.resolve({})) })
        documentClient.update.mockReturnValue({ promise: () => (Promise.resolve({})) })
        const data = await registerCharacter({ connectionId: '123', CharacterID: 'ABC' })
        expect(documentClient.update.mock.calls.length).toBe(0)
        expect(data).toEqual({ statusCode: 404 })
    })

    it("should update connectionID when character is in table without connection", async () => {
        documentClient.get.mockReturnValue({ promise: () => (Promise.resolve({ Item: {
            EphemeraId: 'CHARACTERINPLAY#ABC',
            DataCategory: 'Connection'
        }})) })
        documentClient.update.mockReturnValue({ promise: () => (Promise.resolve({})) })
        const data = await registerCharacter({ connectionId: '123', CharacterId: 'ABC' })
        expect(documentClient.update.mock.calls.length).toBe(1)
        expect(documentClient.update.mock.calls[0][0]).toEqual({
            TableName: 'undefined_ephemera',
            Key: {
                EphemeraId: 'CHARACTERINPLAY#ABC',
                DataCategory: 'Connection'
            },
            UpdateExpression: "set ConnectionId = :ConnectionId, Connected = :Connected",
            ExpressionAttributeValues: {
                ":ConnectionId": '123',
                ":Connected": true
            }
        })
        expect(data).toEqual({
            statusCode: 200,
            body: JSON.stringify({ message: "Registered" })
        })
    })

    it("should update connectionID when character is in table with prior connection", async () => {
        documentClient.get.mockReturnValue({ promise: () => (Promise.resolve({ Item: {
            EphemeraId: 'CHARACTERINPLAY#ABC',
            DataCategory: 'Connection',
            ConnectionId: '987'
        }})) })
        documentClient.update.mockReturnValue({ promise: () => (Promise.resolve({})) })
        const data = await registerCharacter({ connectionId: '123', CharacterId: 'ABC' })
        expect(documentClient.update.mock.calls.length).toBe(1)
        expect(documentClient.update.mock.calls[0][0]).toEqual({
            TableName: 'undefined_ephemera',
            Key: {
                EphemeraId: 'CHARACTERINPLAY#ABC',
                DataCategory: 'Connection'
            },
            UpdateExpression: "set ConnectionId = :ConnectionId, Connected = :Connected",
            ExpressionAttributeValues: {
                ":ConnectionId": '123',
                ":Connected": true
            }
        })
        expect(data).toEqual({
            statusCode: 200,
            body: JSON.stringify({ message: "Registered" })
        })
    })

})