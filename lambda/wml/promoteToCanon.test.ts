import { planPromoteToCanonSteps, runPromoteToCanonOnBus } from './promoteToCanon'
import type { StreamingEventMessage } from './messageBus/baseClasses'
import type { Zone } from '@tonylb/mtw-interfaces/ts/baseClasses'

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
    type SentItem = { payload: StreamingEventMessage; laneId?: string }

    const makeBus = () => {
        const sent: SentItem[] = []
        const flushLanes: (string | undefined)[] = []
        const bus = {
            send: (p: StreamingEventMessage, laneId?: string) => {
                sent.push({ payload: p, laneId })
            },
            flush: async (laneId?: string) => {
                flushLanes.push(laneId)
            },
        }
        return { sent, bus, flushLanes }
    }

    it('sends move then canonize with a flush after each for Draft when zone advances after each step', async () => {
        const { sent, bus, flushLanes } = makeBus()
        const zones: Zone[] = ['Draft', 'Library', 'Canon']
        let i = 0
        await runPromoteToCanonOnBus(bus, 'ASSET#test', async () => {
            const zone = zones[i++]
            return { zone, player: zone === 'Draft' ? 'bob' : undefined }
        })
        expect(flushLanes).toHaveLength(2)
        expect(sent).toHaveLength(2)
        const lane = sent[0].laneId
        expect(lane).toMatch(/^promoteToCanon:ASSET#test:/)
        expect(sent[1].laneId).toBe(lane)
        expect(flushLanes).toEqual([lane, lane])
        expect(sent[0].payload.header.type).toBe('Move Asset')
        expect(sent[1].payload.header.type).toBe('Canonize Asset')
        const moveContent = (await sent[0].payload.getContent()) as { player?: string; fromZone: Zone; toZone: string }
        expect(moveContent.player).toBe('bob')
        expect(moveContent.fromZone).toBe('Draft')
    })

    it('flushes once for Library-only path when zone is Library then Canon', async () => {
        const { sent, bus, flushLanes } = makeBus()
        const zones: Zone[] = ['Library', 'Canon']
        let i = 0
        await runPromoteToCanonOnBus(bus, 'ASSET#x', async () => ({ zone: zones[i++] }))
        expect(flushLanes).toHaveLength(1)
        expect(sent).toHaveLength(1)
        const lane = sent[0].laneId
        expect(lane).toMatch(/^promoteToCanon:ASSET#x:/)
        expect(flushLanes).toEqual([lane])
        expect(sent[0].payload.header.type).toBe('Canonize Asset')
    })

    it('does not send or flush when already Canon', async () => {
        const { sent, bus, flushLanes } = makeBus()
        await runPromoteToCanonOnBus(bus, 'ASSET#x', async () => ({ zone: 'Canon' }))
        expect(flushLanes).toHaveLength(0)
        expect(sent).toHaveLength(0)
    })

    it('skips canonize when zone becomes Canon before canonize step (e.g. concurrent writer)', async () => {
        const { sent, bus, flushLanes } = makeBus()
        const zones: Zone[] = ['Draft', 'Canon']
        let i = 0
        await runPromoteToCanonOnBus(bus, 'ASSET#race', async () => {
            const zone = zones[i++]
            return { zone, player: zone === 'Draft' ? 'bob' : undefined }
        })
        expect(flushLanes).toHaveLength(1)
        expect(sent).toHaveLength(1)
        expect(flushLanes[0]).toBe(sent[0].laneId)
        expect(sent[0].payload.header.type).toBe('Move Asset')
    })
})
