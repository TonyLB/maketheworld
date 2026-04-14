import { ephemeraActionsDataSource } from './index'
import messageBus from '../../messageBus'

jest.mock('../../messageBus')

const mockMessageBus = messageBus as jest.Mocked<typeof messageBus>

describe('ephemeraActionsDataSource', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockMessageBus.send.mockReturnValue(undefined)
    })

    it('emits immediate correlated success when Parse Requested carries requestId', async () => {
        await ephemeraActionsDataSource.receiveEvents!({
            events: [{
                header: {
                    dataSourceKey: 'api.ephemera',
                    streamKey: 'CHARACTER#123',
                    timestamp: Date.now(),
                    type: 'Parse Requested',
                },
                getContent: async () => ({
                    characterId: 'CHARACTER#123',
                    command: 'look',
                    requestId: 'req-1',
                }),
            }],
            streamEvent: jest.fn(async () => {}),
            streamEnvelope: jest.fn(async () => {}),
        })

        expect(mockMessageBus.send).toHaveBeenCalledTimes(2)
        expect(mockMessageBus.send).toHaveBeenNthCalledWith(1, {
            type: 'PublishMessage',
            targets: ['CHARACTER#123'],
            displayProtocol: 'WorldOOCMessage',
            message: ['Parse error'],
        })
        expect(mockMessageBus.send).toHaveBeenNthCalledWith(2, {
            type: 'ReturnValue',
            body: {
                messageType: 'Success',
                RequestId: 'req-1',
                message: 'Parse request accepted',
            },
        })
    })

    it('does not emit correlated success when requestId is missing', async () => {
        await ephemeraActionsDataSource.receiveEvents!({
            events: [{
                header: {
                    dataSourceKey: 'api.ephemera',
                    streamKey: 'CHARACTER#123',
                    timestamp: Date.now(),
                    type: 'Parse Requested',
                },
                getContent: async () => ({
                    characterId: 'CHARACTER#123',
                    command: 'look',
                }),
            }],
            streamEvent: jest.fn(async () => {}),
            streamEnvelope: jest.fn(async () => {}),
        })

        expect(mockMessageBus.send).toHaveBeenCalledTimes(1)
        expect(mockMessageBus.send).toHaveBeenCalledWith({
            type: 'PublishMessage',
            targets: ['CHARACTER#123'],
            displayProtocol: 'WorldOOCMessage',
            message: ['Parse error'],
        })
    })
})
