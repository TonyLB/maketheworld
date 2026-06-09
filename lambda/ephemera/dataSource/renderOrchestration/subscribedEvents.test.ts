import {
    isLookCommandRequestedActionsEnvelope,
    isRenderOrchestrationIngressEnvelope,
    isRenderOrchestrationSubscribedEnvelope,
    renderOrchestrationIngressLaneId,
    sendRenderRequested,
} from './subscribedEvents'

describe('renderOrchestration subscribedEvents', () => {
    it('sendRenderRequested emits api.ephemera StreamingEvent envelope on renderOrchestration lane', async () => {
        const calls: { payload: any; lane?: string }[] = []
        sendRenderRequested({ send: (payload, lane) => calls.push({ payload, lane }) }, 'ROOM#one', {
            componentId: 'ROOM#one',
            perspective: { assetStack: ['ASSET#one'] },
            allowGeneration: false,
        })
        expect(calls).toHaveLength(1)
        expect(calls[0].lane).toBe(renderOrchestrationIngressLaneId('ROOM#one'))
        const sent = calls.map((c) => c.payload)
        expect(sent[0].header.type).toBe('Render Requested')
        expect(await sent[0].getContent()).toMatchObject({
            componentId: 'ROOM#one',
            allowGeneration: false,
        })
    })

    it('sendRenderRequested with useDefaultMessageBusLane does not set a named lane', () => {
        const calls: { payload: unknown; lane?: string }[] = []
        sendRenderRequested(
            { send: (payload, lane) => calls.push({ payload, lane }) },
            'ROOM#one',
            {
                componentId: 'ROOM#one',
                perspective: { assetStack: ['ASSET#one'] },
            },
            { useDefaultMessageBusLane: true }
        )
        expect(calls).toHaveLength(1)
        expect(calls[0].lane).toBeUndefined()
    })

    it('isRenderOrchestrationIngressEnvelope accepts Render Requested and rejects unrelated', () => {
        const acceptedRequested = {
            header: {
                dataSourceKey: 'api.ephemera',
                streamKey: 'ROOM#one',
                timestamp: Date.now(),
                type: 'Render Requested',
            },
            getContent: () => Promise.resolve({}),
        }
        // Removed ingress type: only here so the guard keeps rejecting it (grep may still find this string).
        const rejectedPreview = {
            header: {
                dataSourceKey: 'api.ephemera',
                streamKey: 'ROOM#one',
                timestamp: Date.now(),
                type: 'Render Preview Requested',
            },
            getContent: () => Promise.resolve({}),
        }
        const rejected = {
            header: {
                dataSourceKey: 'api.ephemera',
                streamKey: 'ROOM#one',
                timestamp: Date.now(),
                type: 'Put Cache Record',
            },
            getContent: () => Promise.resolve({}),
        }
        expect(isRenderOrchestrationIngressEnvelope(acceptedRequested)).toBe(true)
        expect(isRenderOrchestrationIngressEnvelope(rejectedPreview)).toBe(false)
        expect(isRenderOrchestrationIngressEnvelope(rejected)).toBe(false)
    })

    it('isRenderOrchestrationSubscribedEnvelope accepts ingress and mtw.ephemera.state State Changed', () => {
        const stateChanged = {
            header: {
                dataSourceKey: 'mtw.ephemera.state',
                streamKey: 'ROOM#one',
                timestamp: Date.now(),
                type: 'State Changed',
            },
            getContent: () => Promise.resolve({ type: 'State Changed' }),
        }
        expect(isRenderOrchestrationSubscribedEnvelope(stateChanged as any)).toBe(true)
        expect(
            isRenderOrchestrationSubscribedEnvelope({
                header: {
                    dataSourceKey: 'api.ephemera',
                    streamKey: 'ROOM#one',
                    timestamp: Date.now(),
                    type: 'Render Requested',
                },
                getContent: () => Promise.resolve({}),
            } as any)
        ).toBe(true)
        expect(
            isRenderOrchestrationSubscribedEnvelope({
                header: {
                    dataSourceKey: 'api.ephemera',
                    streamKey: 'ROOM#one',
                    timestamp: Date.now(),
                    type: 'Put Cache Record',
                },
                getContent: () => Promise.resolve({}),
            } as any)
        ).toBe(false)
    })

    it('isRenderOrchestrationSubscribedEnvelope accepts mtw.ephemera.actions Look Command Requested', () => {
        const look = {
            header: {
                dataSourceKey: 'mtw.ephemera.actions',
                streamKey: 'CHARACTER#c',
                timestamp: Date.now(),
                type: 'Look Command Requested',
            },
            getContent: () => Promise.resolve({
                type: 'Look Command Requested',
                characterId: 'CHARACTER#c',
                roomId: 'ROOM#r',
                confidence: 1,
            }),
        }
        expect(isRenderOrchestrationSubscribedEnvelope(look as any)).toBe(true)
        expect(isLookCommandRequestedActionsEnvelope(look as any)).toBe(true)
    })

    it('isRenderOrchestrationSubscribedEnvelope accepts mtw.connections Character Registered', () => {
        const registered = {
            header: {
                dataSourceKey: 'mtw.connections',
                streamKey: 'CHARACTER#alpha',
                timestamp: Date.now(),
                type: 'Character Registered',
            },
            getContent: () => Promise.resolve({
                type: 'Character Registered',
                characterId: 'CHARACTER#alpha',
                sessionId: 'SESSION#1',
                timestamp: '2026-06-08T12:00:00.000Z',
            }),
        }
        expect(isRenderOrchestrationSubscribedEnvelope(registered as any)).toBe(true)
    })
})
