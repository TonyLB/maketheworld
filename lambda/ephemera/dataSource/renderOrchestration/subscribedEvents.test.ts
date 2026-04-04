import {
    isRenderOrchestrationIngressEnvelope,
    isRenderOrchestrationSubscribedEnvelope,
    sendRenderRequested,
} from './subscribedEvents'

describe('renderOrchestration subscribedEvents', () => {
    it('sendRenderRequested emits api.ephemera StreamingEvent envelope', async () => {
        const sent: any[] = []
        sendRenderRequested({ send: (payload) => sent.push(payload) }, 'ROOM#one', {
            componentId: 'ROOM#one',
            perspective: { assetStack: ['ASSET#one'] },
            allowGeneration: false,
        })
        expect(sent).toHaveLength(1)
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
