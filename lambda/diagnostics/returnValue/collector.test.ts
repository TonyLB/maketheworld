import { InternalMessageBus } from '@tonylb/mtw-lambda-patterns/ts/messageBus'
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
})
