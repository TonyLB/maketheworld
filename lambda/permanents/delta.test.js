jest.mock('./utilities', () => ({
    documentClient: {
        query: jest.fn(() => ({ promise: jest.fn() }))
    },
}))

const { documentClient } = require('./utilities')
const { permanentAndDeltas } = require('./delta')

describe("permanentAndDeltas", () => {

    const realDateNow = Date.now.bind(global.Date)

    afterEach(() => {
        jest.clearAllMocks()
        global.Date.now = realDateNow
    })

    it('should return two put requests when no previous delta info', async () => {
        documentClient.query.mockReturnValue({ promise: () => (Promise.resolve({ Items: [] }))})
        global.Date.now = jest.fn(() => 123451234567)
        const data = await permanentAndDeltas({ PutRequest: { Item: { PermanentId: '123', DataCategory: 'ABC', Value: 'Test' } }})
        expect(documentClient.query.mock.calls.length).toBe(1)
        expect(data).toEqual({
            undefined_permanents: [
                {
                    PutRequest: {
                        Item: {
                            PermanentId: '123',
                            DataCategory: 'ABC',
                            Value: 'Test'
                        }
                    }
                }
            ],
            undefined_permanent_delta: [
                {
                    PutRequest: {
                        Item: {
                            PartitionId: 12345,
                            DeltaId: "123451234567::123::ABC",
                            RowId: "123::ABC",
                            Value: "Test"
                        }
                    }
                }
            ]
        })
    })

    it('should override previous deltas when present', async () => {
        documentClient.query.mockReturnValue({ promise: () => (Promise.resolve({ Items: [
            {
                PartitionId: 12340,
                DeltaId: '123405555555::123::ABC'
            }
        ] }))})
        global.Date.now = jest.fn(() => 123451234567)
        const data = await permanentAndDeltas({ PutRequest: { Item: { PermanentId: '123', DataCategory: 'ABC', Value: 'Test' } }})
        expect(documentClient.query.mock.calls.length).toBe(1)
        expect(data).toEqual({
            undefined_permanents: [
                {
                    PutRequest: {
                        Item: {
                            PermanentId: '123',
                            DataCategory: 'ABC',
                            Value: 'Test'
                        }
                    }
                }
            ],
            undefined_permanent_delta: [
                {
                    DeleteRequest: {
                        Key: {
                            PartitionId: 12340,
                            DeltaId: '123405555555::123::ABC'
                        }
                    }
                },
                {
                    PutRequest: {
                        Item: {
                            PartitionId: 12345,
                            DeltaId: "123451234567::123::ABC",
                            RowId: "123::ABC",
                            Value: "Test"
                        }
                    }
                }
            ]
        })
    })

})
