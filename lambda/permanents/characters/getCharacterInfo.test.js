jest.mock('./utilities', () => ({
    documentClient: {
        query: jest.fn()
    }
}))
const { getCharacterInfo } = require('./getCharacterInfo')
const { documentClient } = require('./utilities')

describe("getCharacterInfo", () => {
    it("should return empty when no records", async () => {
        documentClient.query.mockReturnValue({ promise: () => (Promise.resolve({ Items: [] })) })
        const data = await getCharacterInfo({ CharacterId: '123' })
        expect(data).toEqual({})
    })
    it("should return character info when present", async () => {
        documentClient.query.mockReturnValue({ promise: () => (Promise.resolve({ Items: [
            {
                PermanentId: 'CHARACTER#123',
                DataCategory: 'GRANT#ABC',
                Actions: 'Edit'
            },
            {
                PermanentId: 'CHARACTER#123',
                DataCategory: 'Details',
                Name: 'Testy',
                Description: 'Test desc'
            }
        ] })) })
        const data = await getCharacterInfo({ CharacterId: '123' })
        expect(data).toEqual({
            CharacterId: '123',
            Name: 'Testy',
            Description: 'Test desc',
            Grants: [{
                Resource: 'ABC',
                Actions: 'Edit'
            }]
        })

    })
})
