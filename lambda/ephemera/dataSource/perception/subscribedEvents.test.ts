import {
    isCharacterPerceptionRequestedIngressEnvelope,
    isPerceptionSubscribedEnvelope,
    sendCharacterPerceptionRequested,
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

    it('isPerceptionSubscribedEnvelope matches Character ingress only', () => {
        const accepted = {
            header: {
                dataSourceKey: 'api.ephemera',
                streamKey: 'CHARACTER#ONE',
                timestamp: Date.now(),
                type: 'Character Perception Requested',
            },
            getContent: () => Promise.resolve({}),
        }
        expect(isPerceptionSubscribedEnvelope(accepted as any)).toBe(true)
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
