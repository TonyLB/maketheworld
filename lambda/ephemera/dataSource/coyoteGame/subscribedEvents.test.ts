import { isCoyoteGameSubscribedEnvelope } from './subscribedEvents'

describe('coyoteGame subscribedEvents', () => {
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

        expect(isCoyoteGameSubscribedEnvelope(envelope as any)).toBe(true)
    })

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

        expect(isCoyoteGameSubscribedEnvelope(envelope as any)).toBe(true)
    })

    it('rejects Object Moved envelope from mtw.ephemera.positions', () => {
        const envelope = {
            header: {
                dataSourceKey: 'mtw.ephemera.positions',
                streamKey: 'OBJECT#o1',
                timestamp: Date.now(),
                type: 'Object Moved',
            },
            getContent: () =>
                Promise.resolve({
                    type: 'Object Moved',
                    objectId: 'OBJECT#o1',
                    froms: [],
                    to: 'ROOM#VORTEX',
                    beatAnchorTime: Date.now(),
                }),
        }

        expect(isCoyoteGameSubscribedEnvelope(envelope as any)).toBe(false)
    })
})
