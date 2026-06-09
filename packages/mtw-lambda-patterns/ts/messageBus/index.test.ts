import { createAsyncGate } from '../testing/asyncGate'
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

describe('InternalMessageBus', () => {
    it('should initialize an empty stream', () => {
        expect(new InternalMessageBus<TestPayload>()._stream).toEqual([])
    })

    it('should record sent messages', () => {
        const messageBus = new InternalMessageBus<TestPayload>()
        messageBus.send({
            type: 'payloadOne',
            value: 'Test'
        })
        messageBus.send({
            type: 'payloadTwo',
            value: -1
        })

        expect(messageBus._stream).toMatchSnapshot()
    })

    it('should process a single subscription', async () => {
        const messageBus = new InternalMessageBus<TestPayload>()

        let outputs: string[] = []
        messageBus.subscribe({
            tag: 'testSubscribe',
            priority: 1,
            filter: (prop: TestPayload): prop is TestPayloadOne => (prop.type === 'payloadOne'),
            callback: async (props: { payloads: TestPayloadOne[], messageBus: InternalMessageBus<TestPayload>, activeFlushLane: string | undefined }) => {
                props.payloads.forEach(({ value }) => { outputs.push(`String: ${value}`) })
            }
        })
        messageBus.send({
            type: 'payloadOne',
            value: 'Test'
        })
        messageBus.send({
            type: 'payloadTwo',
            value: -1
        })

        await messageBus.flush()
        expect(outputs).toEqual(['String: Test'])
    })

    it('should process multiple interacting subscriptions', async () => {
        const messageBus = new InternalMessageBus<TestPayload>()

        let outputs: string[] = []
        messageBus.subscribe({
            tag: 'testSubscribe',
            priority: 1,
            filter: (prop: TestPayload): prop is TestPayloadOne => (prop.type === 'payloadOne'),
            callback: async (props: { payloads: TestPayloadOne[], messageBus: InternalMessageBus<TestPayload>, activeFlushLane: string | undefined }) => {
                props.payloads.forEach(({ value }) => {
                        messageBus.send({
                            type: 'payloadTwo',
                            value: value.length
                        })
                        outputs.push(`String: ${value}`)
                })
            }
        })
        messageBus.subscribe({
            tag: 'testSubscribeTwo',
            priority: 2,
            filter: (prop: TestPayload) => (prop.type === 'payloadTwo'),
            callback: async (props: { payloads: TestPayload[], messageBus: InternalMessageBus<TestPayload>, activeFlushLane: string | undefined }) => {
                props.payloads.forEach(({ value }) => {
                        outputs.push(`Number: ${value}`)
                })
            }
        })
        messageBus.send({
            type: 'payloadOne',
            value: 'Test'
        })
        messageBus.send({
            type: 'payloadTwo',
            value: -1
        })
        messageBus.send({
            type: 'payloadOne',
            value: 'Other Test'
        })

        await messageBus.flush()
        expect(outputs).toEqual(['String: Test', 'String: Other Test', 'Number: -1', 'Number: 4', 'Number: 10'])
    })

    it('should flush default and named lanes only when matching flush is called', async () => {
        const messageBus = new InternalMessageBus<TestPayload>()
        const outputs: string[] = []
        messageBus.subscribe({
            tag: 'sub',
            priority: 1,
            filter: (prop: TestPayload): prop is TestPayloadOne => (prop.type === 'payloadOne'),
            callback: async ({ payloads }) => {
                payloads.forEach(({ value }) => { outputs.push(`one:${value}`) })
            }
        })
        messageBus.send({
            type: 'payloadOne',
            value: 'defaultMsg'
        })
        messageBus.send({
            type: 'payloadOne',
            value: 'namedMsg'
        }, 'laneX')
        await messageBus.flush()
        expect(outputs).toEqual(['one:defaultMsg'])
        await messageBus.flush('laneX')
        expect(outputs).toEqual(['one:defaultMsg', 'one:namedMsg'])
    })

    it('should not drain default lane when flushing a named lane only', async () => {
        const messageBus = new InternalMessageBus<TestPayload>()
        const outputs: string[] = []
        messageBus.subscribe({
            tag: 'sub',
            priority: 1,
            filter: (prop: TestPayload): prop is TestPayloadOne => (prop.type === 'payloadOne'),
            callback: async ({ payloads }) => {
                payloads.forEach(({ value }) => { outputs.push(value) })
            }
        })
        messageBus.send({
            type: 'payloadOne',
            value: 'onlyDefault'
        })
        await messageBus.flush('laneA')
        expect(outputs).toEqual([])
        await messageBus.flush()
        expect(outputs).toEqual(['onlyDefault'])
    })

    it('should process multiple interacting subscriptions within a named lane', async () => {
        const messageBus = new InternalMessageBus<TestPayload>()
        const lane = 'orchestration'

        let outputs: string[] = []
        messageBus.subscribe({
            tag: 'testSubscribe',
            priority: 1,
            filter: (prop: TestPayload): prop is TestPayloadOne => (prop.type === 'payloadOne'),
            callback: async (props: { payloads: TestPayloadOne[], messageBus: InternalMessageBus<TestPayload>, activeFlushLane: string | undefined }) => {
                props.payloads.forEach(({ value }) => {
                    messageBus.send({
                        type: 'payloadTwo',
                        value: value.length
                    }, lane)
                    outputs.push(`String: ${value}`)
                })
            }
        })
        messageBus.subscribe({
            tag: 'testSubscribeTwo',
            priority: 2,
            filter: (prop: TestPayload) => (prop.type === 'payloadTwo'),
            callback: async (props: { payloads: TestPayload[], messageBus: InternalMessageBus<TestPayload>, activeFlushLane: string | undefined }) => {
                props.payloads.forEach(({ value }) => {
                    outputs.push(`Number: ${value}`)
                })
            }
        })
        messageBus.send({
            type: 'payloadOne',
            value: 'Test'
        }, lane)
        messageBus.send({
            type: 'payloadTwo',
            value: -1
        }, lane)
        messageBus.send({
            type: 'payloadOne',
            value: 'Other Test'
        }, lane)

        await messageBus.flush(lane)
        expect(outputs).toEqual(['String: Test', 'String: Other Test', 'Number: -1', 'Number: 4', 'Number: 10'])
    })

    it('should leave default-lane sends from a named flush until flush()', async () => {
        const messageBus = new InternalMessageBus<TestPayload>()
        const outputs: string[] = []
        messageBus.subscribe({
            tag: 'laneSub',
            priority: 1,
            filter: (prop: TestPayload): prop is TestPayloadOne => (
                prop.type === 'payloadOne' && prop.value === 'start'
            ),
            callback: async ({ payloads }) => {
                payloads.forEach(({ value }) => {
                    outputs.push(`lane:${value}`)
                    messageBus.send({
                        type: 'payloadOne',
                        value: 'fromCallback'
                    })
                })
            }
        })
        messageBus.subscribe({
            tag: 'defaultSub',
            priority: 2,
            filter: (prop: TestPayload): prop is TestPayloadOne => (
                prop.type === 'payloadOne' && prop.value === 'fromCallback'
            ),
            callback: async ({ payloads }) => {
                payloads.forEach(({ value }) => {
                    outputs.push(`default:${value}`)
                })
            }
        })
        messageBus.send({
            type: 'payloadOne',
            value: 'start'
        }, 'L')
        await messageBus.flush('L')
        expect(outputs).toEqual(['lane:start'])
        await messageBus.flush()
        expect(outputs).toEqual(['lane:start', 'default:fromCallback'])
    })

    it('passes activeFlushLane matching the flush scope', async () => {
        const messageBus = new InternalMessageBus<string>()
        const recorded: Array<string | undefined> = []
        messageBus.subscribe({
            tag: 'sub',
            priority: 1,
            filter: () => true,
            callback: async ({ activeFlushLane }) => {
                recorded.push(activeFlushLane)
            }
        })
        messageBus.send('defaultOnly')
        messageBus.send('namedOnly', 'laneZ')
        await messageBus.flush()
        await messageBus.flush('laneZ')
        expect(recorded).toEqual([undefined, 'laneZ'])
    })

    it('should treat empty string lane id as default lane', async () => {
        const messageBus = new InternalMessageBus<TestPayload>()
        const outputs: string[] = []
        messageBus.subscribe({
            tag: 'sub',
            priority: 1,
            filter: (prop: TestPayload): prop is TestPayloadOne => (prop.type === 'payloadOne'),
            callback: async ({ payloads }) => {
                payloads.forEach(({ value }) => { outputs.push(value) })
            }
        })
        messageBus.send({
            type: 'payloadOne',
            value: 'emptyLane'
        }, '')
        await messageBus.flush()
        expect(outputs).toEqual(['emptyLane'])
    })

    it('orders lane flush vs post-gate default send when a handler awaits createAsyncGate', async () => {
        const messageBus = new InternalMessageBus<string>()
        const onA = jest.fn<void, [string]>()
        const asyncGate = createAsyncGate(() => {})

        messageBus.subscribe({
            tag: 'handlerA',
            priority: 2,
            filter: (p): p is string => (p === 'fromLaneFlush' || p === 'fromDefaultAfterGate'),
            callback: async ({ payloads }) => {
                payloads.forEach((p) => { onA(p) })
            }
        })
        messageBus.subscribe({
            tag: 'handlerB',
            priority: 1,
            filter: (p): p is string => (p === 'kickoff'),
            callback: async ({ messageBus: mb }) => {
                mb.send('fromLaneFlush', 'sideLane')
                await mb.flush('sideLane')
                await asyncGate.fn()
                mb.send('fromDefaultAfterGate')
            }
        })

        messageBus.send('kickoff')
        const flushPromise = messageBus.flush()

        // Past flush microtasks and past createAsyncGate impl's setImmediate so fn is blocked on the hold.
        await new Promise<void>((r) => { setImmediate(r) })
        expect(onA).toHaveBeenCalledTimes(1)
        expect(onA).toHaveBeenNthCalledWith(1, 'fromLaneFlush')

        asyncGate.resolve()
        await Promise.resolve()
        await flushPromise

        expect(onA).toHaveBeenCalledTimes(2)
        expect(onA).toHaveBeenNthCalledWith(2, 'fromDefaultAfterGate')
    })

})

describe('publish / settle / flushAndSettle', () => {
    afterEach(async () => {
        jest.restoreAllMocks()
    })

    it('returns false from flush and settle on an empty bus', async () => {
        const messageBus = new InternalMessageBus<string>()
        expect(await messageBus.flush()).toBe(false)
        expect(await messageBus.settle()).toBe(false)
    })

    it('processes a single publish subscriber with single-item payloads and undefined activeFlushLane', async () => {
        const messageBus = new InternalMessageBus<TestPayload>()
        const outputs: string[] = []
        let receivedActiveFlushLane: string | undefined = 'unset'

        messageBus.subscribe({
            tag: 'singleSub',
            priority: 1,
            filter: (prop: TestPayload): prop is TestPayloadOne => (prop.type === 'payloadOne'),
            callback: async ({ payloads, activeFlushLane }) => {
                receivedActiveFlushLane = activeFlushLane
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
        expect(receivedActiveFlushLane).toBeUndefined()
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

    it('flushAndSettle drains cross-seam ping-pong between flush and publish paths', async () => {
        const messageBus = new InternalMessageBus<string>()
        const outputs: string[] = []

        messageBus.subscribe({
            tag: 'flushHandler',
            priority: 1,
            filter: (p) => p === 'flushKickoff',
            callback: async ({ messageBus: mb }) => {
                outputs.push('flushHandler')
                mb.publish('publishFromFlush')
            }
        })
        messageBus.subscribe({
            tag: 'publishHandler',
            priority: 1,
            filter: (p) => p === 'publishFromFlush',
            callback: async ({ messageBus: mb }) => {
                outputs.push('publishHandler')
                mb.send('flushFollowup')
            }
        })
        messageBus.subscribe({
            tag: 'secondFlushHandler',
            priority: 1,
            filter: (p) => p === 'flushFollowup',
            callback: async () => {
                outputs.push('secondFlushHandler')
            }
        })

        messageBus.send('flushKickoff')
        await messageBus.flushAndSettle()

        expect(outputs).toEqual(['flushHandler', 'publishHandler', 'secondFlushHandler'])
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

    it('flush returns true when work was processed', async () => {
        const messageBus = new InternalMessageBus<string>()
        messageBus.subscribe({
            tag: 'sub',
            priority: 1,
            filter: () => true,
            callback: async () => {}
        })
        messageBus.send('msg')
        expect(await messageBus.flush()).toBe(true)
        expect(await messageBus.flush()).toBe(false)
    })
})

