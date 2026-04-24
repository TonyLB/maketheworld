import { planPromoteToCanonSteps, runPromoteToCanonOnBus } from './promoteToCanon'
import type { StreamingEventMessage } from './messageBus/baseClasses'

describe('planPromoteToCanonSteps', () => {
    it('returns no steps when already Canon', () => {
        expect(planPromoteToCanonSteps('Canon')).toEqual([])
    })

    it('returns only canonize when in Library', () => {
        expect(planPromoteToCanonSteps('Library')).toEqual([{ kind: 'canonize' }])
    })

    it('returns move to Library then canonize for Personal', () => {
        expect(planPromoteToCanonSteps('Personal')).toEqual([
            { kind: 'moveAsset', fromZone: 'Personal', toZone: 'Library' },
            { kind: 'canonize' },
        ])
    })

    it('returns move to Library then canonize for Draft', () => {
        expect(planPromoteToCanonSteps('Draft')).toEqual([
            { kind: 'moveAsset', fromZone: 'Draft', toZone: 'Library' },
            { kind: 'canonize' },
        ])
    })

    it('returns move to Library then canonize for Archive', () => {
        expect(planPromoteToCanonSteps('Archive')).toEqual([
            { kind: 'moveAsset', fromZone: 'Archive', toZone: 'Library' },
            { kind: 'canonize' },
        ])
    })
})

describe('runPromoteToCanonOnBus', () => {
    it('sends move then canonize with a flush after each for Draft', async () => {
        const sent: StreamingEventMessage[] = []
        let flushCount = 0
        const bus = {
            send: (p: StreamingEventMessage) => {
                sent.push(p)
            },
            flush: async () => {
                flushCount += 1
            },
        }
        await runPromoteToCanonOnBus(bus, 'ASSET#test', 'Draft')
        expect(flushCount).toBe(2)
        expect(sent).toHaveLength(2)
        expect(sent[0].header.type).toBe('Move Asset')
        expect(sent[1].header.type).toBe('Canonize Asset')
    })

    it('flushes once for Library-only path', async () => {
        const sent: StreamingEventMessage[] = []
        let flushCount = 0
        const bus = {
            send: (p: StreamingEventMessage) => {
                sent.push(p)
            },
            flush: async () => {
                flushCount += 1
            },
        }
        await runPromoteToCanonOnBus(bus, 'ASSET#x', 'Library')
        expect(flushCount).toBe(1)
        expect(sent).toHaveLength(1)
        expect(sent[0].header.type).toBe('Canonize Asset')
    })

    it('does not send or flush when already Canon', async () => {
        const sent: StreamingEventMessage[] = []
        let flushCount = 0
        const bus = {
            send: (p: StreamingEventMessage) => {
                sent.push(p)
            },
            flush: async () => {
                flushCount += 1
            },
        }
        await runPromoteToCanonOnBus(bus, 'ASSET#x', 'Canon')
        expect(flushCount).toBe(0)
        expect(sent).toHaveLength(0)
    })
})
