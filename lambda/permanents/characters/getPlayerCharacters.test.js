jest.mock('../utilities', () => ({
    documentClient: {
        get: jest.fn(),
        query: jest.fn()
    }
}))
const { getPlayerCharacters } = require('./getPlayerCharacters')
const { documentClient } = require('../utilities')

describe("getPlayerCharacters", () => {
    it("should return empty when no records", async () => {
        documentClient.query.mockReturnValue({ promise: () => (Promise.resolve({ Items: [] })) })
        const data = await getPlayerCharacters({ PlayerName: 'Test' })
        expect(data).toEqual([])
    })

    it("should return character when present", async () => {
        documentClient.query
            .mockReturnValueOnce({ promise: () => (Promise.resolve({ Items: [
                {
                    PermanentId: 'PLAYER#Test',
                    DataCategory: 'CHARACTER#123'
                },
                {
                    PermanentId: 'PLAYER#Test',
                    DataCategory: 'CHARACTER#456'
                }
            ]}))})
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
                    PermanentId: 'CHARACTER#456',
                    DataCategory: 'Details',
                    Name: 'Testopher',
                    FirstImpression: 'Testing'
                }
            ]})) })
        const data = await getPlayerCharacters({ PlayerName: 'Test' })
        expect(data).toEqual([
            {
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
            },
            {
                CharacterId: '456',
                PlayerName: 'Test',
                Name: 'Testopher',
                FirstImpression: 'Testing',
                Grants: []
            }
        ])
    })
})
