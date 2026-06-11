import { InternalMessageBus } from './index'

type TestPayloadOne = {
    type: 'payloadOne';
    value: string;
}

type TestPayloadTwo = {
    type: 'payloadTwo';
    value: number;
}

type TestPayload = TestPayloadOne | TestPayloadTwo

describe('publish / settle / flushAndSettle', () => {
    afterEach(async () => {
        jest.restoreAllMocks()
    })

    it('returns false from settle on an empty bus', async () => {
        const messageBus = new InternalMessageBus<string>()
        expect(await messageBus.settle()).toBe(false)
    })

    it('processes a single publish subscriber with single-item payloads', async () => {
        const messageBus = new InternalMessageBus<TestPayload>()
        const outputs: string[] = []

        messageBus.subscribe({
            tag: 'singleSub',
            priority: 1,
            filter: (prop: TestPayload): prop is TestPayloadOne => (prop.type === 'payloadOne'),
            callback: async ({ payloads }) => {
                expect(payloads).toHaveLength(1)
                outputs.push(payloads[0].value)
            }
        })

        messageBus.publish({
            type: 'payloadOne',
            value: 'published'
        })
        expect(await messageBus.settle()).toBe(true)
        expect(outputs).toEqual(['published'])
    })

    it('schedules concurrent matching subscribers without priority ordering', async () => {
        const messageBus = new InternalMessageBus<string>()
        const order: string[] = []

        messageBus.subscribe({
            tag: 'lowPriority',
            priority: 10,
            filter: (p) => p === 'event',
            callback: async () => {
                order.push('low')
            }
        })
        messageBus.subscribe({
            tag: 'highPriority',
            priority: 1,
            filter: (p) => p === 'event',
            callback: async () => {
                order.push('high')
            }
        })

        messageBus.publish('event')
        await messageBus.settle()

        expect(order).toHaveLength(2)
        expect(order).toContain('low')
        expect(order).toContain('high')
    })

    it('drains recursive publish during settle in one call', async () => {
        const messageBus = new InternalMessageBus<string>()
        const outputs: string[] = []

        messageBus.subscribe({
            tag: 'parent',
            priority: 1,
            filter: (p) => p === 'parent',
            callback: async ({ messageBus: mb }) => {
                outputs.push('parent')
                mb.publish('child')
            }
        })
        messageBus.subscribe({
            tag: 'child',
            priority: 2,
            filter: (p) => p === 'child',
            callback: async () => {
                outputs.push('child')
            }
        })

        messageBus.publish('parent')
        expect(await messageBus.settle()).toBe(true)
        expect(outputs).toEqual(['parent', 'child'])
    })

    it('drains recursive publish during flushAndSettle', async () => {
        const messageBus = new InternalMessageBus<string>()
        const outputs: string[] = []

        messageBus.subscribe({
            tag: 'parent',
            priority: 1,
            filter: (p) => p === 'kickoff',
            callback: async ({ messageBus: mb }) => {
                outputs.push('parent')
                mb.publish('child')
            }
        })
        messageBus.subscribe({
            tag: 'child',
            priority: 2,
            filter: (p) => p === 'child',
            callback: async () => {
                outputs.push('child')
            }
        })

        messageBus.publish('kickoff')
        await messageBus.flushAndSettle()

        expect(outputs).toEqual(['parent', 'child'])
    })

    it('drains all handlers when one rejects and logs the subscription tag', async () => {
        const messageBus = new InternalMessageBus<string>()
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
        const outputs: string[] = []

        messageBus.subscribe({
            tag: 'rejectingSub',
            priority: 1,
            filter: (p) => p === 'trigger',
            callback: async () => {
                throw new Error('handler failure')
            }
        })
        messageBus.subscribe({
            tag: 'peerSub',
            priority: 2,
            filter: (p) => p === 'trigger',
            callback: async () => {
                outputs.push('peer ran')
            }
        })

        messageBus.publish('trigger')
        await expect(messageBus.settle()).resolves.toBe(true)
        expect(outputs).toEqual(['peer ran'])
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            'InternalMessageBus settle: subscription "rejectingSub" rejected:',
            expect.any(Error)
        )
    })

    it('clear drops _inFlight tracking without cancelling detached handlers', async () => {
        const messageBus = new InternalMessageBus<string>()
        let handlerCompleted = false

        messageBus.subscribe({
            tag: 'slowSub',
            priority: 1,
            filter: () => true,
            callback: async () => {
                await new Promise<void>((resolve) => { setImmediate(resolve) })
                handlerCompleted = true
            }
        })

        messageBus.publish('msg')
        messageBus.clear()
        expect(await messageBus.settle()).toBe(false)

        await new Promise<void>((resolve) => { setImmediate(resolve) })
        expect(handlerCompleted).toBe(true)
    })

    it('registerDeferral onClear runs on clear and afterSettled runs after flushAndSettle idle loop', async () => {
        const messageBus = new InternalMessageBus<string>()
        const onClear = jest.fn()
        const afterSettled = jest.fn(async () => {})

        messageBus.registerDeferral('testDeferral', { onClear, afterSettled })

        messageBus.clear()
        expect(onClear).toHaveBeenCalledTimes(1)

        await messageBus.flushAndSettle()
        expect(afterSettled).toHaveBeenCalledTimes(1)
    })

    it('runDeferrals logs rejection without throwing', async () => {
        const messageBus = new InternalMessageBus<string>()
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

        messageBus.registerDeferral('failingDeferral', {
            afterSettled: async () => {
                throw new Error('deferral failure')
            }
        })

        await expect(messageBus.runDeferrals()).resolves.toBeUndefined()
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            'InternalMessageBus runDeferrals: deferral "failingDeferral" rejected:',
            expect.any(Error)
        )
    })

    it('registerDeferral throws on duplicate tag', () => {
        const messageBus = new InternalMessageBus<string>()
        messageBus.registerDeferral('dup', { afterSettled: async () => {} })
        expect(() => {
            messageBus.registerDeferral('dup', { afterSettled: async () => {} })
        }).toThrow('deferral "dup" is already registered')
    })
})
