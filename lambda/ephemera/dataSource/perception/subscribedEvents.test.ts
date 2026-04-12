import {
    isCharacterPerceptionRequestedIngressEnvelope,
    isPerceptionSubscribedEnvelope,
    isPerceptionThreadRegisteredIngressEnvelope,
    sendCharacterPerceptionRequested,
    sendPerceptionThreadRegistered,
} from './subscribedEvents'

describe('perception subscribedEvents', () => {
    it('sendCharacterPerceptionRequested emits api.ephemera StreamingEvent envelope', async () => {
        const sent: any[] = []
        sendCharacterPerceptionRequested(
            { send: (payload) => sent.push(payload) },
            'CHARACTER#VIEWED',
            {
                characterId: 'CHARACTER#VIEWER',
                ephemeraId: 'CHARACTER#VIEWED',
                messageGroupId: 'UUID#group',
            }
        )
        expect(sent).toHaveLength(1)
        expect(sent[0].type).toBe('StreamingEvent')
        expect(sent[0].dataSourceKey).toBe('api.ephemera')
        expect(sent[0].streamKey).toBe('CHARACTER#VIEWED')
        expect(sent[0].header.type).toBe('Character Perception Requested')
        expect(await sent[0].getContent()).toMatchObject({
            characterId: 'CHARACTER#VIEWER',
            ephemeraId: 'CHARACTER#VIEWED',
            messageGroupId: 'UUID#group',
        })
    })

    it('isCharacterPerceptionRequestedIngressEnvelope accepts Character Perception Requested and rejects unrelated', () => {
        const accepted = {
            header: {
                dataSourceKey: 'api.ephemera',
                streamKey: 'CHARACTER#ONE',
                timestamp: Date.now(),
                type: 'Character Perception Requested',
            },
            getContent: () =>
                Promise.resolve({
                    characterId: 'CHARACTER#TWO',
                    ephemeraId: 'CHARACTER#ONE',
                }),
        }
        const rejected = {
            header: {
                dataSourceKey: 'api.ephemera',
                streamKey: 'CHARACTER#ONE',
                timestamp: Date.now(),
                type: 'Render Requested',
            },
            getContent: () => Promise.resolve({}),
        }
        expect(isCharacterPerceptionRequestedIngressEnvelope(accepted)).toBe(true)
        expect(isCharacterPerceptionRequestedIngressEnvelope(rejected)).toBe(false)
    })

    it('sendPerceptionThreadRegistered emits api.ephemera StreamingEvent envelope', async () => {
        const sent: any[] = []
        sendPerceptionThreadRegistered(
            { send: (payload) => sent.push(payload) },
            'ROOM#ROOM1',
            {
                threadKind: 'roomDescription',
                componentId: 'ROOM#ROOM1',
                perspectiveKey: 'persp-a',
                characterId: 'CHARACTER#VIEWER',
            }
        )
        expect(sent).toHaveLength(1)
        expect(sent[0].type).toBe('StreamingEvent')
        expect(sent[0].dataSourceKey).toBe('api.ephemera')
        expect(sent[0].streamKey).toBe('ROOM#ROOM1')
        expect(sent[0].header.type).toBe('Perception Thread Registered')
        expect(await sent[0].getContent()).toMatchObject({
            threadKind: 'roomDescription',
            componentId: 'ROOM#ROOM1',
            perspectiveKey: 'persp-a',
            characterId: 'CHARACTER#VIEWER',
        })
    })

    it('isPerceptionThreadRegisteredIngressEnvelope accepts Perception Thread Registered and rejects unrelated', () => {
        const accepted = {
            header: {
                dataSourceKey: 'api.ephemera',
                streamKey: 'ROOM#R',
                timestamp: Date.now(),
                type: 'Perception Thread Registered',
            },
            getContent: () =>
                Promise.resolve({
                    threadKind: 'roomDescription',
                    componentId: 'ROOM#R',
                    perspectiveKey: 'p',
                    characterId: 'CHARACTER#viewer',
                }),
        }
        const rejected = {
            header: {
                dataSourceKey: 'api.ephemera',
                streamKey: 'ROOM#R',
                timestamp: Date.now(),
                type: 'Character Perception Requested',
            },
            getContent: () => Promise.resolve({}),
        }
        expect(isPerceptionThreadRegisteredIngressEnvelope(accepted)).toBe(true)
        expect(isPerceptionThreadRegisteredIngressEnvelope(rejected)).toBe(false)
    })

    it('isPerceptionSubscribedEnvelope matches Character or Perception Thread Registered ingress', () => {
        const character = {
            header: {
                dataSourceKey: 'api.ephemera',
                streamKey: 'CHARACTER#ONE',
                timestamp: Date.now(),
                type: 'Character Perception Requested',
            },
            getContent: () => Promise.resolve({}),
        }
        const threadReg = {
            header: {
                dataSourceKey: 'api.ephemera',
                streamKey: 'ROOM#one',
                timestamp: Date.now(),
                type: 'Perception Thread Registered',
            },
            getContent: () => Promise.resolve({
                threadKind: 'roomDescription',
                componentId: 'ROOM#one',
                perspectiveKey: 'k',
                characterId: 'CHARACTER#viewer',
            }),
        }
        expect(isPerceptionSubscribedEnvelope(character as any)).toBe(true)
        expect(isPerceptionSubscribedEnvelope(threadReg as any)).toBe(true)
        expect(
            isPerceptionSubscribedEnvelope({
                header: {
                    dataSourceKey: 'api.ephemera',
                    streamKey: 'ROOM#one',
                    timestamp: Date.now(),
                    type: 'Render Requested',
                },
                getContent: () => Promise.resolve({}),
            } as any)
        ).toBe(false)
    })
})
