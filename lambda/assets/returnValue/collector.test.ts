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
import {
    collectErrors,
    collectReturnValues,
    getCollectedError,
    getCollectedReturnValueBody,
    registerReturnValueCollector,
    resetReturnValueCollector,
} from './collector'
import { extractReturnValue } from './index'

describe('returnValue collector', () => {
    beforeEach(() => {
        resetReturnValueCollector()
        jest.mocked(internalCache.Connection.get).mockImplementation(async (key: string) =>
            key === 'RequestId' ? 'test-request-id' : undefined
        )
    })

    it('spread-merges bodies from collectReturnValues', () => {
        collectReturnValues([
            { type: 'ReturnValue', body: { a: 1 } },
            { type: 'ReturnValue', body: { b: 2 } },
        ])
        expect(getCollectedReturnValueBody()).toEqual({ a: 1, b: 2 })
    })

    it('collectErrors captures first error only', () => {
        collectErrors([
            { type: 'Error', body: { error: 'first', statusCode: 400 } },
            { type: 'Error', body: { error: 'second', statusCode: 500 } },
        ])
        expect(getCollectedError()).toEqual({ error: 'first', statusCode: 400 })
    })

    it('resetReturnValueCollector clears both buffers', () => {
        collectReturnValues([{ type: 'ReturnValue', body: { x: 1 } }])
        collectErrors([{ type: 'Error', body: { error: 'err' } }])
        resetReturnValueCollector()
        expect(getCollectedReturnValueBody()).toEqual({})
        expect(getCollectedError()).toBeUndefined()
    })

    describe('registerReturnValueCollector', () => {
        it('collects ReturnValue from publish immediately', async () => {
            const bus = new InternalMessageBus<MessageType>()
            registerReturnValueCollector(bus as unknown as import('../messageBus/baseClasses').MessageBus)

            bus.publish({ type: 'ReturnValue', body: { fromPublish: true } })
            await bus.settle()

            expect(getCollectedReturnValueBody()).toEqual({ fromPublish: true })
        })

        it('collects Error from publish', async () => {
            const bus = new InternalMessageBus<MessageType>()
            registerReturnValueCollector(bus as unknown as import('../messageBus/baseClasses').MessageBus)

            bus.publish({ type: 'Error', body: { error: 'bad', statusCode: 422 } })
            await bus.settle()

            expect(getCollectedError()).toEqual({ error: 'bad', statusCode: 422 })
        })

        it('collects ReturnValue from send on flush', async () => {
            const bus = new InternalMessageBus<MessageType>()
            registerReturnValueCollector(bus as unknown as import('../messageBus/baseClasses').MessageBus)

            bus.send({ type: 'ReturnValue', body: { fromSend: true } })
            await bus.flush()

            expect(getCollectedReturnValueBody()).toEqual({ fromSend: true })
        })

        it('onClear resets buffer when bus.clear runs', () => {
            const bus = new InternalMessageBus<MessageType>()
            registerReturnValueCollector(bus as unknown as import('../messageBus/baseClasses').MessageBus)

            bus.publish({ type: 'ReturnValue', body: { temp: true } })
            bus.clear()

            expect(getCollectedReturnValueBody()).toEqual({})
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

        it('extractReturnValue reads collector only, not _stream', async () => {
            const bus = new InternalMessageBus<MessageType>()
            registerReturnValueCollector(bus as unknown as import('../messageBus/baseClasses').MessageBus)

            bus.send({ type: 'ReturnValue', body: { collected: true } })
            expect(bus._stream.length).toBeGreaterThan(0)

            await bus.flush()
            const response = await extractReturnValue(bus as unknown as import('../messageBus/baseClasses').MessageBus)

            expect(JSON.parse(response.body)).toEqual({
                collected: true,
                RequestId: 'test-request-id',
            })
        })
    })
})
