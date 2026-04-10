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
            callback: async (props: { payloads: TestPayloadOne[], messageBus: InternalMessageBus<TestPayload> }) => {
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
            callback: async (props: { payloads: TestPayloadOne[], messageBus: InternalMessageBus<TestPayload> }) => {
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
            callback: async (props: { payloads: TestPayload[], messageBus: InternalMessageBus<TestPayload> }) => {
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
            callback: async (props: { payloads: TestPayloadOne[], messageBus: InternalMessageBus<TestPayload> }) => {
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
            callback: async (props: { payloads: TestPayload[], messageBus: InternalMessageBus<TestPayload> }) => {
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

})
