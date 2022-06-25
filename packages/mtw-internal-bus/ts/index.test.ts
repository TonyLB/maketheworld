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

})