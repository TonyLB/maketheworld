import {
    isRenderOrchestrationIngressEnvelope,
    sendRenderPreviewRequested,
    sendRenderRequested,
} from './subscribedEvents'

describe('renderOrchestration subscribedEvents', () => {
    it('sendRenderPreviewRequested emits api.ephemera StreamingEvent envelope', async () => {
        const sent: any[] = []
        sendRenderPreviewRequested({ send: (payload) => sent.push(payload) }, 'ROOM#one', {
            componentId: 'ROOM#one',
            perspective: { assetStack: ['ASSET#one'] },
            markState: { markValue: [] },
            generationContextWml: '<Asset uuid=(a)><Room uuid=(r) key=(r) /></Asset>',
        })
        expect(sent).toHaveLength(1)
        expect(sent[0]).toMatchObject({
            type: 'StreamingEvent',
            dataSourceKey: 'api.ephemera',
            streamKey: 'ROOM#one',
        })
        expect(sent[0].header.type).toBe('Render Preview Requested')
        expect(await sent[0].getContent()).toMatchObject({
            componentId: 'ROOM#one',
            markState: { markValue: [] },
        })
    })

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

    it('isRenderOrchestrationIngressEnvelope accepts render ingress headers and rejects unrelated', () => {
        const acceptedPreview = {
            header: {
                dataSourceKey: 'api.ephemera',
                streamKey: 'ROOM#one',
                timestamp: Date.now(),
                type: 'Render Preview Requested',
            },
            getContent: () => Promise.resolve({}),
        }
        const acceptedRequested = {
            header: {
                dataSourceKey: 'api.ephemera',
                streamKey: 'ROOM#one',
                timestamp: Date.now(),
                type: 'Render Requested',
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
        expect(isRenderOrchestrationIngressEnvelope(acceptedPreview)).toBe(true)
        expect(isRenderOrchestrationIngressEnvelope(acceptedRequested)).toBe(true)
        expect(isRenderOrchestrationIngressEnvelope(rejected)).toBe(false)
    })
})
