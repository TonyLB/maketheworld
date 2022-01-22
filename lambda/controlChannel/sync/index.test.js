import { syncDelta } from './index.js'
import { marshall } from '@aws-sdk/util-dynamodb'

describe("syncDelta", () => {

    const realDateNow = Date.now.bind(global.Date)

    let dbClient = {
        send: jest.fn()
    }
    let apiClient = {
        send: jest.fn()
    }
    afterEach(() => {
        jest.clearAllMocks()
        global.Date.now = realDateNow
    })

    it('should return empty when no delta info', async () => {
        dbClient.send.mockReturnValue(Promise.resolve({ Items: [] }))
        await syncDelta({ startingAt: 123445000000, TargetId: 'ABCD', ConnectionId: '123', RequestId: '456' })
        expect(dbClient.send).toHaveBeenCalledTimes(1)
        expect(dbClient.send).toHaveBeenCalledWith({
            TableName: 'undefined_message_delta',
            KeyConditionExpression: "Target = :Target and DeltaId >= :Start",
            ExpressionAttributeValues: marshall({
                ":Start": "123445000000",
                ":Target": "CHARACTER#ABCD"
            })
        })
        expect(apiClient.send).toHaveBeenCalledTimes(1)
        expect(apiClient.send).toHaveBeenCalledWith({
            messageType: 'Messages',
            messages: [],
            RequestId: '456'
        })
    })

    //
    // TODO: Write more test functions.
    //
})
