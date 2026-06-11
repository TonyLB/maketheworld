import { InternalMessageBus } from '@tonylb/mtw-lambda-patterns/ts/messageBus'
import type { MessageType } from '../messageBus/baseClasses'
import { registerReturnValueCollector, resetReturnValueCollector } from './collector'
import { extractReturnValue } from './index'

describe('returnValue collector integration', () => {
    beforeEach(() => {
        resetReturnValueCollector()
    })

    it('extractReturnValue returns 200 and merged ReturnValue body after flushAndSettle', async () => {
        const bus = new InternalMessageBus<MessageType>()
        registerReturnValueCollector(bus as unknown as import('../messageBus/baseClasses').MessageBus)

        bus.publish({ type: 'ReturnValue', body: { collected: true } })

        await bus.flushAndSettle()
        const response = await extractReturnValue(bus as unknown as import('../messageBus/baseClasses').MessageBus)

        expect(JSON.parse(response.body)).toEqual({ collected: true })
        expect(response.statusCode).toBe(200)
    })

    it('extractReturnValue returns non-200 when bus Error published with precedence over ReturnValue', async () => {
        const bus = new InternalMessageBus<MessageType>()
        registerReturnValueCollector(bus as unknown as import('../messageBus/baseClasses').MessageBus)

        bus.publish({ type: 'ReturnValue', body: { ignored: true } })
        bus.publish({ type: 'Error', body: { error: 'failed', statusCode: 403 } })
        await bus.flushAndSettle()

        const response = await extractReturnValue(bus as unknown as import('../messageBus/baseClasses').MessageBus)

        expect(response).toEqual({
            statusCode: 403,
            body: JSON.stringify({ error: 'failed' }),
        })
    })
})
