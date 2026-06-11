import { InternalMessageBus } from '@tonylb/mtw-lambda-patterns/ts/messageBus'
import type { MessageType } from '../messageBus/baseClasses'
import { registerReturnValueCollector, resetReturnValueCollector } from './collector'
import { extractReturnValue } from './index'

describe('returnValue collector integration', () => {
    beforeEach(() => {
        resetReturnValueCollector()
    })

    it('extractReturnValue reads collector for errors with precedence', async () => {
        const bus = new InternalMessageBus<MessageType>()
        registerReturnValueCollector(bus as unknown as import('../messageBus/baseClasses').MessageBus)

        bus.publish({ type: 'ReturnValue', body: { ignored: true } })
        bus.publish({ type: 'Error', body: { error: 'failed', statusCode: 403 } })
        await bus.flushAndSettle()

        const response = extractReturnValue(bus as unknown as import('../messageBus/baseClasses').MessageBus)

        expect(response).toEqual({
            statusCode: 403,
            body: JSON.stringify({ error: 'failed' }),
        })
    })

    it('extractReturnValue wraps WebSocket service route responses', async () => {
        const bus = new InternalMessageBus<MessageType>()
        registerReturnValueCollector(bus as unknown as import('../messageBus/baseClasses').MessageBus)

        bus.publish({
            type: 'ReturnValue',
            body: { messageType: 'Registration', CharacterId: 'CHARACTER#abc' },
        })
        await bus.flushAndSettle()

        const response = extractReturnValue(bus as unknown as import('../messageBus/baseClasses').MessageBus, {
            requestContext: { routeKey: 'connections' },
        })

        expect(response).toEqual({
            statusCode: 200,
            body: JSON.stringify({ messageType: 'Registration', CharacterId: 'CHARACTER#abc' }),
        })
    })
})
