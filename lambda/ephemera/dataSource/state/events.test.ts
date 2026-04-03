import { isStateChangedPayload, isEphemeraStateStateChangedHeader } from './events'

describe('dataSource/state/events', () => {
    describe('isStateChangedPayload', () => {
        it('accepts a valid State Changed payload', () => {
            const payload = {
                type: 'State Changed' as const,
                componentId: 'ROOM#x',
                incomingMarkState: { markValue: [{ mark: 'M', value: 'v' }] },
                priorState: { marks: { markValue: [] } },
                newState: { marks: { markValue: [{ mark: 'M', value: 'v' }] } },
            }
            expect(isStateChangedPayload(payload)).toBe(true)
        })

        it('rejects wrong type', () => {
            expect(isStateChangedPayload({ type: 'Other' })).toBe(false)
        })
    })

    describe('isEphemeraStateStateChangedHeader', () => {
        it('matches mtw.ephemera.state State Changed', () => {
            expect(
                isEphemeraStateStateChangedHeader({
                    dataSourceKey: 'mtw.ephemera.state',
                    streamKey: 'ROOM#r',
                    timestamp: 1,
                    type: 'State Changed',
                })
            ).toBe(true)
        })

        it('rejects other dataSourceKey', () => {
            expect(
                isEphemeraStateStateChangedHeader({
                    dataSourceKey: 'api.ephemera',
                    streamKey: 'ROOM#r',
                    timestamp: 1,
                    type: 'State Changed',
                })
            ).toBe(false)
        })
    })
})
