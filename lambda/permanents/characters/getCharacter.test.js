jest.mock('../utilities', () => ({
    documentClient: {
        get: jest.fn(),
        query: jest.fn()
    }
}))
const { getCharacter } = require('./getCharacter')
const { documentClient } = require('../utilities')

describe("getCharacter", () => {
    it("should return empty when no records", async () => {
        documentClient.query.mockReturnValue({ promise: () => (Promise.resolve({ Items: [] })) })
        const data = await getCharacter({ CharacterId: '123' })
        expect(data).toEqual({ CharacterId: '123' })
    })

    it("should return character when present", async () => {
        documentClient.query
            .mockReturnValueOnce({ promise: () => (Promise.resolve({ Items: [
                {
                    PermanentId: 'CHARACTER#123',
                    DataCategory: 'GRANT#ABC',
                    Actions: 'Edit'
                },
                {
                    PermanentId: 'CHARACTER#123',
                    DataCategory: 'Details',
                    Name: 'Testy',
                    FirstImpression: 'Test impression'
                }
            ] })) })
            .mockReturnValueOnce({ promise: () => (Promise.resolve({ Items: [
                {
                    PermanentId: 'PLAYER#Test',
                    DataCategory: 'CHARACTER#123'
                }
            ]})) })
        const data = await getCharacter({ CharacterId: '123' })
        expect(data).toEqual({
            CharacterId: '123',
            PlayerName: 'Test',
            Name: 'Testy',
            FirstImpression: 'Test impression',
            Grants: [
                {
                    Resource: 'ABC',
                    Actions: 'Edit'
                }
            ]
        })
    })
})
