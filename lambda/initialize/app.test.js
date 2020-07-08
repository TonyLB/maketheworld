jest.mock('./utilities', () => ({
    documentClient: {
        get: jest.fn(),
        batchWrite: jest.fn(),
        put: jest.fn(),
        scan: jest.fn(),
        delete: jest.fn()
    }
}))
const { documentClient } = require('./utilities')
const { handler } = require('./app')


describe("initialize", () => {

    const roles = [
        {
            PutRequest: {
                Item: {
                    PermanentId: 'ADMIN',
                    DataCategory: 'ROLE#ADMIN',
                    Name: 'Admin',
                    Actions: 'Admin,View,Edit,Moderate,ExtendPrivate,ExtendPublic,ExtendConnected'
                }
            }
        },
        {
            PutRequest: {
                Item: {
                    PermanentId: 'ADMIN',
                    DataCategory: 'ROLE#MODERATOR',
                    Name: 'Moderator',
                    Actions: 'View,Edit,Moderate,ExtendPrivate,ExtendPublic,ExtendConnected'
                }
            }
        },
        {
            PutRequest: {
                Item: {
                    PermanentId: 'ADMIN',
                    DataCategory: 'ROLE#EDITOR',
                    Name: 'Editor',
                    Actions: 'View,Edit,ExtendPrivate,ExtendPublic,ExtendConnected'
                }
            }
        },
        {
            PutRequest: {
                Item: {
                    PermanentId: 'ADMIN',
                    DataCategory: 'ROLE#PLAYER',
                    Name: 'Player',
                    Actions: 'ExtendPrivate'
                }
            }
        },
        {
            PutRequest: {
                Item: {
                    PermanentId: 'ADMIN',
                    DataCategory: 'ROLE#VIEWER',
                    Name: 'Viewer',
                    Actions: 'View'
                }
            }
        }
    ]

    afterEach(() => {
        jest.clearAllMocks()
    })

    it("should fill an empty database", async () => {
        documentClient.get.mockReturnValue({ promise: () => (Promise.resolve({ Item: {} })) })
        documentClient.batchWrite.mockReturnValue({ promise: () => (Promise.resolve({})) })
        documentClient.put.mockReturnValue({ promise: () => (Promise.resolve({})) })
        documentClient.scan.mockReturnValue({ promise: () => (Promise.resolve({})) })
        const data = await handler()

        expect(documentClient.batchWrite.mock.calls.length).toBe(1)
        expect(documentClient.batchWrite.mock.calls[0][0]).toEqual({ RequestItems: { undefined_permanents: roles }})
        expect(documentClient.put.mock.calls.length).toBe(2)
        expect(documentClient.put.mock.calls[0][0]).toEqual({
            TableName: 'undefined_permanents',
            Item: {
                PermanentId: 'ROOM#VORTEX',
                DataCategory: 'Details',
                Name: 'The Vortex',
                Description: 'A swirling pool of flickering energy, barely thick enough to stand on.',
                Visibility: 'Public'
            }
        })
        expect(documentClient.put.mock.calls[1][0]).toEqual({
            TableName: 'undefined_permanents',
            Item: {
                PermanentId: 'MAP#ROOT',
                DataCategory: 'Details',
                Name: 'Root Map',
                Rooms: [
                    {
                        PermanentId: 'VORTEX',
                        X: 300,
                        Y: 200
                    }
                ]
            }
        })

        expect(data).toEqual({
            statusCode: 200,
            message: 'Initialization complete'
        })
    })

    it("should avoid overwriting existing vortex and map", async () => {
        documentClient.get.mockReturnValue({ promise: () => (Promise.resolve({ Item: { Name: 'Test' } })) })
        documentClient.batchWrite.mockReturnValue({ promise: () => (Promise.resolve({})) })
        documentClient.put.mockReturnValue({ promise: () => (Promise.resolve({})) })
        documentClient.scan.mockReturnValue({ promise: () => (Promise.resolve({})) })
        const data = await handler()

        expect(documentClient.batchWrite.mock.calls.length).toBe(1)
        expect(documentClient.batchWrite.mock.calls[0][0]).toEqual({ RequestItems: { undefined_permanents: roles }})
        expect(documentClient.put.mock.calls.length).toBe(0)

        expect(data).toEqual({
            statusCode: 200,
            message: 'Initialization complete'
        })
    })

    it("should migrate old maps", async () => {
        documentClient.get.mockReturnValue({ promise: () => (Promise.resolve({ Item: { Name: 'Test' } })) })
        documentClient.batchWrite.mockReturnValue({ promise: () => (Promise.resolve({})) })
        documentClient.put.mockReturnValue({ promise: () => (Promise.resolve({})) })
        documentClient.delete.mockReturnValue({ promise: () => (Promise.resolve({})) })
        documentClient.scan.mockReturnValueOnce({ promise: () => (Promise.resolve({
                Items: [
                    {
                        PermanentId: 'MAP#ABC',
                        DataCategory: 'Details',
                        Name: 'Test Map One'
                    },
                    {
                        PermanentId: 'MAP#ABC',
                        DataCategory: 'ROOM#VORTEX',
                        X: 300,
                        Y: 200
                    },
                    {
                        PermanentId: 'MAP#ABC',
                        DataCategory: 'ROOM#123',
                        X: 400,
                        Y: 200,
                        Locked: true
                    },
                    {
                        PermanentId: 'MAP#DEF',
                        DataCategory: 'Details',
                        Name: 'Test Map Two',
                        Rooms: [
                            {
                                PermanentId: 'VORTEX',
                                X: 200,
                                Y: 300,
                                Locked: false
                            }
                        ]
                    },
                    {
                        PermanentId: 'MAP#DEF',
                        DataCategory: 'ROOM#123',
                        X: 400,
                        Y: 300
                    }
                ]
            })) })
            .mockReturnValueOnce({ promise: () => (Promise.resolve({ Items: [] }))})
        const data = await handler()

        expect(documentClient.batchWrite.mock.calls.length).toBe(1)
        expect(documentClient.batchWrite.mock.calls[0][0]).toEqual({ RequestItems: { undefined_permanents: roles }})
        expect(documentClient.put.mock.calls.length).toBe(2)
        expect(documentClient.put.mock.calls[0][0]).toEqual({
            TableName: 'undefined_permanents',
            Item: {
                PermanentId: 'MAP#ABC',
                DataCategory: 'Details',
                Name: 'Test Map One',
                Rooms: [
                    {
                        PermanentId: 'VORTEX',
                        X: 300,
                        Y: 200,
                        Locked: false
                    },
                    {
                        PermanentId: '123',
                        X: 400,
                        Y: 200,
                        Locked: true
                    }
                ]
            }
        })
        expect(documentClient.put.mock.calls[1][0]).toEqual({
            TableName: 'undefined_permanents',
            Item: {
                PermanentId: 'MAP#DEF',
                DataCategory: 'Details',
                Name: 'Test Map Two',
                Rooms: [
                    {
                        PermanentId: 'VORTEX',
                        X: 200,
                        Y: 300,
                        Locked: false
                    },
                    {
                        PermanentId: '123',
                        X: 400,
                        Y: 300,
                        Locked: false
                    }
                ]
            }
        })
        expect(documentClient.delete.mock.calls.length).toBe(3)
        expect(documentClient.delete.mock.calls[0][0]).toEqual({ TableName: 'undefined_permanents', Key: { PermanentId: 'MAP#ABC', DataCategory: 'ROOM#VORTEX' }})
        expect(documentClient.delete.mock.calls[1][0]).toEqual({ TableName: 'undefined_permanents', Key: { PermanentId: 'MAP#ABC', DataCategory: 'ROOM#123' }})
        expect(documentClient.delete.mock.calls[2][0]).toEqual({ TableName: 'undefined_permanents', Key: { PermanentId: 'MAP#DEF', DataCategory: 'ROOM#123' }})

        expect(data).toEqual({
            statusCode: 200,
            message: 'Initialization complete'
        })
    })

    it("should not change new maps", async () => {
        documentClient.get.mockReturnValue({ promise: () => (Promise.resolve({ Item: { Name: 'Test' } })) })
        documentClient.batchWrite.mockReturnValue({ promise: () => (Promise.resolve({})) })
        documentClient.put.mockReturnValue({ promise: () => (Promise.resolve({})) })
        documentClient.delete.mockReturnValue({ promise: () => (Promise.resolve({})) })
        documentClient.scan.mockReturnValueOnce({ promise: () => (Promise.resolve({
                Items: [
                    {
                        PermanentId: 'MAP#ABC',
                        DataCategory: 'Details',
                        Name: 'Test Map One',
                        Rooms: [
                            {
                                PermanentId: 'VORTEX',
                                X: 300,
                                Y: 200,
                                Locked: false
                            },
                            {
                                PermanentId: '123',
                                X: 400,
                                Y: 200,
                                Locked: true
                            }
                        ]
                    }
                ]
            })) })
            .mockReturnValueOnce({ promise: () => (Promise.resolve({ Items: [] }))})
        const data = await handler()

        expect(documentClient.batchWrite.mock.calls.length).toBe(1)
        expect(documentClient.batchWrite.mock.calls[0][0]).toEqual({ RequestItems: { undefined_permanents: roles }})
        expect(documentClient.put.mock.calls.length).toBe(0)
        expect(documentClient.delete.mock.calls.length).toBe(0)

        expect(data).toEqual({
            statusCode: 200,
            message: 'Initialization complete'
        })
    })

    it("should migrate old players", async () => {
        documentClient.get.mockReturnValue({ promise: () => (Promise.resolve({ Item: { Name: 'Test' } })) })
        documentClient.batchWrite.mockReturnValue({ promise: () => (Promise.resolve({})) })
        documentClient.put.mockReturnValue({ promise: () => (Promise.resolve({})) })
        documentClient.delete.mockReturnValue({ promise: () => (Promise.resolve({})) })
        documentClient.scan
            .mockReturnValueOnce({ promise: () => (Promise.resolve({ Items: [] }))})
            .mockReturnValueOnce({ promise: () => (Promise.resolve({
                Items: [
                    {
                        PermanentId: 'PLAYER#TEST',
                        DataCategory: 'Details',
                        PlayerName: 'TEST',
                        CodeOfConductConsent: true,
                        Characters: [ '123' ]
                    },
                    {
                        PermanentId: 'PLAYER#TEST',
                        DataCategory: 'CHARACTER#234'
                    },
                    {
                        PermanentId: 'PLAYER#TEST',
                        DataCategory: 'CHARACTER#345'
                    }
                ]
            })) })
        const data = await handler()

        expect(documentClient.batchWrite.mock.calls.length).toBe(1)
        expect(documentClient.batchWrite.mock.calls[0][0]).toEqual({ RequestItems: { undefined_permanents: roles }})
        expect(documentClient.put.mock.calls.length).toBe(1)
        expect(documentClient.put.mock.calls[0][0]).toEqual({
            TableName: 'undefined_permanents',
            Item: {
                PermanentId: 'PLAYER#TEST',
                DataCategory: 'Details',
                PlayerName: 'TEST',
                CodeOfConductConsent: true,
                Characters: [ '123', '234', '345' ]
            }
        })
        expect(documentClient.delete.mock.calls.length).toBe(2)
        expect(documentClient.delete.mock.calls[0][0]).toEqual({ TableName: 'undefined_permanents', Key: { PermanentId: 'PLAYER#TEST', DataCategory: 'CHARACTER#234' }})
        expect(documentClient.delete.mock.calls[1][0]).toEqual({ TableName: 'undefined_permanents', Key: { PermanentId: 'PLAYER#TEST', DataCategory: 'CHARACTER#345' }})

        expect(data).toEqual({
            statusCode: 200,
            message: 'Initialization complete'
        })
    })

    it("should not change new players", async () => {
        documentClient.get.mockReturnValue({ promise: () => (Promise.resolve({ Item: { Name: 'Test' } })) })
        documentClient.batchWrite.mockReturnValue({ promise: () => (Promise.resolve({})) })
        documentClient.put.mockReturnValue({ promise: () => (Promise.resolve({})) })
        documentClient.delete.mockReturnValue({ promise: () => (Promise.resolve({})) })
        documentClient.scan
            .mockReturnValueOnce({ promise: () => (Promise.resolve({ Items: [] }))})
            .mockReturnValue({ promise: () => (Promise.resolve({
                Items: [
                    {
                        PermanentId: 'PLAYER#TEST',
                        DataCategory: 'Details',
                        PlayerName: 'TEST',
                        CodeOfConductConsent: true,
                        Characters: [ '123', '234', '456' ]
                    }
                ]
            })) })
        const data = await handler()

        expect(documentClient.batchWrite.mock.calls.length).toBe(1)
        expect(documentClient.batchWrite.mock.calls[0][0]).toEqual({ RequestItems: { undefined_permanents: roles }})
        expect(documentClient.put.mock.calls.length).toBe(0)
        expect(documentClient.delete.mock.calls.length).toBe(0)

        expect(data).toEqual({
            statusCode: 200,
            message: 'Initialization complete'
        })
    })
})
