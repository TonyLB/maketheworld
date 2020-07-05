jest.mock('../utilities', () => ({
    documentClient: {
        batchWrite: jest.fn()
    }
}))
const { deserialize } = require('./restoreBackup')
const { documentClient, graphqlClient } = require('../utilities')

describe("deserialize", () => {
    afterEach(() => {
        jest.clearAllMocks()
    })

    it("should make no change on an empty backup", () => {
        const data = deserialize({
            Neighborhoods: [],
            Rooms: [],
            Players: [],
            Maps: []
        })
        expect(data).toEqual([])
    })

    it("should save player changes", () => {
        const data = deserialize({
            Neighborhoods: [],
            Rooms: [],
            Players: [{
                PlayerName: 'Test',
                CodeOfConductConsent: true,
                Characters: [{
                    CharacterId: '123',
                    Name: 'TestOne',
                    Grants: [{
                        Resource: 'VORTEX',
                        Actions: 'Edit'
                    }]
                },
                {
                    CharacterId: '456',
                    Name: 'TestTwo'
                }]
            }],
            Maps: []
        })
        expect(data).toEqual([
            {
                PutRequest: {
                    Item: {
                        PermanentId: 'PLAYER#Test',
                        DataCategory: 'Details',
                        CodeOfConductConsent: true
                    }
                }
            },
            {
                PutRequest: {
                    Item: {
                        PermanentId: 'PLAYER#Test',
                        DataCategory: 'CHARACTER#123'
                    }
                }
            },
            {
                PutRequest: {
                    Item: {
                        PermanentId: 'CHARACTER#123',
                        DataCategory: 'Details',
                        Name: 'TestOne'
                    }
                }
            },
            {
                PutRequest: {
                    Item: {
                        PermanentId: 'CHARACTER#123',
                        DataCategory: 'GRANT#VORTEX',
                        Actions: 'Edit'
                    }
                }
            },
            {
                PutRequest: {
                    Item: {
                        PermanentId: 'PLAYER#Test',
                        DataCategory: 'CHARACTER#456'
                    }
                }
            },
            {
                PutRequest: {
                    Item: {
                        PermanentId: 'CHARACTER#456',
                        DataCategory: 'Details',
                        Name: 'TestTwo'
                    }
                }
            }
        ])
    })

    it("should save neighborhoods", () => {
        const data = deserialize({
            Neighborhoods: [{
                PermanentId: 'ABC',
                Name: 'Test One',
                Description: 'A testing place',
                Visibility: 'Public',
                Topology: 'Connected',
                ContextMapId: '123',
                Retired: false
            },
            {
                PermanentId: 'DEF',
                Name: 'Test Two',
                Description: 'A smaller neighborhood',
                ParentId: 'ABC',
                Visibility: 'Private',
                Topology: 'Dead-End',
                Retired: 'true'
            }],
            Rooms: [],
            Players: [],
            Maps: []
        })
        expect(data).toEqual([{
            PutRequest: {
                Item: {
                    PermanentId: 'NEIGHBORHOOD#ABC',
                    DataCategory: 'Details',
                    Name: 'Test One',
                    Description: 'A testing place',
                    Visibility: 'Public',
                    Topology: 'Connected',
                    ContextMapId: '123'
                }
            }
        },
        {
            PutRequest: {
                Item: {
                    PermanentId: 'NEIGHBORHOOD#DEF',
                    DataCategory: 'Details',
                    ParentId: 'ABC',
                    Name: 'Test Two',
                    Description: 'A smaller neighborhood',
                    Visibility: 'Private',
                    Topology: 'Dead-End',
                    Retired: 'RETIRED'
                }
            }
        }])
    })

    it("should save maps", () => {
        const data = deserialize({
            Neighborhoods: [],
            Rooms: [],
            Players: [],
            Maps: [{
                PermanentId: '123',
                Name: 'Test Map',
                Rooms: [{
                    RoomId: 'VORTEX',
                    X: 300,
                    Y: 200
                },
                {
                    RoomId: 'ABC',
                    X: 400,
                    Y: 200
                }]
            }]
        })
        expect(data).toEqual([{
            PutRequest: {
                Item: {
                    PermanentId: 'MAP#123',
                    DataCategory: 'Details',
                    Name: 'Test Map'
                }
            }
        },
        {
            PutRequest: {
                Item: {
                    PermanentId: 'MAP#123',
                    DataCategory: 'ROOM#VORTEX',
                    X: 300,
                    Y: 200
                }
            }
        },
        {
            PutRequest: {
                Item: {
                    PermanentId: 'MAP#123',
                    DataCategory: 'ROOM#ABC',
                    X: 400,
                    Y: 200
                }
            }
        }])
    })

    it("should save rooms", () => {
        const data = deserialize({
            Neighborhoods: [{
                PermanentId: 'ABC',
                Name: 'Test One',
                Description: 'A testing place',
                Visibility: 'Public',
                Topology: 'Connected',
                Retired: false
            }],
            Rooms: [{
                PermanentId: 'VORTEX',
                Name: 'The Vortex',
                Description: 'Swirly!',
                Exits: [{
                    ParentId: '123',
                    FromRoomId: 'VORTEX',
                    Name: 'test'
                }],
                Entries: []
            },
            {
                PermanentId: '123',
                Name: 'Test',
                Description: 'Testy!',
                Exits: [],
                Entries: [{
                    ParentId: '123',
                    FromRoomId: 'VORTEX',
                    Name: 'test'
                }]
            }],
            Players: [],
            Maps: []
        })
        expect(data).toEqual([{
            PutRequest: {
                Item: {
                    PermanentId: 'NEIGHBORHOOD#ABC',
                    DataCategory: 'Details',
                    Name: 'Test One',
                    Description: 'A testing place',
                    Visibility: 'Public',
                    Topology: 'Connected'
                }
            }
        },
        {
            PutRequest: {
                Item: {
                    PermanentId: 'ROOM#VORTEX',
                    DataCategory: 'Details',
                    Name: 'The Vortex',
                    Description: 'Swirly!',
                    Visibility: 'Public'
                }
            }
        },
        {
            PutRequest: {
                Item: {
                    PermanentId: 'ROOM#123',
                    DataCategory: 'Details',
                    Name: 'Test',
                    Description: 'Testy!',
                    Visibility: 'Public'
                }
            }
        },
        {
            PutRequest: {
                Item: {
                    PermanentId: 'ROOM#123',
                    DataCategory: 'ENTRY#VORTEX',
                    Name: 'test'
                }
            }
        },
        {
            PutRequest: {
                Item: {
                    PermanentId: 'ROOM#VORTEX',
                    DataCategory: 'EXIT#123',
                    Name: 'test'
                }
            }
        }])
    })
})
