import { assetStackIncludesEditAssetId } from './membership'

describe('assetStackIncludesEditAssetId', () => {
    const assetA = 'ASSET#canon' as const
    const assetB = 'ASSET#overlay' as const
    const assetC = 'ASSET#extra' as const

    it('returns false when edit layer is not in stack', () => {
        expect(assetStackIncludesEditAssetId([assetA], assetB)).toBe(false)
    })

    it('returns true when edit layer participates in stack', () => {
        expect(assetStackIncludesEditAssetId([assetA, assetB], assetB)).toBe(true)
        expect(assetStackIncludesEditAssetId([assetA, assetB, assetC], assetB)).toBe(true)
    })

    it('does not match prefix-only stacks when edit is in overlay only', () => {
        expect(assetStackIncludesEditAssetId([assetA], assetB)).toBe(false)
        expect(assetStackIncludesEditAssetId([assetA, assetB], assetB)).toBe(true)
    })

    it('returns true when edit layer appears in a stack with duplicate ids', () => {
        expect(assetStackIncludesEditAssetId([assetA, assetA, assetB], assetB)).toBe(true)
    })

    it('returns false for invalid editAssetId', () => {
        expect(assetStackIncludesEditAssetId([assetA, assetB], 'not-valid' as typeof assetB)).toBe(false)
    })
})
