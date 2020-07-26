jest.mock('./utilities', () => ({
    documentClient: {
        scan: jest.fn(),
        query: jest.fn(),
        get: jest.fn(),
        update: jest.fn(),
        put: jest.fn(),
        delete: jest.fn()
    },
    graphqlClient: {
        mutate: jest.fn(async () => {})
    },
    gql: jest.fn((strings, ...args) => {
        const returnVal = args.map((arg, index) => (strings[index] + arg)).join("") + strings[args.length]
        return returnVal.split("\n").map((innerVal) => (innerVal.trim())).join('\n')
    })
}))

jest.mock('/opt/uuid', () => ({
    v4: jest.fn()
}))

const { getCharactersInPlay, putCharacterInPlay, disconnectCharacterInPlay } = require('./charactersInPlay')
const { documentClient, graphqlClient } = require('./utilities')
const { v4: uuid } = require('/opt/uuid')

describe("getCharactersInPlay", () => {
    it("should return empty when no CharacterInPlay records", async () => {
        documentClient.query.mockReturnValue({ promise: () => (Promise.resolve({ Items: [] })) })
        const data = await getCharactersInPlay()
        expect(data).toEqual([])
    })
    it("should return CharactersInPlay when present", async () => {
        documentClient.query.mockReturnValue({ promise: () => (Promise.resolve({ Items: [
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
        ] })) })
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
    afterEach(() => {
        jest.clearAllMocks()
    })

    it("should return empty when no CharacterId provided", async () => {
        const data = await putCharacterInPlay({ RoomId: '123', Connected: false })
        expect(data).toEqual({})
    })

    it("should correctly fetch RoomId from ephemera table if available", async () => {
        documentClient.get.mockReturnValue({ promise: () => (Promise.resolve({ Item:
            {
                EphemeraId: 'CHARACTERINPLAY#ABC',
                DataCategory: 'Connection',
                RoomId: '123',
                Connected: true
            }
        })) })
        documentClient.put.mockImplementation(({ DataCategory }) => ({ promise: () => (Promise.resolve({ DataCategory })) }))
        const data = await putCharacterInPlay({ CharacterId: 'ABC', Connected: false })
        expect(documentClient.put.mock.calls.length).toBe(1)
        expect(documentClient.put.mock.calls[0][0]).toEqual({
            TableName: 'undefined_ephemera',
            Item: {
                EphemeraId: 'CHARACTERINPLAY#ABC',
                DataCategory: 'Connection',
                RoomId: '123',
                Connected: false
            }
        })
        expect(data).toEqual({
            CharacterId: 'ABC',
            RoomId: '123',
            Connected: false
        })
    })

    it("should correctly fetch RoomId from permanent table if not available in ephemera table", async () => {
        documentClient.get
            .mockReturnValueOnce({ promise: () => (Promise.resolve({ Item: {} })) })
            .mockReturnValueOnce({ promise: () => (Promise.resolve({ Item: {
                PermanentId: 'CHARACTER#ABC',
                DataCategory: 'Details',
                HomeId: '123'
            } })) })
        documentClient.put.mockImplementation(({ DataCategory }) => ({ promise: () => (Promise.resolve({ DataCategory })) }))
        const data = await putCharacterInPlay({ CharacterId: 'ABC', Connected: false })
        expect(documentClient.put.mock.calls.length).toBe(1)
        expect(documentClient.put.mock.calls[0][0]).toEqual({
            TableName: 'undefined_ephemera',
            Item: {
                EphemeraId: 'CHARACTERINPLAY#ABC',
                DataCategory: "Connection",
                RoomId: '123',
                Connected: false
            }
        })
        expect(data).toEqual({
            CharacterId: 'ABC',
            RoomId: '123',
            Connected: false
        })
    })

    it("should correctly place a character in VORTEX if no other room specified", async () => {
        documentClient.get
            .mockReturnValueOnce({ promise: () => (Promise.resolve({ Item: {} })) })
            .mockReturnValue({ promise: () => (Promise.resolve({ Item: {
                PermanentId: 'CHARACTER#ABC',
                DataCategory: 'Details'
            } })) })
        documentClient.put.mockImplementation(({ DataCategory }) => ({ promise: () => (Promise.resolve({ DataCategory })) }))
        const data = await putCharacterInPlay({ CharacterId: 'ABC', Connected: false })
        expect(documentClient.put.mock.calls.length).toBe(1)
        expect(documentClient.put.mock.calls[0][0]).toEqual({
            TableName: 'undefined_ephemera',
            Item: {
                EphemeraId: 'CHARACTERINPLAY#ABC',
                DataCategory: 'Connection',
                RoomId: 'VORTEX',
                Connected: false
            }
        })
        expect(data).toEqual({
            CharacterId: 'ABC',
            RoomId: 'VORTEX',
            Connected: false
        })
    })

    it("should correctly move a character from one room to another", async () => {
        documentClient.get.mockReturnValue({ promise: () => (Promise.resolve({ Item: {
            EphemeraId: 'CHARACTERINPLAY#ABC',
            DataCategory: 'Connection',
            RoomId: 'VORTEX',
            Connected: true
        } })) })
        documentClient.put.mockImplementation(({ DataCategory }) => ({ promise: () => (Promise.resolve({ DataCategory })) }))
        documentClient.delete.mockImplementation(() => ({ promise: () => (Promise.resolve({})) }))
        const data = await putCharacterInPlay({ CharacterId: 'ABC', RoomId: '123' })
        expect(documentClient.put.mock.calls.length).toBe(1)
        expect(documentClient.put.mock.calls[0][0]).toEqual({
            TableName: 'undefined_ephemera',
            Item: {
                EphemeraId: 'CHARACTERINPLAY#ABC',
                DataCategory: 'Connection',
                RoomId: '123',
                Connected: true
            }
        })
        expect(documentClient.delete.mock.calls.length).toBe(0)
        expect(data).toEqual({
            CharacterId: 'ABC',
            RoomId: '123',
            Connected: true
        })
    })
})

describe("disconnectCharacterInPlay", () => {
    afterEach(() => {
        jest.clearAllMocks()
    })

    it("should return empty when no CharacterId provided", async () => {
        const data = await disconnectCharacterInPlay({})
        expect(data).toEqual({})
    })

    it("should correctly notify the room and disconnect with an existing character", async () => {
        documentClient.get
            .mockReturnValueOnce({ promise: () => (Promise.resolve({ Item: {
                EphemeraId: 'CHARACTERINPLAY#ABC',
                DataCategory: 'Connection',
                RoomId: 'VORTEX',
                Connected: true,
                ConnectionId: '123'
            } })) })
            .mockReturnValueOnce({ promise: () => (Promise.resolve({ Item: {
                PermanentId: 'CHARACTER#ABC',
                DataCategory: 'Details',
                Name: 'Testy'
            } })) })
        documentClient.query
            .mockReturnValueOnce({ promise: () => (Promise.resolve({ Items: [{
                EphemeraId: 'CHARACTERINPLAY#ABC',
                DataCategory: 'Connection',
                RoomId: 'VORTEX',
                Connected: true
            },
            {
                EphemeraId: 'CHARACTERINPLAY#DEF',
                DataCategory: 'Connection',
                RoomId: 'VORTEX',
                Connected: true
            },
            {
                EphemeraId: 'CHARACTERINPLAY#GHI',
                DataCategory: 'Connection',
                RoomId: 'VORTEX',
                Connected: false
            }] })) })
        uuid.mockReturnValue('123')
        documentClient.put.mockImplementation(({ DataCategory }) => ({ promise: () => (Promise.resolve({ DataCategory })) }))
        documentClient.delete.mockImplementation(() => ({ promise: () => (Promise.resolve({})) }))
        const data = await disconnectCharacterInPlay({ CharacterId: 'ABC', ConnectionId: '123' })

        const messageGraphQL = `mutation SendMessage {\nupdateMessages (Updates: [ { putMessage: { RoomId: "VORTEX", Message: "Testy has disconnected.", Characters: ["ABC", "DEF"], MessageId: "123" }}])\n}`
        const deleteGraphQL = `mutation DisconnectCharacter {\ndeleteCharacterInPlay (CharacterId: "ABC") {\nCharacterId\nRoomId\nConnected\n}\n}`
        expect(graphqlClient.mutate.mock.calls.length).toBe(2)
        expect(graphqlClient.mutate.mock.calls[0][0]).toEqual({ mutation: messageGraphQL })
        expect(graphqlClient.mutate.mock.calls[1][0]).toEqual({ mutation: deleteGraphQL })

        expect(documentClient.put.mock.calls.length).toBe(0)
        expect(data).toEqual({
            CharacterId: 'ABC',
            RoomId: 'VORTEX',
            Connected: false,
        })
    })

    it("should correctly present a fall-back message when character name cannot be found", async () => {
        documentClient.get
            .mockReturnValueOnce({ promise: () => (Promise.resolve({ Item: {
                EphemeraId: 'CHARACTERINPLAY#ABC',
                DataCategory: 'Connection',
                RoomId: 'VORTEX',
                Connected: true,
                ConnectionId: '123'
            } })) })
            .mockReturnValueOnce({ promise: () => (Promise.resolve({ Item: {
                PermanentId: 'CHARACTER#ABC',
                DataCategory: 'Details'
            } })) })
        documentClient.query
            .mockReturnValueOnce({ promise: () => (Promise.resolve({ Items: [{
                EphemeraId: 'CHARACTERINPLAY#ABC',
                DataCategory: 'Connection',
                RoomId: 'VORTEX',
                Connected: true
            },
            {
                EphemeraId: 'CHARACTERINPLAY#DEF',
                DataCategory: 'Connection',
                RoomId: 'VORTEX',
                Connected: true
            },
            {
                EphemeraId: 'CHARACTERINPLAY#GHI',
                DataCategory: 'Connection',
                RoomId: 'VORTEX',
                Connected: false
            }] })) })
        uuid.mockReturnValue('123')
        documentClient.put.mockImplementation(({ DataCategory }) => ({ promise: () => (Promise.resolve({ DataCategory })) }))
        documentClient.delete.mockImplementation(() => ({ promise: () => (Promise.resolve({})) }))
        const data = await disconnectCharacterInPlay({ CharacterId: 'ABC', ConnectionId: '123' })

        const messageGraphQL = `mutation SendMessage {\nupdateMessages (Updates: [ { putMessage: { RoomId: "VORTEX", Message: "Someone has disconnected.", Characters: ["ABC", "DEF"], MessageId: "123" }}])\n}`
        const deleteGraphQL = `mutation DisconnectCharacter {\ndeleteCharacterInPlay (CharacterId: "ABC") {\nCharacterId\nRoomId\nConnected\n}\n}`
        expect(graphqlClient.mutate.mock.calls.length).toBe(2)
        expect(graphqlClient.mutate.mock.calls[0][0]).toEqual({ mutation: messageGraphQL })
        expect(graphqlClient.mutate.mock.calls[1][0]).toEqual({ mutation: deleteGraphQL })

        expect(documentClient.put.mock.calls.length).toBe(0)
        expect(data).toEqual({
            CharacterId: 'ABC',
            RoomId: 'VORTEX',
            Connected: false,
        })
    })

    it("should do nothing when connection IDs do not match", async () => {
        documentClient.get
            .mockReturnValueOnce({ promise: () => (Promise.resolve({ Item: {
                EphemeraId: 'CHARACTERINPLAY#ABC',
                DataCategory: 'Connection',
                RoomId: 'VORTEX',
                Connected: true,
                ConnectionId: '456'
            } })) })
            .mockReturnValueOnce({ promise: () => (Promise.resolve({ Item: {
                PermanentId: 'CHARACTER#ABC',
                DataCategory: 'Details'
            } })) })
        documentClient.query
            .mockReturnValueOnce({ promise: () => (Promise.resolve({ Items: [{
                EphemeraId: 'CHARACTERINPLAY#ABC',
                DataCategory: 'Connection',
                RoomId: 'VORTEX',
                Connected: true
            },
            {
                EphemeraId: 'CHARACTERINPLAY#DEF',
                DataCategory: 'Connection',
                RoomId: 'VORTEX',
                Connected: true
            },
            {
                EphemeraId: 'CHARACTERINPLAY#GHIU',
                DataCategory: 'Connection',
                RoomId: 'VORTEX',
                Connected: false
            }] })) })
        uuid.mockReturnValue('123')
        documentClient.put.mockImplementation(({ DataCategory }) => ({ promise: () => (Promise.resolve({ DataCategory })) }))
        documentClient.delete.mockImplementation(() => ({ promise: () => (Promise.resolve({})) }))
        const data = await disconnectCharacterInPlay({ CharacterId: 'ABC', ConnectionId: '123' })

        expect(graphqlClient.mutate.mock.calls.length).toBe(0)

        expect(documentClient.put.mock.calls.length).toBe(0)
        expect(data).toEqual({
            CharacterId: 'ABC',
            RoomId: 'VORTEX',
            Connected: true,
        })
    })
})