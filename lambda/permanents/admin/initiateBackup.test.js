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
    s3Client: {
        putObject: jest.fn(() => ({ promise: Promise.resolve({}) })),
    },
    gql: jest.fn((strings, ...args) => {
        const returnVal = args.map((arg, index) => (strings[index] + arg)).join("") + strings[args.length]
        return returnVal.split("\n").map((innerVal) => (innerVal.trim())).join('\n')
    })
}))
const { serializeV2 } = require('./initiateBackup')
const { documentClient, graphqlClient } = require('./utilities')

describe("serializeV2", () => {
    it("should save empty backup when no permanents data", () => {
        const data = serializeV2([])
        expect(data).toEqual({
            Neighborhoods: [],
            Rooms: [],
            Players: [],
            Maps: []
        })
    })

    it("should save neighborhoods", () => {
        const data = serializeV2([{
            PermanentId: 'NEIGHBORHOOD#ABC',
            DataCategory: 'Details',
            Name: 'Test',
            Description: 'Test 1',
            Visibility: 'Private',
            Topology: 'Connected'
        },
        {
            PermanentId: 'NEIGHBORHOOD#DEF',
            DataCategory: 'Details',
            ParentId: 'ABC',
            Name: 'TestTwo',
            Description: 'Test 2',
            Visibility: 'Public',
            Topology: 'Dead-End',
            Retired: 'RETIRED'
        }])
        expect(data).toEqual({
            Neighborhoods: [
                {
                    PermanentId: 'ABC',
                    Name: 'Test',
                    Description: 'Test 1',
                    Visibility: 'Private',
                    Topology: 'Connected',
                    Retired: false
                },
                {
                    PermanentId: 'DEF',
                    ParentId: 'ABC',
                    Name: 'TestTwo',
                    Description: 'Test 2',
                    Visibility: 'Public',
                    Topology: 'Dead-End',
                    Retired: true
                }
            ],
            Rooms: [],
            Players: [],
            Maps: []
        })
    })

    it("should save rooms", () => {
        const data = serializeV2([{
            PermanentId: 'NEIGHBORHOOD#ABC',
            DataCategory: 'Details',
            Name: 'Test',
            Description: 'Test 1',
            Visibility: 'Private',
            Topology: 'Connected'
        },
        {
            PermanentId: 'ROOM#VORTEX',
            DataCategory: 'Details',
            Name: 'The Vortex',
            Description: 'Existentially shiny'
        },
        {
            PermanentId: 'ROOM#DEF',
            DataCategory: 'Details',
            ParentId: 'ABC',
            Name: 'TestRoomOne',
            Description: 'Test Room 1'
        },
        {
            PermanentId: 'ROOM#GHI',
            DataCategory: 'Details',
            ParentId: 'ABC',
            Name: 'TestRoomTwo',
            Description: 'Test Room 2',
            Retired: 'RETIRED'
        }])
        expect(data).toEqual({
            Neighborhoods: [
                {
                    PermanentId: 'ABC',
                    Name: 'Test',
                    Description: 'Test 1',
                    Visibility: 'Private',
                    Topology: 'Connected',
                    Retired: false,
                    Rooms: [
                        'DEF',
                        'GHI'
                    ]
                }
            ],
            Rooms: [
                {
                    PermanentId: 'VORTEX',
                    Name: 'The Vortex',
                    Description: 'Existentially shiny',
                    Retired: false,
                    Exits: [],
                    Entries: []
                },
                {
                    PermanentId: 'DEF',
                    ParentId: 'ABC',
                    Name: 'TestRoomOne',
                    Description: 'Test Room 1',
                    Retired: false,
                    Exits: [],
                    Entries: []
                },
                {
                    PermanentId: 'GHI',
                    ParentId: 'ABC',
                    Name: 'TestRoomTwo',
                    Description: 'Test Room 2',
                    Retired: true,
                    Exits: [],
                    Entries: []
                }
            ],
            Players: [],
            Maps: []
        })
    })

    it("should save exits", () => {
        const data = serializeV2([{
            PermanentId: 'NEIGHBORHOOD#ABC',
            DataCategory: 'Details',
            Name: 'Test',
            Description: 'Test 1',
            Visibility: 'Private',
            Topology: 'Connected'
        },
        {
            PermanentId: 'ROOM#VORTEX',
            DataCategory: 'Details',
            Name: 'The Vortex',
            Description: 'Existentially shiny'
        },
        {
            PermanentId: 'ROOM#DEF',
            DataCategory: 'Details',
            ParentId: 'ABC',
            Name: 'TestRoomOne',
            Description: 'Test Room 1'
        },
        {
            PermanentId: 'ROOM#VORTEX',
            DataCategory: 'EXIT#DEF',
            Name: 'test'
        },
        {
            PermanentId: 'ROOM#DEF',
            DataCategory: 'ENTRY#VORTEX',
            Name: 'test'
        }])
        expect(data).toEqual({
            Neighborhoods: [
                {
                    PermanentId: 'ABC',
                    Name: 'Test',
                    Description: 'Test 1',
                    Visibility: 'Private',
                    Topology: 'Connected',
                    Retired: false,
                    Rooms: ['DEF']
                }
            ],
            Rooms: [
                {
                    PermanentId: 'VORTEX',
                    Name: 'The Vortex',
                    Description: 'Existentially shiny',
                    Retired: false,
                    Exits: [{
                        ParentId: 'DEF',
                        FromRoomId: 'VORTEX',
                        Name: 'test'
                    }],
                    Entries: []
                },
                {
                    PermanentId: 'DEF',
                    ParentId: 'ABC',
                    Name: 'TestRoomOne',
                    Description: 'Test Room 1',
                    Retired: false,
                    Exits: [],
                    Entries: [{
                        ParentId: 'DEF',
                        FromRoomId: 'VORTEX',
                        Name: 'test'
                    }]
                }
            ],
            Players: [],
            Maps: []
        })
    })

    it("should save players and characters", () => {
        const data = serializeV2([{
            PermanentId: 'PLAYER#TEST',
            DataCategory: 'Details',
            CodeOfConductConsent: true
        },
        {
            PermanentId: 'CHARACTER#123',
            DataCategory: 'Details',
            Name: 'Testo'
        },
        {
            PermanentId: 'PLAYER#TEST',
            DataCategory: 'CHARACTER#123'
        }])
        expect(data).toEqual({
            Neighborhoods: [],
            Rooms: [],
            Players: [{
                PlayerName: 'TEST',
                CodeOfConductConsent: true,
                Characters: [{
                    CharacterId: '123',
                    Name: 'Testo',
                    Grants: []
                }]
            }],
            Maps: []
        })
    })

    it("should save player grants", () => {
        const data = serializeV2([{
            PermanentId: 'NEIGHBORHOOD#ABC',
            DataCategory: 'Details',
            Name: 'Test',
            Description: 'Test 1',
            Visibility: 'Private',
            Topology: 'Connected'
        },
        {
            PermanentId: 'PLAYER#TEST',
            DataCategory: 'Details',
            CodeOfConductConsent: true
        },
        {
            PermanentId: 'CHARACTER#123',
            DataCategory: 'Details',
            Name: 'Testo'
        },
        {
            PermanentId: 'CHARACTER#123',
            DataCategory: 'GRANT#ABC',
            Actions: 'Edit'
        },
        {
            PermanentId: 'PLAYER#TEST',
            DataCategory: 'CHARACTER#123'
        }])
        expect(data).toEqual({
            Neighborhoods: [
                {
                    PermanentId: 'ABC',
                    Name: 'Test',
                    Description: 'Test 1',
                    Visibility: 'Private',
                    Topology: 'Connected',
                    Retired: false
                }
            ],
            Rooms: [],
            Players: [{
                PlayerName: 'TEST',
                CodeOfConductConsent: true,
                Characters: [{
                    CharacterId: '123',
                    Name: 'Testo',
                    Grants: [{
                        Resource: 'ABC',
                        Actions: 'Edit'
                    }]
                }]
            }],
            Maps: []
        })
    })

    it("should save maps", () => {
        const data = serializeV2([{
            PermanentId: 'NEIGHBORHOOD#ABC',
            DataCategory: 'Details',
            Name: 'Test',
            Description: 'Test 1',
            Visibility: 'Private',
            Topology: 'Connected'
        },
        {
            PermanentId: 'MAP#123',
            DataCategory: 'Details',
            Name: 'Test Map',
        },
        {
            PermanentId: 'MAP#123',
            DataCategory: 'ROOM#VORTEX',
            X: 300,
            Y: 200
        },
        {
            PermanentId: 'MAP#123',
            DataCategory: 'ROOM#DEF',
            X: 400,
            Y: 200
        },
        {
            PermanentId: 'ROOM#VORTEX',
            DataCategory: 'Details',
            Name: 'The Vortex',
            Description: 'Existentially shiny'
        },
        {
            PermanentId: 'ROOM#DEF',
            DataCategory: 'Details',
            ParentId: 'ABC',
            Name: 'TestRoomOne',
            Description: 'Test Room 1'
        },
        {
            PermanentId: 'ROOM#VORTEX',
            DataCategory: 'EXIT#DEF',
            Name: 'test'
        },
        {
            PermanentId: 'ROOM#DEF',
            DataCategory: 'ENTRY#VORTEX',
            Name: 'test'
        }])
        expect(data).toEqual({
            Neighborhoods: [
                {
                    PermanentId: 'ABC',
                    Name: 'Test',
                    Description: 'Test 1',
                    Visibility: 'Private',
                    Topology: 'Connected',
                    Retired: false,
                    Rooms: ['DEF']
                }
            ],
            Rooms: [
                {
                    PermanentId: 'VORTEX',
                    Name: 'The Vortex',
                    Description: 'Existentially shiny',
                    Retired: false,
                    Exits: [{
                        ParentId: 'DEF',
                        FromRoomId: 'VORTEX',
                        Name: 'test'
                    }],
                    Entries: []
                },
                {
                    PermanentId: 'DEF',
                    ParentId: 'ABC',
                    Name: 'TestRoomOne',
                    Description: 'Test Room 1',
                    Retired: false,
                    Exits: [],
                    Entries: [{
                        ParentId: 'DEF',
                        FromRoomId: 'VORTEX',
                        Name: 'test'
                    }]
                }
            ],
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
                    RoomId: 'DEF',
                    X: 400,
                    Y: 200
                }]
            }]
        })
    })
})
