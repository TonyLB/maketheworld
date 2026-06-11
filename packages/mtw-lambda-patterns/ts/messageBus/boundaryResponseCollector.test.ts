import { InternalMessageBus } from './index'
import {
    createBoundaryResponseCollector,
    type BoundaryResponseMessage,
} from './boundaryResponseCollector'

type TestPayload = BoundaryResponseMessage | { type: 'Other' }

describe('createBoundaryResponseCollector', () => {
    const createCollector = () => createBoundaryResponseCollector<TestPayload>()

    it('spread-merges bodies from collectReturnValues', () => {
        const { collectReturnValues, getCollectedReturnValueBody } = createCollector()

        collectReturnValues([
            { type: 'ReturnValue', body: { a: 1 } },
            { type: 'ReturnValue', body: { b: 2 } },
        ])

        expect(getCollectedReturnValueBody()).toEqual({ a: 1, b: 2 })
    })

    it('collectErrors captures first error only', () => {
        const { collectErrors, getCollectedError } = createCollector()

        collectErrors([
            { type: 'Error', body: { error: 'first', statusCode: 400 } },
            { type: 'Error', body: { error: 'second', statusCode: 500 } },
        ])

        expect(getCollectedError()).toEqual({ error: 'first', statusCode: 400 })
    })

    it('reset clears both buffers', () => {
        const {
            collectReturnValues,
            collectErrors,
            reset,
            getCollectedReturnValueBody,
            getCollectedError,
        } = createCollector()

        collectReturnValues([{ type: 'ReturnValue', body: { x: 1 } }])
        collectErrors([{ type: 'Error', body: { error: 'err' } }])
        reset()

        expect(getCollectedReturnValueBody()).toEqual({})
        expect(getCollectedError()).toBeUndefined()
    })

    describe('register', () => {
        it('collects ReturnValue from publish immediately', async () => {
            const bus = new InternalMessageBus<TestPayload>()
            const { register, getCollectedReturnValueBody } = createCollector()

            register(bus)
            bus.publish({ type: 'ReturnValue', body: { fromPublish: true } })
            await bus.settle()

            expect(getCollectedReturnValueBody()).toEqual({ fromPublish: true })
        })

        it('collects Error from publish', async () => {
            const bus = new InternalMessageBus<TestPayload>()
            const { register, getCollectedError } = createCollector()

            register(bus)
            bus.publish({ type: 'Error', body: { error: 'bad', statusCode: 422 } })
            await bus.settle()

            expect(getCollectedError()).toEqual({ error: 'bad', statusCode: 422 })
        })

        it('onClear resets buffer when bus.clear runs', () => {
            const bus = new InternalMessageBus<TestPayload>()
            const { register, getCollectedReturnValueBody } = createCollector()

            register(bus)
            bus.publish({ type: 'ReturnValue', body: { temp: true } })
            bus.clear()

            expect(getCollectedReturnValueBody()).toEqual({})
        })

        it('skips Error subscription when includeError is false', async () => {
            const bus = new InternalMessageBus<TestPayload>()
            const { register, getCollectedError } = createBoundaryResponseCollector<TestPayload>({
                includeError: false,
            })

            register(bus)
            bus.publish({ type: 'Error', body: { error: 'ignored' } })
            await bus.settle()

            expect(getCollectedError()).toBeUndefined()
        })
    })
})
