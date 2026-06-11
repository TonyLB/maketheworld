jest.mock('../internalCache', () => ({
    __esModule: true,
    default: {
        Connection: {
            get: jest.fn(),
        },
    },
}))

import { InternalMessageBus } from '@tonylb/mtw-lambda-patterns/ts/messageBus'
import internalCache from '../internalCache'
import type { MessageType } from '../messageBus/baseClasses'
import { registerReturnValueCollector, resetReturnValueCollector } from './collector'
import { extractReturnValue } from './index'

describe('returnValue collector integration', () => {
    beforeEach(() => {
        resetReturnValueCollector()
        jest.mocked(internalCache.Connection.get).mockImplementation(async (key: string) =>
            key === 'RequestId' ? 'test-request-id' : undefined
        )
    })

    it('extractReturnValue reads collector for errors with precedence', async () => {
        const bus = new InternalMessageBus<MessageType>()
        registerReturnValueCollector(bus as unknown as import('../messageBus/baseClasses').MessageBus)

        bus.publish({ type: 'ReturnValue', body: { ignored: true } })
        bus.publish({ type: 'Error', body: { error: 'failed', statusCode: 403 } })
        await bus.flushAndSettle()

        const response = await extractReturnValue(bus as unknown as import('../messageBus/baseClasses').MessageBus)

        expect(response.statusCode).toBe(403)
        expect(JSON.parse(response.body)).toEqual({
            error: 'failed',
            RequestId: 'test-request-id',
        })
    })

    it('extractReturnValue reads collector after flushAndSettle', async () => {
        const bus = new InternalMessageBus<MessageType>()
        registerReturnValueCollector(bus as unknown as import('../messageBus/baseClasses').MessageBus)

        bus.publish({ type: 'ReturnValue', body: { collected: true } })

        await bus.flushAndSettle()
        const response = await extractReturnValue(bus as unknown as import('../messageBus/baseClasses').MessageBus)

        expect(JSON.parse(response.body)).toEqual({
            collected: true,
            RequestId: 'test-request-id',
        })
    })
})
