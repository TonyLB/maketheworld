import { planPromoteToCanonSteps, runPromoteToCanon } from './promoteToCanon'
import type { WmlStreamEventFn } from './dataSource/mtw-wml'
import type { MoveAssetRequest } from './dataSource/localApiEvents'
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

describe('runPromoteToCanon', () => {
    const makeDeps = () => {
        const moves: MoveAssetRequest[] = []
        const canonizeCalls: string[] = []
        const streamEventCalls: unknown[] = []
        const streamEvent: WmlStreamEventFn = async (params) => {
            streamEventCalls.push(params)
        }
        const coordinateMoveAsset = jest.fn(async (_assetId: string, request: MoveAssetRequest, _streamEvent: WmlStreamEventFn) => {
            moves.push(request)
        })
        const coordinateCanonizeAsset = jest.fn(async (assetId: string, _streamEvent: WmlStreamEventFn) => {
            canonizeCalls.push(assetId)
        })
        return { moves, canonizeCalls, streamEventCalls, deps: { streamEvent, coordinateMoveAsset, coordinateCanonizeAsset } }
    }

    it('coordinates move then canonize for Draft when zone advances after each step', async () => {
        const { moves, canonizeCalls, deps } = makeDeps()
        const zones: Zone[] = ['Draft', 'Library', 'Canon']
        let i = 0
        await runPromoteToCanon('ASSET#test', async () => {
            const zone = zones[i++]
            return { zone, player: zone === 'Draft' ? 'bob' : undefined }
        }, deps)
        expect(deps.coordinateMoveAsset).toHaveBeenCalledTimes(1)
        expect(deps.coordinateCanonizeAsset).toHaveBeenCalledTimes(1)
        expect(moves).toHaveLength(1)
        expect(canonizeCalls).toEqual(['ASSET#test'])
        expect(moves[0].player).toBe('bob')
        expect(moves[0].fromZone).toBe('Draft')
    })

    it('coordinates canonize only for Library-only path when zone is Library then Canon', async () => {
        const { moves, canonizeCalls, deps } = makeDeps()
        const zones: Zone[] = ['Library', 'Canon']
        let i = 0
        await runPromoteToCanon('ASSET#x', async () => ({ zone: zones[i++] }), deps)
        expect(deps.coordinateMoveAsset).not.toHaveBeenCalled()
        expect(deps.coordinateCanonizeAsset).toHaveBeenCalledTimes(1)
        expect(moves).toHaveLength(0)
        expect(canonizeCalls).toEqual(['ASSET#x'])
    })

    it('does not coordinate when already Canon', async () => {
        const { moves, canonizeCalls, deps } = makeDeps()
        await runPromoteToCanon('ASSET#x', async () => ({ zone: 'Canon' }), deps)
        expect(deps.coordinateMoveAsset).not.toHaveBeenCalled()
        expect(deps.coordinateCanonizeAsset).not.toHaveBeenCalled()
        expect(moves).toHaveLength(0)
        expect(canonizeCalls).toHaveLength(0)
    })

    it('skips canonize when zone becomes Canon before canonize step (e.g. concurrent writer)', async () => {
        const { moves, canonizeCalls, deps } = makeDeps()
        const zones: Zone[] = ['Draft', 'Canon']
        let i = 0
        await runPromoteToCanon('ASSET#race', async () => {
            const zone = zones[i++]
            return { zone, player: zone === 'Draft' ? 'bob' : undefined }
        }, deps)
        expect(deps.coordinateMoveAsset).toHaveBeenCalledTimes(1)
        expect(deps.coordinateCanonizeAsset).not.toHaveBeenCalled()
        expect(moves).toHaveLength(1)
        expect(canonizeCalls).toHaveLength(0)
        expect(moves[0].fromZone).toBe('Draft')
    })
})
