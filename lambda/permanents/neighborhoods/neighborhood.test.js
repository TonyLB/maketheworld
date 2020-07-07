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
        const data = await getNeighborhood({ PermanentId: '123' })
        expect(documentClient.get.mock.calls.length).toBe(1)
        expect(data).toEqual({
            PermanentId: '123',
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
        const data = await getNeighborhood({ PermanentId: '123' })
        expect(documentClient.get.mock.calls.length).toBe(1)
        expect(data).toEqual({
            PermanentId: '123',
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
        const data = await getNeighborhood({ PermanentId: '123' })
        expect(documentClient.get.mock.calls.length).toBe(1)
        expect(data).toEqual({
            PermanentId: '123',
            Retired: true,
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
        documentClient.put.mockReturnValue({ promise: () => (Promise.resolve({})) })
        v4.mockReturnValue('123')
        const data = await putNeighborhood({ arguments: {
            CharacterId: 'ABC',
            Name: 'Test',
            Description: 'A test description',
            ParentId: '987'
        }})
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

        documentClient.put.mockReturnValue({ promise: () => (Promise.resolve({})) })
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
