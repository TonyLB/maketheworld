jest.mock('../utilities', () => ({
    documentClient: {
        query: jest.fn(),
        batchWrite: jest.fn()
    }
}))
jest.mock('/opt/uuid', () => ({
    v4: jest.fn()
}))

const { v4: uuid } = require('/opt/uuid')

const { putCharacter } = require('./putCharacter')
const { documentClient } = require('../utilities')

describe("putCharacter", () => {
    const realDateNow = Date.now.bind(global.Date)

    afterEach(() => {
        jest.clearAllMocks()
        global.Date.now = realDateNow
    })

    it("should put a new character", async () => {

        global.Date.now = jest.fn(() => 123451234567)

        documentClient.query.mockReturnValue({ promise: () => (Promise.resolve({})) })
        documentClient.batchWrite.mockReturnValue({ promise: () => (Promise.resolve({})) })
        uuid.mockReturnValue('123')
        const data = await putCharacter({
            Name: 'Test',
            FirstImpression: 'Testy',
            OneCoolThing: 'The Test',
            Pronouns: 'She/her',
            Outfit:  'Orange jumpsuit',
            HomeId: 'ABC'
        })
        expect(documentClient.batchWrite.mock.calls.length).toBe(1)
        expect(documentClient.batchWrite.mock.calls[0][0]).toEqual({ RequestItems: {
            undefined_permanents: [
                { PutRequest:
                    {
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
                }
            ],
            undefined_permanent_delta: [
                { PutRequest:
                    {
                        Item: {
                            PartitionId: 12345,
                            DeltaId: '123451234567::CHARACTER#123::Details',
                            RowId: 'CHARACTER#123::Details',
                            Name: 'Test',
                            FirstImpression: 'Testy',
                            OneCoolThing: 'The Test',
                            Pronouns: 'She/her',
                            Outfit:  'Orange jumpsuit',
                            HomeId: 'ABC'
                        }
                    }
                }
            ]
        }})
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

        global.Date.now = jest.fn(() => 123451234567)

        documentClient.query.mockReturnValue({ promise: () => (Promise.resolve({})) })
        documentClient.batchWrite.mockReturnValue({ promise: () => (Promise.resolve({})) })
        const data = await putCharacter({
            CharacterId: '123',
            Name: 'Test',
            FirstImpression: 'Testy',
            OneCoolThing: 'The Test',
            Pronouns: 'She/her',
            Outfit:  'Orange jumpsuit',
            HomeId: 'ABC'
        })
        expect(documentClient.batchWrite.mock.calls.length).toBe(1)
        expect(documentClient.batchWrite.mock.calls[0][0]).toEqual({ RequestItems: {
            undefined_permanents: [
                { PutRequest:
                    {
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
                }
            ],
            undefined_permanent_delta: [
                { PutRequest:
                    {
                        Item: {
                            PartitionId: 12345,
                            DeltaId: '123451234567::CHARACTER#123::Details',
                            RowId: 'CHARACTER#123::Details',
                            Name: 'Test',
                            FirstImpression: 'Testy',
                            OneCoolThing: 'The Test',
                            Pronouns: 'She/her',
                            Outfit:  'Orange jumpsuit',
                            HomeId: 'ABC'
                        }
                    }
                }
            ]
        }})
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
