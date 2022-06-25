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
})