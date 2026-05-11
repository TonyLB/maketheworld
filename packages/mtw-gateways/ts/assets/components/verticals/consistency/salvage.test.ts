import { salvageImportVerticalHops, type RawImportVerticalHop } from './salvage'

describe('salvageImportVerticalHops', () => {
    it('returns empty for empty input', () => {
        expect(salvageImportVerticalHops([])).toEqual([])
    })

    it('is a no-op on an acyclic chain', () => {
        const hops: RawImportVerticalHop[] = [
            { parentAssetId: 'ASSET#a', childAssetId: 'ASSET#b' },
            { parentAssetId: 'ASSET#b', childAssetId: 'ASSET#c' },
        ]
        expect(salvageImportVerticalHops(hops)).toEqual(hops)
    })

    it('breaks a 3-cycle by removing the hop with minimum stripped parent, tie-break child', () => {
        const cycle: RawImportVerticalHop[] = [
            { parentAssetId: 'ASSET#m', childAssetId: 'ASSET#y' },
            { parentAssetId: 'ASSET#y', childAssetId: 'ASSET#z' },
            { parentAssetId: 'ASSET#z', childAssetId: 'ASSET#m' },
        ]
        const result = salvageImportVerticalHops(cycle)
        expect(result).toHaveLength(2)
        expect(result).not.toContainEqual({ parentAssetId: 'ASSET#m', childAssetId: 'ASSET#y' })
    })

    it('removes a self-loop', () => {
        const hops: RawImportVerticalHop[] = [
            { parentAssetId: 'ASSET#same', childAssetId: 'ASSET#same' },
            { parentAssetId: 'ASSET#root', childAssetId: 'ASSET#leaf' },
        ]
        const result = salvageImportVerticalHops(hops)
        expect(result).toEqual([{ parentAssetId: 'ASSET#root', childAssetId: 'ASSET#leaf' }])
    })

    it('handles two disjoint cycles by successive removals', () => {
        const hops: RawImportVerticalHop[] = [
            { parentAssetId: 'ASSET#a', childAssetId: 'ASSET#b' },
            { parentAssetId: 'ASSET#b', childAssetId: 'ASSET#a' },
            { parentAssetId: 'ASSET#c', childAssetId: 'ASSET#d' },
            { parentAssetId: 'ASSET#d', childAssetId: 'ASSET#c' },
        ]
        const result = salvageImportVerticalHops(hops)
        expect(result).toHaveLength(2)
    })
})
