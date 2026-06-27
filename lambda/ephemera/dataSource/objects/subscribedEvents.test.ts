import {
    isDiagnosticsOrphanedImprovisedObjectFindingEnvelope,
    isEphemeraActionsAcmeOrderEnvelope,
    isEphemeraActionsAwaitRoadRunnerEnvelope,
    isEphemeraActionsPredictHypothesisEnvelope,
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

    it('accepts Predict Hypothesis envelope from mtw.ephemera.actions', () => {
        const envelope = {
            header: {
                dataSourceKey: 'mtw.ephemera.actions',
                streamKey: 'CHARACTER#123',
                timestamp: Date.now(),
                type: 'Predict Hypothesis',
            },
            getContent: () =>
                Promise.resolve({
                    type: 'Predict Hypothesis',
                    characterId: 'CHARACTER#123',
                    confidence: 0.91,
                }),
        }

        expect(isEphemeraActionsPredictHypothesisEnvelope(envelope as any)).toBe(true)
        expect(isObjectsSubscribedEnvelope(envelope as any)).toBe(false)
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

    it('accepts Orphaned Improvised Object Finding from mtw.diagnostics', () => {
        const envelope = {
            header: {
                dataSourceKey: 'mtw.diagnostics',
                streamKey: 'global',
                timestamp: Date.now(),
                type: 'Orphaned Improvised Object Finding' as const,
            },
            getContent: () =>
                Promise.resolve({
                    type: 'Orphaned Improvised Object Finding' as const,
                    objectId: 'OBJECT#Skates',
                    diagnosticRunId: 'run-1',
                    timestamp: '2025-01-01T00:00:00.000Z',
                }),
        }

        expect(isDiagnosticsOrphanedImprovisedObjectFindingEnvelope(envelope as any)).toBe(true)
        expect(isObjectsSubscribedEnvelope(envelope as any)).toBe(true)
    })

    it('rejects other diagnostics event types', () => {
        const envelope = {
            header: {
                dataSourceKey: 'mtw.diagnostics',
                streamKey: 'global',
                timestamp: Date.now(),
                type: 'Room Occupancy Drift Finding',
            },
            getContent: () => Promise.resolve({}),
        }

        expect(isDiagnosticsOrphanedImprovisedObjectFindingEnvelope(envelope as any)).toBe(false)
        expect(isObjectsSubscribedEnvelope(envelope as any)).toBe(false)
    })
})
