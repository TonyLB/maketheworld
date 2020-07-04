jest.mock('./utilities', () => ({
    documentClient: {
        scan: jest.fn()
    }
}))
const { getAllCharacters } = require('./getAllCharacters')
const { documentClient } = require('./utilities')

describe("getAllCharacters", () => {
    it("should return empty when no records", async () => {
        documentClient.scan.mockReturnValue({ promise: () => (Promise.resolve({ Items: [] })) })
        const data = await getAllCharacters()
        expect(data).toEqual([])
    })

    it("should return characters when present", async () => {
        documentClient.scan
            .mockReturnValue({ promise: () => (Promise.resolve({ Items: [
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
                },
                {
                    PermanentId: 'CHARACTER#456',
                    DataCategory: 'Details',
                    Name: 'Testopher',
                    FirstImpression: 'Testing'
                }
            ] })) })
        const data = await getAllCharacters()
        expect(data).toEqual([
            {
                CharacterId: '123',
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
                Name: 'Testopher',
                FirstImpression: 'Testing',
                Grants: []
            }
        ])
    })
})
