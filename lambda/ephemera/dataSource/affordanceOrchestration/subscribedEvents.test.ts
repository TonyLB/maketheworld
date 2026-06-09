import {
    affordanceOrchestrationIngressLaneId,
    isAffordanceOrchestrationIngressEnvelope,
    isAffordanceOrchestrationSubscribedEnvelope,
    sendAffordancesRequested,
} from './subscribedEvents'

describe('affordanceOrchestration subscribedEvents', () => {
    it('sendAffordancesRequested emits api.ephemera StreamingEvent envelope on affordanceOrchestration lane', async () => {
        const calls: { payload: any; lane?: string }[] = []
        sendAffordancesRequested({ send: (payload, lane) => calls.push({ payload, lane }) }, 'ROOM#one', {
            roomId: 'ROOM#one',
            perspective: { assetStack: ['ASSET#one'] },
            reason: 'roster',
        })
        expect(calls).toHaveLength(1)
        expect(calls[0].lane).toBe(affordanceOrchestrationIngressLaneId('ROOM#one'))
        const sent = calls.map((c) => c.payload)
        expect(sent[0].header.type).toBe('Affordances Requested')
        expect(await sent[0].getContent()).toMatchObject({
            roomId: 'ROOM#one',
            reason: 'roster',
        })
    })

    it('sendAffordancesRequested with useDefaultMessageBusLane does not set a named lane', () => {
        const calls: { payload: unknown; lane?: string }[] = []
        sendAffordancesRequested(
            { send: (payload, lane) => calls.push({ payload, lane }) },
            'ROOM#one',
            {
                roomId: 'ROOM#one',
                perspective: { assetStack: ['ASSET#one'] },
                reason: 'objects',
            },
            { useDefaultMessageBusLane: true }
        )
        expect(calls).toHaveLength(1)
        expect(calls[0].lane).toBeUndefined()
    })

    it('isAffordanceOrchestrationIngressEnvelope accepts Affordances Requested and rejects unrelated', () => {
        const accepted = {
            header: {
                dataSourceKey: 'api.ephemera',
                streamKey: 'ROOM#one',
                timestamp: Date.now(),
                type: 'Affordances Requested',
            },
            getContent: () => Promise.resolve({}),
        }
        const rejected = {
            header: {
                dataSourceKey: 'api.ephemera',
                streamKey: 'ROOM#one',
                timestamp: Date.now(),
                type: 'Render Requested',
            },
            getContent: () => Promise.resolve({}),
        }
        expect(isAffordanceOrchestrationIngressEnvelope(accepted)).toBe(true)
        expect(isAffordanceOrchestrationIngressEnvelope(rejected)).toBe(false)
    })

    it('isAffordanceOrchestrationSubscribedEnvelope accepts ingress and mtw.ephemera.objects Objects Changed', () => {
        expect(
            isAffordanceOrchestrationSubscribedEnvelope({
                header: {
                    dataSourceKey: 'api.ephemera',
                    streamKey: 'ROOM#one',
                    timestamp: Date.now(),
                    type: 'Affordances Requested',
                },
                getContent: () => Promise.resolve({}),
            } as any)
        ).toBe(true)
        expect(
            isAffordanceOrchestrationSubscribedEnvelope({
                header: {
                    dataSourceKey: 'mtw.ephemera.objects',
                    streamKey: 'ROOM#one',
                    timestamp: Date.now(),
                    type: 'Objects Changed',
                },
                getContent: () => Promise.resolve({ type: 'Objects Changed' }),
            } as any)
        ).toBe(true)
        expect(
            isAffordanceOrchestrationSubscribedEnvelope({
                header: {
                    dataSourceKey: 'mtw.assets.componentTopology',
                    streamKey: 'ROOM#one',
                    timestamp: Date.now(),
                    type: 'TopologyInvalidated',
                },
                getContent: () => Promise.resolve({ type: 'TopologyInvalidated' }),
            } as any)
        ).toBe(true)
        expect(
            isAffordanceOrchestrationSubscribedEnvelope({
                header: {
                    dataSourceKey: 'mtw.ephemera.state',
                    streamKey: 'ROOM#one',
                    timestamp: Date.now(),
                    type: 'State Changed',
                },
                getContent: () => Promise.resolve({}),
            } as any)
        ).toBe(false)
    })

    it('isAffordanceOrchestrationSubscribedEnvelope accepts mtw.connections Character Registered', () => {
        expect(
            isAffordanceOrchestrationSubscribedEnvelope({
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
            } as any)
        ).toBe(true)
    })
})
