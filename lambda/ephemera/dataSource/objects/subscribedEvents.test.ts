import {
    isEphemeraActionsAcmeOrderEnvelope,
    isEphemeraActionsAwaitRoadRunnerEnvelope,
    isObjectsSubscribedEnvelope,
} from './subscribedEvents'

describe('objects subscribedEvents', () => {
    it('accepts Await RoadRunner envelope from mtw.ephemera.actions', () => {
        const envelope = {
            header: {
                dataSourceKey: 'mtw.ephemera.actions',
                streamKey: 'CHARACTER#123',
                timestamp: Date.now(),
                type: 'Await RoadRunner',
            },
            getContent: () =>
                Promise.resolve({
                    type: 'Await RoadRunner',
                    characterId: 'CHARACTER#123',
                    confidence: 0.9,
                }),
        }

        expect(isEphemeraActionsAwaitRoadRunnerEnvelope(envelope as any)).toBe(true)
        expect(isObjectsSubscribedEnvelope(envelope as any)).toBe(true)
    })

    it('accepts Acme Order envelope from mtw.ephemera.actions', () => {
        const envelope = {
            header: {
                dataSourceKey: 'mtw.ephemera.actions',
                streamKey: 'CHARACTER#123',
                timestamp: Date.now(),
                type: 'Acme Order',
            },
            getContent: () =>
                Promise.resolve({
                    type: 'Acme Order',
                    characterId: 'CHARACTER#123',
                    orders: [{ shortName: 'anvil', stableKey: 'anvil' }],
                    confidence: 0.9,
                }),
        }

        expect(isEphemeraActionsAcmeOrderEnvelope(envelope as any)).toBe(true)
        expect(isObjectsSubscribedEnvelope(envelope as any)).toBe(true)
    })

    it('rejects non-Await events from mtw.ephemera.actions', () => {
        const envelope = {
            header: {
                dataSourceKey: 'mtw.ephemera.actions',
                streamKey: 'CHARACTER#123',
                timestamp: Date.now(),
                type: 'Character Navigate',
            },
            getContent: () => Promise.resolve({}),
        }

        expect(isEphemeraActionsAwaitRoadRunnerEnvelope(envelope as any)).toBe(false)
        expect(isObjectsSubscribedEnvelope(envelope as any)).toBe(false)
    })
})
