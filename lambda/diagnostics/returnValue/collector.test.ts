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

    it('extractReturnValue returns spread-merged body from collector', async () => {
        const bus = new InternalMessageBus<MessageType>()
        registerReturnValueCollector(bus as unknown as import('../messageBus/baseClasses').MessageBus)

        bus.publish({ type: 'ReturnValue', body: { emittedCount: 2, players: ['p1'] } })
        await bus.flushAndSettle()

        const response = extractReturnValue(bus as unknown as import('../messageBus/baseClasses').MessageBus)

        expect(response).toEqual({ emittedCount: 2, players: ['p1'] })
    })
})
