jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

import { aggregatePerspectiveExplicit } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'

import internalCache from './index'

const assetDBMock = jest.mocked(assetDB)

describe('InternalCache ComponentAggregate registration', () => {
    beforeEach(() => {
        internalCache.clear()
        jest.clearAllMocks()
        assetDBMock.getItems.mockResolvedValue([] as any)
    })

    it('exposes ComponentAggregate wired to ComponentData participation reads', async () => {
        const roomU = 'ROOM#wireTest' as const
        const assetA = 'ASSET#wireA1' as const
        const perspective = aggregatePerspectiveExplicit({
            universalKey: roomU,
            mergeParticipationOrder: [assetA],
        })
        const [result] = await internalCache.ComponentAggregate.get([perspective])
        expect(result.universalKey).toBe(roomU)
        expect(assetDBMock.getItems).toHaveBeenCalled()
    })

    it('does not re-query Dynamo on aggregate cache hit until InternalCache.clear', async () => {
        const roomU = 'ROOM#wireTest2' as const
        const assetA = 'ASSET#wireA2' as const
        const perspective = aggregatePerspectiveExplicit({
            universalKey: roomU,
            mergeParticipationOrder: [assetA],
        })
        await internalCache.ComponentAggregate.get([perspective])
        const getItemsAfterFirst = assetDBMock.getItems.mock.calls.length

        await internalCache.ComponentAggregate.get([perspective])
        expect(assetDBMock.getItems.mock.calls.length).toEqual(getItemsAfterFirst)

        internalCache.clear()
        await internalCache.ComponentAggregate.get([perspective])
        expect(assetDBMock.getItems.mock.calls.length).toBeGreaterThan(getItemsAfterFirst)
    })
})

describe('InternalCache ComponentExamples registration', () => {
    beforeEach(() => {
        internalCache.clear()
        jest.clearAllMocks()
        assetDBMock.getItems.mockResolvedValue([] as any)
    })

    it('exposes ComponentExamples wired to ComponentAggregate', async () => {
        const roomU = 'ROOM#wireTest3' as const
        const assetA = 'ASSET#wireA3' as const
        const set = await internalCache.ComponentExamples.get({
            hostUniversalKey: roomU,
            mergeParticipationOrder: [assetA],
        })
        expect(set.size).toBe(0)
        expect(assetDBMock.getItems).toHaveBeenCalled()
    })

    it('does not re-query Dynamo on ComponentExamples cache hit until InternalCache.clear', async () => {
        const roomU = 'ROOM#wireTest4' as const
        const assetA = 'ASSET#wireA4' as const
        const input = { hostUniversalKey: roomU, mergeParticipationOrder: [assetA] } as const
        await internalCache.ComponentExamples.get(input)
        const getItemsAfterFirst = assetDBMock.getItems.mock.calls.length

        await internalCache.ComponentExamples.get(input)
        expect(assetDBMock.getItems.mock.calls.length).toEqual(getItemsAfterFirst)

        internalCache.clear()
        await internalCache.ComponentExamples.get(input)
        expect(assetDBMock.getItems.mock.calls.length).toBeGreaterThan(getItemsAfterFirst)
    })
})
