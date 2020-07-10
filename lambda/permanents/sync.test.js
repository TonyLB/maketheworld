jest.mock('./utilities', () => ({
    documentClient: {
        query: jest.fn(() => ({ promise: jest.fn() }))
    },
}))

const { documentClient } = require('./utilities')
const { syncRecords } = require('./sync')

describe("permanentSync", () => {

    const realDateNow = Date.now.bind(global.Date)

    afterEach(() => {
        jest.clearAllMocks()
        global.Date.now = realDateNow
    })

    it('should return empty when no delta info', async () => {
        documentClient.query.mockReturnValue({ promise: () => (Promise.resolve({ Items: [] }))})
        global.Date.now = jest.fn(() => 123451234567)
        const data = await syncRecords({ startingAt: 123445000000 })
        expect(documentClient.query.mock.calls.length).toBe(2)
        expect(documentClient.query.mock.calls[0][0]).toEqual({
            TableName: 'undefined_permanent_delta',
            KeyConditionExpression: "PartitionId = :Partition and DeltaId >= :Start",
            ExpressionAttributeValues: {
                ":Start": "123445000000",
                ":Partition": 12344
            }
        })
        expect(documentClient.query.mock.calls[1][0]).toEqual({
            TableName: 'undefined_permanent_delta',
            KeyConditionExpression: "PartitionId = :Partition",
            ExpressionAttributeValues: {
                ":Partition": 12345
            }
        })
        expect(data).toEqual({ Items: [] })
    })

    it('should return records since startingAt', async () => {
        documentClient.query.mockReturnValueOnce({ promise: () => (Promise.resolve({ Items: [
                {
                    PartitionId: 12344,
                    DeltaId: '123446000000::BCD::Details',
                    RowId: 'BCD::Details',
                    Value: 'Test One'
                }
            ] }))})
            .mockReturnValueOnce({ promise: () => (Promise.resolve({ Items: [
                {
                    PartitionId: 12345,
                    DeltaId: '123451000000::CDE::Details',
                    RowId: 'CDE::Details',
                    Value: 'Test Two'
                },
                {
                    PartitionId: 12345,
                    DeltaId: '123456000000::DEF::Details',
                    RowId: 'DEF::Details',
                    Value: 'Test Three'
                }
            ]}))})
        global.Date.now = jest.fn(() => 123451234567)
        const data = await syncRecords({ startingAt: 123445000000 })
        expect(documentClient.query.mock.calls.length).toBe(2)
        expect(documentClient.query.mock.calls[0][0]).toEqual({
            TableName: 'undefined_permanent_delta',
            KeyConditionExpression: "PartitionId = :Partition and DeltaId >= :Start",
            ExpressionAttributeValues: {
                ":Start": "123445000000",
                ":Partition": 12344
            }
        })
        expect(documentClient.query.mock.calls[1][0]).toEqual({
            TableName: 'undefined_permanent_delta',
            KeyConditionExpression: "PartitionId = :Partition",
            ExpressionAttributeValues: {
                ":Partition": 12345
            }
        })
        expect(data).toEqual({ Items: [
            {
                PermanentId: 'BCD',
                DataCategory: 'Details',
                Value: 'Test One'
            },
            {
                PermanentId: 'CDE',
                DataCategory: 'Details',
                Value: 'Test Two'
            },
            {
                PermanentId: 'DEF',
                DataCategory: 'Details',
                Value: 'Test Three'
            }
        ]})

    })
})
