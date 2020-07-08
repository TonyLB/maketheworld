jest.mock('../utilities', () => ({
    documentClient: {
        query: jest.fn(),
        batchWrite: jest.fn()
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

const { v4: uuid } = require('/opt/uuid')

const { putCharacter } = require('./putCharacter')
const { documentClient, graphqlClient } = require('../utilities')

const stripMultiline = (value) => (value.split("\n").map((innerVal) => (innerVal.trim())).join('\n'))

const testGQLOutput = stripMultiline(`Neighborhood {
    PermanentId
    Name
    Description
    ParentId
    Visibility
    Topology
    ContextMapId
  }
  Room {
    PermanentId
    Name
    Description
    ParentId
    Visibility
    Topology
  }
  Map {
    MapId
    Name
    Rooms {
      PermanentId
      X
      Y
      Locked
    }
  }
  Settings {
    ChatPrompt
  }
  Role {
      RoleId
      Name
      Actions
  }
  Backup {
    PermanentId
    Name
    Description
    Status
  }
  Character {
    PlayerName
    Name
    CharacterId
    Pronouns
    FirstImpression
    Outfit
    OneCoolThing
    HomeId
  }
  Grant {
    CharacterId
    Resource
    Actions
    Roles
    Revoke
  }
  Exit {
    FromRoomId
    ToRoomId
    Name
    Delete
  }`)

describe("putCharacter", () => {
    afterEach(() => {
        jest.clearAllMocks()
    })

    it("should put a new character", async () => {
        documentClient.batchWrite.mockReturnValue({ promise: () => (Promise.resolve({})) })
        uuid.mockReturnValue('123')
        documentClient.query.mockReturnValue({ promise: () => (Promise.resolve({ Items: [
            {
                PermanentId: 'CHARACTER#123',
                DataCategory: 'GRANT#MINIMUM',
                Roles: 'PLAYER'
            }
        ]})) })
        const data = await putCharacter({
            PlayerName: 'TEST',
            Name: 'Test',
            FirstImpression: 'Testy',
            OneCoolThing: 'The Test',
            Pronouns: 'She/her',
            Outfit:  'Orange jumpsuit',
            HomeId: 'ABC'
        })
        expect(documentClient.batchWrite.mock.calls.length).toBe(1)
        expect(documentClient.batchWrite.mock.calls[0][0]).toEqual({ RequestItems: { undefined_permanents: [
            {
                PutRequest: {
                    Item: {
                        PermanentId: 'CHARACTER#123',
                        DataCategory: 'Details',
                        Name: 'Test',
                        FirstImpression: 'Testy',
                        OneCoolThing: 'The Test',
                        Pronouns: 'She/her',
                        Outfit:  'Orange jumpsuit',
                        HomeId: 'ABC'
                    }
                }
            },
            {
                PutRequest: {
                    Item: {
                        PermanentId: 'PLAYER#TEST',
                        DataCategory: 'CHARACTER#123'
                    }
                }
            },
            {
                PutRequest: {
                    Item: {
                        PermanentId: 'CHARACTER#123',
                        DataCategory: 'GRANT#MINIMUM',
                        Roles: 'PLAYER'
                    }
                }
            }
        ]}})
        expect(graphqlClient.mutate.mock.calls.length).toBe(1)
        expect(graphqlClient.mutate.mock.calls[0][0]).toEqual({ mutation: stripMultiline(`mutation ReportCharacter {
                externalPutCharacter (Name: \"Test\", CharacterId: \"123\", Pronouns: \"She/her\", FirstImpression: \"Testy\", Outfit: \"Orange jumpsuit\", OneCoolThing: \"The Test\", HomeId: \"ABC\") {
                ${testGQLOutput}
                }
                }`)})
        expect(data).toEqual({
            Type: "CHARACTER",
            PlayerName: 'TEST',
            CharacterInfo: {
                CharacterId: '123',
                PlayerName: 'TEST',
                Name: 'Test',
                FirstImpression: 'Testy',
                OneCoolThing: 'The Test',
                Pronouns: 'She/her',
                Outfit:  'Orange jumpsuit',
                HomeId: 'ABC'
            }
        })
    })

    it("should put an existing character", async () => {
        documentClient.batchWrite.mockReturnValue({ promise: () => (Promise.resolve({})) })
        documentClient.query.mockReturnValue({ promise: () => (Promise.resolve({ Items: [
            {
                PermanentId: 'CHARACTER#123',
                DataCategory: 'GRANT#MINIMUM',
                Roles: 'PLAYER'
            }
        ]})) })
        const data = await putCharacter({
            CharacterId: '123',
            PlayerName: 'TEST',
            Name: 'Test',
            FirstImpression: 'Testy',
            OneCoolThing: 'The Test',
            Pronouns: 'She/her',
            Outfit:  'Orange jumpsuit',
            HomeId: 'ABC'
        })
        expect(documentClient.batchWrite.mock.calls.length).toBe(1)
        expect(documentClient.batchWrite.mock.calls[0][0]).toEqual({ RequestItems: { undefined_permanents: [
            {
                PutRequest: {
                    Item: {
                        PermanentId: 'CHARACTER#123',
                        DataCategory: 'Details',
                        Name: 'Test',
                        FirstImpression: 'Testy',
                        OneCoolThing: 'The Test',
                        Pronouns: 'She/her',
                        Outfit:  'Orange jumpsuit',
                        HomeId: 'ABC'
                    }
                }
            },
            {
                PutRequest: {
                    Item: {
                        PermanentId: 'PLAYER#TEST',
                        DataCategory: 'CHARACTER#123'
                    }
                }
            }
        ]}})
        expect(graphqlClient.mutate.mock.calls.length).toBe(1)
        expect(graphqlClient.mutate.mock.calls[0][0]).toEqual({ mutation: stripMultiline(`mutation ReportCharacter {
                externalPutCharacter (Name: \"Test\", CharacterId: \"123\", Pronouns: \"She/her\", FirstImpression: \"Testy\", Outfit: \"Orange jumpsuit\", OneCoolThing: \"The Test\", HomeId: \"ABC\") {
                ${testGQLOutput}
                }
                }`)})
        expect(data).toEqual({
            Type: "CHARACTER",
            PlayerName: 'TEST',
            CharacterInfo: {
                CharacterId: '123',
                PlayerName: 'TEST',
                Name: 'Test',
                FirstImpression: 'Testy',
                OneCoolThing: 'The Test',
                Pronouns: 'She/her',
                Outfit:  'Orange jumpsuit',
                HomeId: 'ABC'
            }
        })
    })
})
