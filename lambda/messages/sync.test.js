jest.mock('./utilities', () => ({
    documentClient: {
        query: jest.fn(() => ({ promise: jest.fn() })),
        batchGet: jest.fn(() => ({ promise: jest.fn() }))
    },
}))

const { documentClient } = require('./utilities')
const { syncRecords, sync } = require('./sync')

describe("messagesSync", () => {

    const realDateNow = Date.now.bind(global.Date)

    afterEach(() => {
        jest.clearAllMocks()
        global.Date.now = realDateNow
    })

    it('should return empty when no delta info', async () => {
        documentClient.query.mockReturnValue({ promise: () => (Promise.resolve({ Items: [] }))})
        const data = await syncRecords({ startingAt: 123445000000, TargetId: 'ABCD' })
        expect(documentClient.query.mock.calls.length).toBe(1)
        expect(documentClient.query.mock.calls[0][0]).toEqual({
            TableName: 'undefined_message_delta',
            KeyConditionExpression: "Target = :Target and DeltaId >= :Start",
            ExpressionAttributeValues: {
                ":Start": "123445000000",
                ":Target": "CHARACTER#ABCD"
            }
        })
        expect(data).toEqual({
            Items: []
        })
    })

    it('should return delta records since startingAt', async () => {
        documentClient.query.mockReturnValue({ promise: () => (Promise.resolve({ Items: [
                {
                    TargetId: 'CHARACTER#ABCD',
                    DeltaId: '123446000000::MESSAGE#BCD::Content',
                    RowId: 'MESSAGE#BCD::Content',
                    Message: 'Test One',
                    DisplayProtocol: 'World'
                },
                {
                    TargetId: 'CHARACTER#ABCD',
                    DeltaId: '123451000000::MESSAGE#CDE::Content',
                    RowId: 'MESSAGE#CDE::Content',
                    Message: 'Test Two',
                    DisplayProtocol: 'World'
                },
                {
                    TargetId: 'CHARACTER#ABCD',
                    DeltaId: '123456000000::MESSAGE#DEF::Content',
                    RowId: 'MESSAGE#DEF::Content',
                    Message: 'Test Three',
                    DisplayProtocol: 'Player'
                }
            ]}))})
        const data = await syncRecords({ TargetId: 'ABCD', startingAt: 123445000000 })
        expect(documentClient.query.mock.calls.length).toBe(1)
        expect(documentClient.query.mock.calls[0][0]).toEqual({
            TableName: 'undefined_message_delta',
            KeyConditionExpression: "Target = :Target and DeltaId >= :Start",
            ExpressionAttributeValues: {
                ":Start": "123445000000",
                ":Target": "CHARACTER#ABCD"
            }
        })
        expect(data).toEqual({
            Items: [
                {
                    MessageId: 'BCD',
                    DataCategory: 'Content',
                    CreatedTime: 123446000000,
                    DisplayProtocol: 'World',
                    Message: 'Test One'
                },
                {
                    MessageId: 'CDE',
                    DataCategory: 'Content',
                    CreatedTime: 123451000000,
                    DisplayProtocol: 'World',
                    Message: 'Test Two'
                },
                {
                    MessageId: 'DEF',
                    DataCategory: 'Content',
                    CreatedTime: 123456000000,
                    DisplayProtocol: 'Player',
                    Message: 'Test Three'
                }
            ]}
        )

    })

    it('should return main table records when passed no startingAt', async () => {
        documentClient.query.mockReturnValue({ promise: () => (Promise.resolve({ Items: [
                {
                    DataCategory: 'MESSAGE#BCD'
                },
                {
                    DataCategory: 'MESSAGE#CDE'
                },
                {
                    DataCategory: 'MESSAGE#DEF'
                }
            ]}))})
        documentClient.batchGet.mockReturnValue({ promise: () => (Promise.resolve({ Responses: { undefined_messages: [
                {
                    MessageId: 'MESSAGE#BCD',
                    DataCategory: 'Content',
                    CreatedTime: 123446000000,
                    Message: 'Test One',
                    DisplayProtocol: 'World'
                },
                {
                    MessageId: 'MESSAGE#CDE',
                    DataCategory: 'Content',
                    CreatedTime: 123451000000,
                    Message: 'Test Two',
                    DisplayProtocol: 'World'
                },
                {
                    MessageId: 'MESSAGE#DEF',
                    DataCategory: 'Content',
                    CreatedTime: 123456000000,
                    Message: 'Test Three',
                    DisplayProtocol: 'Player',
                    CharacterId: 'DEFG'
                }
            ]}}))})
        global.Date.now = jest.fn(() => 123451234567)
        const data = await sync({ TargetId: 'ABCD' })
        expect(documentClient.query.mock.calls.length).toBe(1)
        expect(documentClient.query.mock.calls[0][0]).toEqual({
            TableName: 'undefined_messages',
            KeyConditionExpression: "MessageId = :TargetId",
            ExpressionAttributeValues: {
                ":TargetId": "CHARACTER#ABCD"
            },
            IndexName: 'CreatedTimeIndex',
        })
        expect(data).toEqual({
            Items: [
                {
                    MessageId: 'BCD',
                    CreatedTime: 123446000000,
                    DisplayProtocol: 'World',
                    Target: 'ABCD',
                    WorldMessage: {
                        Message: 'Test One'
                    }
                },
                {
                    MessageId: 'CDE',
                    CreatedTime: 123451000000,
                    DisplayProtocol: 'World',
                    Target: 'ABCD',
                    WorldMessage: {
                        Message: 'Test Two'
                    }
                },
                {
                    MessageId: 'DEF',
                    CreatedTime: 123456000000,
                    DisplayProtocol: 'Player',
                    Target: 'ABCD',
                    CharacterMessage: {
                        CharacterId: 'DEFG',
                        Message: 'Test Three'
                    }
                }
            ],
            LastEvaluatedKey: null,
            LastSync: 123451234567
        })

    })

    it('should correctly pass exclusiveStartKey', async () => {
        documentClient.query.mockReturnValue({ promise: () => (Promise.resolve({ Items: [
                {
                    TargetId: 'CHARACTER#ABCD',
                    DeltaId: '123446000000::MESSAGE#BCD::Content',
                    RowId: 'MESSAGE#BCD::Content',
                    Message: 'Test One',
                    DisplayProtocol: 'World'
                }
            ]}))})
        const data = await syncRecords({ TargetId: 'ABCD', startingAt: 123445000000, exclusiveStartKey: { 'Test': 'Value' } })
        expect(documentClient.query.mock.calls.length).toBe(1)
        expect(documentClient.query.mock.calls[0][0]).toEqual({
            TableName: 'undefined_message_delta',
            KeyConditionExpression: "Target = :Target and DeltaId >= :Start",
            ExclusiveStartKey: { 'Test': 'Value' },
            ExpressionAttributeValues: {
                ":Start": "123445000000",
                ":Target": "CHARACTER#ABCD"
            }
        })
        expect(data).toEqual({
            Items: [
                {
                    MessageId: 'BCD',
                    DataCategory: 'Content',
                    CreatedTime: 123446000000,
                    DisplayProtocol: 'World',
                    Message: 'Test One'
                }
            ]}
        )

    })
})
