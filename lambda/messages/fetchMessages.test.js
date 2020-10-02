const { fetchMessagesById } = require('./fetchMessages')
jest.mock('./utilities', () => ({
    documentClient: {
        batchGet: jest.fn()
    }
}))

const { documentClient } = require('./utilities')

describe("fetchMessagesById", () => {

    afterEach(() => {
        jest.clearAllMocks()
    })

    it('should return nothing when no messageIds', async () => {

        const data = await fetchMessagesById({ Items: [], Test: 'Value' })
        expect(documentClient.batchGet.mock.calls.length).toEqual(0)
        expect(data).toEqual([])
    })

    it('should return a small batch of messages', async () => {

        documentClient.batchGet.mockReturnValue({ promise: () => (Promise.resolve({ Responses: { undefined_messages: [
            {
                MessageId: 'MESSAGE#456',
                DataCategory: 'Contents',
                Message: 'Test Two',
                CreatedTime: 12345400000
            },
            {
                MessageId: 'MESSAGE#123',
                DataCategory: 'Contents',
                Message: 'Test One',
                CreatedTime: 12345100000
            }
        ]}}))})

        const data = await fetchMessagesById({ Items: [{ DataCategory: 'MESSAGE#456' }, { DataCategory: 'MESSAGE#123' }], Test: 'Value'})
        expect(documentClient.batchGet.mock.calls.length).toEqual(1)
        expect(documentClient.batchGet.mock.calls[0][0]).toEqual({ RequestItems: { undefined_messages: { Keys: [
            { MessageId: 'MESSAGE#456', DataCategory: 'Content' },
            { MessageId: 'MESSAGE#123', DataCategory: 'Content' }
        ] } } })
        expect(data).toEqual({
            Items: [
                {
                    MessageId: '123',
                    Message: 'Test One',
                    CreatedTime: 12345100000
                },
                {
                    MessageId: '456',
                    Message: 'Test Two',
                    CreatedTime: 12345400000
                }
            ],
            Test: 'Value'
        })
    })

    it('should return an aggregate for a large batch of messages', async() => {
        const sequenceNumbers = Array(60).fill().map((element, index) => (index + 1))
        const mapSequenceToGet = (value) => ({
            MessageId: `MESSAGE#${value}`,
            DataCategory: 'Contents',
            Message: `Test ${value}`,
            CreateTime: 12345000 + value
        })
        documentClient.batchGet.mockReturnValueOnce({ promise: () => Promise.resolve({ Responses: { undefined_messages: 
            sequenceNumbers.slice(0, 50).map(mapSequenceToGet)
        }})})
        documentClient.batchGet.mockReturnValueOnce({ promise: () => Promise.resolve({ Responses: { undefined_messages: 
            sequenceNumbers.slice(50).map(mapSequenceToGet)
        }})})

        const data = await fetchMessagesById({ Items: sequenceNumbers.map((value) => ({ DataCategory: `MESSAGE#${value}`})), Test: 'Value' })
        expect(documentClient.batchGet.mock.calls.length).toEqual(2)
        const sortedCalls = documentClient.batchGet.mock.calls.sort((listA, listB) => (listA.length - listB.length))
        expect(sortedCalls[0][0]).toEqual({ RequestItems: { undefined_messages: { Keys: Array(50).fill().map((element, index) => ({ MessageId: `MESSAGE#${index + 1}`, DataCategory: 'Content' }))}}})
        expect(sortedCalls[1][0]).toEqual({ RequestItems: { undefined_messages: { Keys: Array(10).fill().map((element, index) => ({ MessageId: `MESSAGE#${index + 51}`, DataCategory: 'Content' }))}}})
        expect(data).toEqual({
            Items: sequenceNumbers.map((value) => ({ MessageId: `${value}`, Message: `Test ${value}`, CreateTime: 12345000 + value })),
            Test: 'Value'
        })
    })

})
