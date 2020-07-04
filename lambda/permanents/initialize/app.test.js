jest.mock('./utilities', () => ({
    documentClient: {
        get: jest.fn(),
        batchWrite: jest.fn(),
        put: jest.fn()
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
        const data = await handler()

        expect(documentClient.batchWrite.mock.calls.length).toBe(2)
        expect(documentClient.batchWrite.mock.calls[0][0]).toEqual({ RequestItems: { undefined_permanents: roles }})
        expect(documentClient.batchWrite.mock.calls[1][0]).toEqual({ RequestItems: { undefined_permanents: [
            {
                PutRequest: {
                    Item: {
                        PermanentId: 'MAP#ROOT',
                        DataCategory: 'Details',
                        Name: 'Root Map'
                    }
                }
            },
            {
                PutRequest: {
                    Item: {
                        PermanentId: 'MAP#ROOT',
                        DataCategory: 'ROOM#VORTEX',
                        X: 300,
                        Y: 200
                    }
                }
            }
        ]}})
        expect(documentClient.put.mock.calls.length).toBe(1)
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

        expect(data).toEqual({
            statusCode: 200,
            message: 'Initialization complete'
        })
    })

    it("should avoid overwriting existing vortex and map", async () => {
        documentClient.get.mockReturnValue({ promise: () => (Promise.resolve({ Item: { Name: 'Test' } })) })
        documentClient.batchWrite.mockReturnValue({ promise: () => (Promise.resolve({})) })
        documentClient.put.mockReturnValue({ promise: () => (Promise.resolve({})) })
        const data = await handler()

        expect(documentClient.batchWrite.mock.calls.length).toBe(1)
        expect(documentClient.batchWrite.mock.calls[0][0]).toEqual({ RequestItems: { undefined_permanents: roles }})
        expect(documentClient.put.mock.calls.length).toBe(0)

        expect(data).toEqual({
            statusCode: 200,
            message: 'Initialization complete'
        })
    })
})
