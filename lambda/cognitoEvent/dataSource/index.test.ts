import { createInternalOriginEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import { processCognitoSubscribedEvents } from './index'

describe('processCognitoSubscribedEvents', () => {
    it('streams mtw.cognito New Player payload from api.cognito ingress', async () => {
        const streamEvent = jest.fn(async () => undefined)
        const envelope = createInternalOriginEnvelope(
            {
                dataSourceKey: 'api.cognito',
                streamKey: 'ingress',
                timestamp: 1000,
                type: 'New Player'
            },
            {
                type: 'New Player',
                player: 'PlayerOne'
            },
            {
                serialize: ({ content }: { content: { type: string; player: string } }) => ({ ...content })
            }
        )

        await processCognitoSubscribedEvents([envelope], streamEvent)

        expect(streamEvent).toHaveBeenCalledTimes(1)
        expect(streamEvent).toHaveBeenCalledWith({
            update: {
                type: 'New Player',
                player: 'PlayerOne'
            },
            streamKey: 'PlayerOne',
            header: { type: 'New Player' }
        })
    })
})
