jest.mock('../clients')
import { snsClient } from '../clients'
jest.mock('../internalCache')
import internalCache from '../internalCache'

import { collaborationStatusMessage } from './index'
import { MessageBus } from '../messageBus/baseClasses'
import { CollaborationStatusMessage } from '../messageBus/baseClasses'

const snsClientMock = snsClient as jest.Mocked<typeof snsClient>
const internalCacheMock = jest.mocked(internalCache)

describe('collaborationStatusMessage', () => {
    let messageBus: MessageBus

    beforeEach(() => {
        messageBus = new MessageBus()
        jest.clearAllMocks()
        jest.resetAllMocks()
        
        // Mock the internalCache.Connection.get method to return different values based on the key
        internalCacheMock.Connection.get.mockImplementation((key: string) => {
            if (key === 'connectionId') {
                return Promise.resolve("TestConnection")
            } else if (key === 'RequestId') {
                return Promise.resolve("TestRequestId")
            }
            return Promise.resolve(undefined)
        })
    })

    it('should send collaboration status message with Bootstrap phase', async () => {
        // Arrange
        const payloads: CollaborationStatusMessage[] = [{
            type: 'CollaborationStatus',
            RequestId: 'TestRequestId'
        }]

        // Act
        await collaborationStatusMessage({ payloads, messageBus })

        // Assert
        expect(snsClientMock.send).toHaveBeenCalledTimes(1)
        
        // Check the message content
        expect((snsClientMock.send.mock.calls[0][0].input as any).Message).toEqual('{"messageType":"CollaborationStatus","status":{"phase":"Bootstrap"}}')
        
        // Check the Targets format in MessageAttributes
        const messageAttributes = (snsClientMock.send.mock.calls[0][0].input as any).MessageAttributes
        expect(messageAttributes.Targets.DataType).toEqual('String.Array')
        expect(messageAttributes.Targets.StringValue).toEqual('["CONNECTION#TestConnection"]')
        
        // Check other required attributes
        expect(messageAttributes.RequestId.DataType).toEqual('String')
        expect(messageAttributes.RequestId.StringValue).toEqual('TestRequestId')
        expect(messageAttributes.Type.DataType).toEqual('String')
        expect(messageAttributes.Type.StringValue).toEqual('Success')
    })

    it('should not send message if no connectionId', async () => {
        // Arrange - override the mock to return undefined for connectionId
        internalCacheMock.Connection.get.mockImplementation((key: string) => {
            if (key === 'connectionId') {
                return Promise.resolve(undefined)
            } else if (key === 'RequestId') {
                return Promise.resolve("TestRequestId")
            }
            return Promise.resolve(undefined)
        })

        const payloads: CollaborationStatusMessage[] = [{
            type: 'CollaborationStatus',
            RequestId: 'TestRequestId'
        }]

        // Act
        await collaborationStatusMessage({ payloads, messageBus })

        // Assert
        expect(snsClientMock.send).not.toHaveBeenCalled()
    })

    it('should handle multiple payloads', async () => {
        // Arrange
        const payloads: CollaborationStatusMessage[] = [
            { type: 'CollaborationStatus', RequestId: 'TestRequestId' },
            { type: 'CollaborationStatus', RequestId: 'TestRequestId' }
        ]

        // Act
        await collaborationStatusMessage({ payloads, messageBus })

        // Assert
        expect(snsClientMock.send).toHaveBeenCalledTimes(2)
    })
})
