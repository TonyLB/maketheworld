import { InternalMessageBus } from '@tonylb/mtw-lambda-patterns/ts/messageBus'
import type { MessageType } from '../messageBus/baseClasses'
import {
    collectReturnValues,
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

    it('later keys overwrite earlier keys in spread merge', () => {
        collectReturnValues([{ type: 'ReturnValue', body: { key: 'first' } }])
        collectReturnValues([{ type: 'ReturnValue', body: { key: 'second' } }])
        expect(getCollectedReturnValueBody()).toEqual({ key: 'second' })
    })

    it('resetReturnValueCollector clears the buffer', () => {
        collectReturnValues([{ type: 'ReturnValue', body: { x: 1 } }])
        resetReturnValueCollector()
        expect(getCollectedReturnValueBody()).toEqual({})
    })

    describe('registerReturnValueCollector', () => {
        it('collects ReturnValue from publish after settle', async () => {
            const bus = new InternalMessageBus<MessageType>()
            registerReturnValueCollector(bus as unknown as import('../messageBus/baseClasses').MessageBus)

            bus.publish({ type: 'ReturnValue', body: { fromPublish: true } })
            await bus.settle()

            expect(getCollectedReturnValueBody()).toEqual({ fromPublish: true })
        })

        it('onClear resets buffer when bus.clear runs', () => {
            const bus = new InternalMessageBus<MessageType>()
            registerReturnValueCollector(bus as unknown as import('../messageBus/baseClasses').MessageBus)

            bus.publish({ type: 'ReturnValue', body: { temp: true } })
            bus.clear()

            expect(getCollectedReturnValueBody()).toEqual({})
        })

        it('extractReturnValue reads collector after flushAndSettle', async () => {
            const bus = new InternalMessageBus<MessageType>()
            registerReturnValueCollector(bus as unknown as import('../messageBus/baseClasses').MessageBus)

            bus.publish({ type: 'ReturnValue', body: { collected: true } })

            await bus.flushAndSettle()
            const response = extractReturnValue(bus as unknown as import('../messageBus/baseClasses').MessageBus)

            expect(JSON.parse(response.body)).toEqual({ collected: true })
        })
    })
})
