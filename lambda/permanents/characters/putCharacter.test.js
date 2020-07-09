jest.mock('../utilities', () => ({
    documentClient: {
        query: jest.fn(),
        put: jest.fn()
    }
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
        documentClient.put.mockReturnValue({ promise: () => (Promise.resolve({})) })
        uuid.mockReturnValue('123')
        const data = await putCharacter({
            Name: 'Test',
            FirstImpression: 'Testy',
            OneCoolThing: 'The Test',
            Pronouns: 'She/her',
            Outfit:  'Orange jumpsuit',
            HomeId: 'ABC'
        })
        expect(documentClient.put.mock.calls.length).toBe(1)
        expect(documentClient.put.mock.calls[0][0]).toEqual({
            TableName: 'undefined_permanents',
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
        })
        expect(data).toEqual([{ Character:
            {
                CharacterId: '123',
                Name: 'Test',
                FirstImpression: 'Testy',
                OneCoolThing: 'The Test',
                Pronouns: 'She/her',
                Outfit:  'Orange jumpsuit',
                HomeId: 'ABC'
            }
        }])
    })

    it("should put an existing character", async () => {
        documentClient.put.mockReturnValue({ promise: () => (Promise.resolve({})) })
        const data = await putCharacter({
            CharacterId: '123',
            Name: 'Test',
            FirstImpression: 'Testy',
            OneCoolThing: 'The Test',
            Pronouns: 'She/her',
            Outfit:  'Orange jumpsuit',
            HomeId: 'ABC'
        })
        expect(documentClient.put.mock.calls.length).toBe(1)
        expect(documentClient.put.mock.calls[0][0]).toEqual({
            TableName: 'undefined_permanents',
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
        })
        expect(data).toEqual([{ Character:
            {
                CharacterId: '123',
                Name: 'Test',
                FirstImpression: 'Testy',
                OneCoolThing: 'The Test',
                Pronouns: 'She/her',
                Outfit:  'Orange jumpsuit',
                HomeId: 'ABC'
            }
        }])
    })
})
