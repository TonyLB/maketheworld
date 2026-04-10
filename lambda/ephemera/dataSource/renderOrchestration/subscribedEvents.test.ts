import {
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
})
