import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { mergeOriginChainsToOrderedAssets } from './mergeOriginChains'

describe('mergeOriginChainsToOrderedAssets', () => {
    it('returns empty array for empty input', () => {
        expect(mergeOriginChainsToOrderedAssets([])).toEqual([])
    })

    it('returns single chain as-is', () => {
        const chain: AssetUUID[] = ['ASSET#a', 'ASSET#b', 'ASSET#c']
        expect(mergeOriginChainsToOrderedAssets([chain])).toEqual(chain)
    })

    it('handles one empty chain by filtering it out', () => {
        expect(mergeOriginChainsToOrderedAssets([[]])).toEqual([])
    })

    it('merges two chains that share a prefix', () => {
        const chain1: AssetUUID[] = ['ASSET#base', 'ASSET#mid', 'ASSET#leaf1']
        const chain2: AssetUUID[] = ['ASSET#base', 'ASSET#mid', 'ASSET#leaf2']
        const result = mergeOriginChainsToOrderedAssets([chain1, chain2])
        expect(result).toContain('ASSET#base')
        expect(result).toContain('ASSET#mid')
        expect(result).toContain('ASSET#leaf1')
        expect(result).toContain('ASSET#leaf2')
        expect(result.indexOf('ASSET#base')).toBeLessThan(result.indexOf('ASSET#mid'))
        expect(result.indexOf('ASSET#mid')).toBeLessThan(result.indexOf('ASSET#leaf1'))
        expect(result.indexOf('ASSET#mid')).toBeLessThan(result.indexOf('ASSET#leaf2'))
    })

    it('merges two chains with different order (no cycle)', () => {
        const chain1: AssetUUID[] = ['ASSET#a', 'ASSET#b']
        const chain2: AssetUUID[] = ['ASSET#b', 'ASSET#c']
        const result = mergeOriginChainsToOrderedAssets([chain1, chain2])
        expect(result.indexOf('ASSET#a')).toBeLessThan(result.indexOf('ASSET#b'))
        expect(result.indexOf('ASSET#b')).toBeLessThan(result.indexOf('ASSET#c'))
        expect(result).toHaveLength(3)
    })

    it('falls back to deterministic order when chains disagree (cycle)', () => {
        const chain1: AssetUUID[] = ['ASSET#a', 'ASSET#b']
        const chain2: AssetUUID[] = ['ASSET#b', 'ASSET#a']
        const result = mergeOriginChainsToOrderedAssets([chain1, chain2])
        expect(result).toContain('ASSET#a')
        expect(result).toContain('ASSET#b')
        expect(result).toHaveLength(2)
    })

    it('cycle plus disjoint node: all IDs in result, SCC order and sort within cycle', () => {
        const chain1: AssetUUID[] = ['ASSET#x', 'ASSET#y']
        const chain2: AssetUUID[] = ['ASSET#y', 'ASSET#x']
        const chain3: AssetUUID[] = ['ASSET#z']
        const result = mergeOriginChainsToOrderedAssets([chain1, chain2, chain3])
        expect(result).toContain('ASSET#x')
        expect(result).toContain('ASSET#y')
        expect(result).toContain('ASSET#z')
        expect(result).toHaveLength(3)
    })
})
