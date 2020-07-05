jest.mock('../utilities', () => ({
    documentClient: {
        query: jest.fn(() => ({ promise: jest.fn() })),
        batchWrite: jest.fn(),
        scan: jest.fn(),
        get: jest.fn(),
        put: jest.fn()
    },
    graphqlClient: {
        mutate: jest.fn()
    },
    gql: jest.fn((strings, ...args) => {
        const returnVal = args.map((arg, index) => (strings[index] + arg)).join("") + strings[args.length]
        return returnVal.split("\n").map((innerVal) => (innerVal.trim())).join('\n')
    })
}))

jest.mock('/opt/uuid', () => ({
    v4: jest.fn()
}))

const stripMultiline = (value) => (value.split("\n").map((innerVal) => (innerVal.trim())).join('\n'))

const { documentClient, graphqlClient } = require('../utilities')
const { getNeighborhood, putNeighborhood } = require('./neighborhood')
const { v4 } = require('/opt/uuid')

describe("getNeighborhood", () => {
    afterEach(() => {
        jest.clearAllMocks()
    })

    it('should return default from an empty scan', async () => {
        documentClient.get.mockReturnValue({ promise: () => (Promise.resolve({ Item: {} }))})
        const queryPromise = jest.fn().mockResolvedValue({ Items: [] })
        documentClient.query.mockReturnValue({ promise: queryPromise })
        const data = await getNeighborhood({ PermanentId: '123' })
        expect(documentClient.get.mock.calls.length).toBe(1)
        expect(documentClient.query.mock.calls.length).toBe(1)
        expect(data).toEqual({
            PermanentId: '123',
            Grants: [],
            Retired: false,
            Visibility: 'Private',
            Topology: 'Dead-End'
        })
    })

    it('should return details correctly', async () => {
        documentClient.get.mockReturnValue({ promise: () => (Promise.resolve({ Item: {
            PermanentId: 'NEIGHBORHOOD#123',
            DataCategory: 'Details',
            Name: 'Test',
            Description: 'A test description',
            Visibility: 'Public',
            Topology: 'Connected'
        } }))})
        const queryPromise = jest.fn().mockResolvedValue({ Items: [] })
        documentClient.query.mockReturnValue({ promise: queryPromise })
        const data = await getNeighborhood({ PermanentId: '123' })
        expect(documentClient.get.mock.calls.length).toBe(1)
        expect(documentClient.query.mock.calls.length).toBe(1)
        expect(data).toEqual({
            PermanentId: '123',
            Grants: [],
            Retired: false,
            Name: 'Test',
            Description: 'A test description',
            Visibility: 'Public',
            Topology: 'Connected'
        })
    })

    it('should return the retired flag correctly', async () => {
        documentClient.get.mockReturnValue({ promise: () => (Promise.resolve({ Item: {
            PermanentId: 'NEIGHBORHOOD#123',
            DataCategory: 'Details',
            Name: 'Test',
            Description: 'A test description',
            Retired: 'RETIRED'
        } }))})
        const queryPromise = jest.fn().mockResolvedValue({ Items: [] })
        documentClient.query.mockReturnValue({ promise: queryPromise })
        const data = await getNeighborhood({ PermanentId: '123' })
        expect(documentClient.get.mock.calls.length).toBe(1)
        expect(documentClient.query.mock.calls.length).toBe(1)
        expect(data).toEqual({
            PermanentId: '123',
            Grants: [],
            Retired: true,
            Name: 'Test',
            Description: 'A test description',
            Visibility: 'Private',
            Topology: 'Dead-End'
        })
    })

    it('should return grants correctly', async () => {
        documentClient.get.mockReturnValue({ promise: () => (Promise.resolve({ Item: {
            PermanentId: 'NEIGHBORHOOD#123',
            DataCategory: 'Details',
            Name: 'Test',
            Description: 'A test description'
        } }))})
        const queryPromise = jest.fn().mockResolvedValue({ Items: [
            {
                PermanentId: 'CHARACTER#ABC',
                DataCategory: 'GRANT#123',
                Roles: 'EDITOR'
            },
            {
                PermanentId: 'CHARACTER#DEF',
                DataCategory: 'GRANT#123',
                Actions: 'View'
            }
        ] })
        documentClient.query.mockReturnValue({ promise: queryPromise })
        const data = await getNeighborhood({ PermanentId: '123' })
        expect(documentClient.get.mock.calls.length).toBe(1)
        expect(documentClient.query.mock.calls.length).toBe(1)
        expect(data).toEqual({
            PermanentId: '123',
            Grants: [
                {
                    CharacterId: 'ABC',
                    Roles: 'EDITOR'
                },
                {
                    CharacterId: 'DEF',
                    Actions: 'View'
                }
            ],
            Retired: false,
            Name: 'Test',
            Description: 'A test description',
            Visibility: 'Private',
            Topology: 'Dead-End'
        })
    })

})

const testGQLOutput = `{
    Type
    PlayerName
    PlayerInfo {
      PlayerName
      CodeOfConductConsent
    }
    CharacterInfo {
      PlayerName
      Name
      CharacterId
      Pronouns
      FirstImpression
      Outfit
      OneCoolThing
      HomeId
    }
    GrantInfo {
      CharacterId
      Resource
      Actions
      Roles
    }
}`

describe("putNeighborhood", () => {
    afterEach(() => {
        jest.clearAllMocks()
    })

    it('should create a new neighborhood', async () => {
        documentClient.get.mockReturnValue({ promise: () => (Promise.resolve({ Item: {} }))})
        const queryPromise = jest.fn()
            .mockResolvedValueOnce({ Items: [
                {
                    PermanentId: 'PLAYER#TEST',
                    DataCategory: 'CHARACTER#ABC'
                }
            ] })
            .mockResolvedValueOnce({ Items: [
                {
                    PermanentId: 'PLAYER#TEST',
                    DataCategory: 'CHARACTER#ABC'
                }
            ] })
        documentClient.query.mockReturnValue({ promise: queryPromise })
        documentClient.batchWrite.mockReturnValue({ promise: () => (Promise.resolve({})) })
        documentClient.put.mockReturnValue({ promise: () => (Promise.resolve({})) })
        v4.mockReturnValue('123')
        const data = await putNeighborhood({ arguments: {
            CharacterId: 'ABC',
            Name: 'Test',
            Description: 'A test description',
            ParentId: '987'
        }})
        expect(documentClient.batchWrite.mock.calls.length).toBe(1)
        expect(documentClient.batchWrite.mock.calls[0][0]).toEqual({ RequestItems: { undefined_permanents: [
            {
                PutRequest: {
                    Item: {
                        PermanentId: 'CHARACTER#ABC',
                        DataCategory: 'GRANT#123',
                        Roles: 'EDITOR'
                    }
                }
            }
        ]}})
        expect(graphqlClient.mutate.mock.calls.length).toBe(1)
        expect(graphqlClient.mutate.mock.calls[0][0]).toEqual({
            mutation: stripMultiline(`mutation GrantUpdates {
                update1: externalUpdateGrant (
                    PlayerName: "TEST",
                    CharacterId: "ABC",
                    Type: "GRANT",
                    Grant: {
                        CharacterId: "ABC",
                        Resource: "123",
                        Roles: "EDITOR",
                        Actions: ""
                    }
                ) ${testGQLOutput} }`)
        })
        expect(documentClient.put.mock.calls.length).toBe(1)
        expect(documentClient.put.mock.calls[0][0]).toEqual({
            TableName: 'undefined_permanents',
            Item: {
                PermanentId: 'NEIGHBORHOOD#123',
                DataCategory: 'Details',
                ParentId: '987',
                Name: 'Test',
                Description: 'A test description',
                Topology: 'Dead-End',
                Visibility: 'Private'
            },
            ReturnValues: 'ALL_OLD'
        })
        expect(data).toEqual([
            {
                Map: null,
                Room: null,
                Neighborhood: {
                    PermanentId: '123',
                    ParentId: '987',
                    Grants: [
                        {
                            CharacterId: 'ABC',
                            Resource: '123',
                            Roles: 'EDITOR'
                        }
                    ],
                    Name: 'Test',
                    Description: 'A test description',
                    Retired: false,
                    Visibility: 'Private',
                    Topology: 'Dead-End'
                }
            }
        ])
    })

    it('should update an existing neighborhood', async () => {
        documentClient.get.mockReturnValue({ promise: () => (Promise.resolve({ Item: {
            PermanentId: 'NEIGHBORHOOD#123',
            ParentId: '654',
            DataCategory: 'Details',
            Name: 'Old Name',
            Description: 'Old Description',
            Visibility: 'Private',
            Topology: 'Dead-End'
        } }))})
        const queryPromise = jest.fn()
            .mockResolvedValueOnce({ Items: [
                {
                    PermanentId: 'CHARACTER#DEF',
                    DataCategory: 'GRANT#123',
                    Roles: 'EDITOR'
                },
                {
                    PermanentId: 'CHARACTER#GHI',
                    DataCategory: 'GRANT#123',
                    Roles: 'EDITOR'
                }
            ] })
            .mockResolvedValueOnce({ Items: [
                {
                    PermanentId: 'PLAYER#TEST',
                    DataCategory: 'CHARACTER#ABC'
                }
            ] })
            .mockResolvedValueOnce({ Items: [
                {
                    PermanentId: 'PLAYER#TEST',
                    DataCategory: 'CHARACTER#ABC'
                }
            ] })
            .mockResolvedValueOnce({ Items: [
                {
                    PermanentId: 'PLAYER#TEST',
                    DataCategory: 'CHARACTER#DEF'
                }
            ] })
            .mockResolvedValueOnce({ Items: [
                {
                    PermanentId: 'PLAYER#TEST',
                    DataCategory: 'CHARACTER#DEF'
                }
            ] })
            .mockResolvedValueOnce({ Items: [
                {
                    PermanentId: 'PLAYER#TEST',
                    DataCategory: 'CHARACTER#GHI'
                }
            ] })
            .mockResolvedValueOnce({ Items: [
                {
                    PermanentId: 'PLAYER#TEST',
                    DataCategory: 'CHARACTER#GHI'
                }
            ] })
        documentClient.query.mockReturnValue({ promise: queryPromise })
        documentClient.batchWrite.mockReturnValue({ promise: () => (Promise.resolve({})) })
        documentClient.put.mockReturnValue({ promise: () => (Promise.resolve({})) })
        v4.mockReturnValue('123')
        const data = await putNeighborhood({ arguments: {
            PermanentId: '123',
            CharacterId: 'ABC',
            Name: 'Test',
            Description: 'A test description',
            ParentId: '987',
            Visibility: 'Public',
            Topology: 'Connected',
            Grants: [
                {
                    CharacterId: 'ABC',
                    Resource: '123',
                    Roles: 'EDITOR'
                },
                {
                    CharacterId: 'DEF',
                    Resource: '123',
                    Roles: 'VIEWER'
                }
            ]
        }})
        expect(documentClient.batchWrite.mock.calls.length).toBe(1)
        expect(documentClient.batchWrite.mock.calls[0][0]).toEqual({ RequestItems: { undefined_permanents: [
            {
                DeleteRequest: {
                    Key: {
                        PermanentId: 'CHARACTER#GHI',
                        DataCategory: 'GRANT#123'
                    }
                }
            },
            {
                PutRequest: {
                    Item: {
                        PermanentId: 'CHARACTER#ABC',
                        DataCategory: 'GRANT#123',
                        Roles: 'EDITOR'
                    }
                }
            },
            {
                PutRequest: {
                    Item: {
                        PermanentId: 'CHARACTER#DEF',
                        DataCategory: 'GRANT#123',
                        Roles: 'VIEWER'
                    }
                }
            }
        ]}})
        expect(graphqlClient.mutate.mock.calls.length).toBe(1)
        expect(graphqlClient.mutate.mock.calls[0][0]).toEqual({
            mutation: stripMultiline(`mutation GrantUpdates {
                update1: externalUpdateGrant (
                    PlayerName: "TEST",
                    CharacterId: "GHI",
                    Type: "REVOKE",
                    Grant: {
                        CharacterId: "GHI",
                        Resource: "123"
                    }
                ) ${testGQLOutput}
                update2: externalUpdateGrant (
                    PlayerName: "TEST",
                    CharacterId: "ABC",
                    Type: "GRANT",
                    Grant: {
                        CharacterId: "ABC",
                        Resource: "123",
                        Roles: "EDITOR",
                        Actions: ""
                    }
                ) ${testGQLOutput}
                update3: externalUpdateGrant (
                    PlayerName: "TEST",
                    CharacterId: "DEF",
                    Type: "GRANT",
                    Grant: {
                        CharacterId: "DEF",
                        Resource: "123",
                        Roles: "VIEWER",
                        Actions: ""
                    }
                ) ${testGQLOutput} }`)
        })
        expect(documentClient.put.mock.calls.length).toBe(1)
        expect(documentClient.put.mock.calls[0][0]).toEqual({
            TableName: 'undefined_permanents',
            Item: {
                PermanentId: 'NEIGHBORHOOD#123',
                DataCategory: 'Details',
                ParentId: '987',
                Name: 'Test',
                Description: 'A test description',
                Topology: 'Connected',
                Visibility: 'Public'
            },
            ReturnValues: 'ALL_OLD'
        })
        expect(data).toEqual([
            {
                Map: null,
                Room: null,
                Neighborhood: {
                    PermanentId: '123',
                    ParentId: '987',
                    Grants: [
                        {
                            CharacterId: 'ABC',
                            Resource: '123',
                            Roles: 'EDITOR'
                        },
                        {
                            CharacterId: 'DEF',
                            Resource: '123',
                            Roles: 'VIEWER'
                        }
                    ],
                    Name: 'Test',
                    Description: 'A test description',
                    Retired: false,
                    Visibility: 'Public',
                    Topology: 'Connected'
                }
            }
        ])
    })

})
