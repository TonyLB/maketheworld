import { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { computePerspectiveId } from './perspectiveId'

describe('computePerspectiveId', () => {
    it('returns the same id for the same assetStack', () => {
        const stack: AssetUUID[] = ['ASSET#one', 'ASSET#two']
        const first = computePerspectiveId(stack)
        const second = computePerspectiveId(stack)
        expect(first).toBe(second)
    })

    it('is sensitive to asset ordering', () => {
        const forward = computePerspectiveId(['ASSET#one', 'ASSET#two'] as AssetUUID[])
        const reverse = computePerspectiveId(['ASSET#two', 'ASSET#one'] as AssetUUID[])
        expect(forward).not.toBe(reverse)
    })

    it('handles empty stacks deterministically', () => {
        const first = computePerspectiveId([] as AssetUUID[])
        const second = computePerspectiveId([] as AssetUUID[])
        expect(first).toBe(second)
    })
})

