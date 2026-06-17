jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
import { assetDB, ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

import { IMPROVISATION_ASSET_ID } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { aggregatePerspectiveExplicit } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import { componentTopologyPerspectiveCacheKey } from '@tonylb/mtw-gateways/ts/assets/components/componentTopology'
import { StandardObject } from '@tonylb/mtw-wml/ts/standardize/components/object'

import internalCache from './index'

const assetDBMock = jest.mocked(assetDB)
const ephemeraDBMock = jest.mocked(ephemeraDB)

const mockEmptyComponentDataReads = (): void => {
    assetDBMock.getItems.mockResolvedValue([] as any)
    assetDBMock.query.mockResolvedValue([] as any)
}

describe('InternalCache ComponentAggregate registration', () => {
    beforeEach(() => {
        internalCache.clear()
        jest.clearAllMocks()
        mockEmptyComponentDataReads()
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

    it('merges OBJECT# with improvisation layer last via composite ComponentData', async () => {
        const objectU = 'OBJECT#skates' as const
        const assetA = 'ASSET#wireCanon' as const
        assetDBMock.getItems.mockResolvedValue([])
        ephemeraDBMock.getItems.mockResolvedValue([{
            EphemeraId: objectU,
            DataCategory: IMPROVISATION_ASSET_ID,
            tag: 'Object',
            shortName: 'roller skates',
        }])

        const perspective = aggregatePerspectiveExplicit({
            universalKey: objectU,
            mergeParticipationOrder: [assetA, IMPROVISATION_ASSET_ID],
        })
        const [result] = await internalCache.ComponentAggregate.get([perspective])

        expect(result.merged).toBeInstanceOf(StandardObject)
        expect((result.merged as StandardObject).shortName?._payload?.plain?.toJSON()).toBe('roller skates')
        expect(assetDBMock.getItems).toHaveBeenCalled()
        expect(ephemeraDBMock.getItems).toHaveBeenCalled()
    })

    it('uses improvisation memo without ephemeraDB re-query on aggregate read', async () => {
        const objectU = 'OBJECT#memoSkates' as const
        const assetA = 'ASSET#wireMemo' as const
        assetDBMock.getItems.mockResolvedValue([])
        ephemeraDBMock.getItems.mockResolvedValue([])

        internalCache.ImprovisationComponentData.set(objectU, IMPROVISATION_ASSET_ID, new StandardObject({
            tag: 'Object',
            universalKey: objectU,
            shortName: 'memo roller skates',
        }))

        const perspective = aggregatePerspectiveExplicit({
            universalKey: objectU,
            mergeParticipationOrder: [assetA, IMPROVISATION_ASSET_ID],
        })
        const [result] = await internalCache.ComponentAggregate.get([perspective])

        expect((result.merged as StandardObject).shortName?._payload?.plain?.toJSON()).toBe('memo roller skates')
        expect(ephemeraDBMock.getItems).not.toHaveBeenCalled()
    })
})

describe('InternalCache ComponentExamples registration', () => {
    beforeEach(() => {
        internalCache.clear()
        jest.clearAllMocks()
        mockEmptyComponentDataReads()
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

describe('InternalCache ComponentTopology registration', () => {
    beforeEach(() => {
        internalCache.clear()
        jest.clearAllMocks()
        mockEmptyComponentDataReads()
    })

    it('exposes ComponentTopology wired to ComponentAggregate', async () => {
        const roomU = 'ROOM#wireTest5' as const
        const assetA = 'ASSET#wireA5' as const
        const topology = await internalCache.ComponentTopology.get({
            roomUniversalKey: roomU,
            mergeParticipationOrder: [assetA],
        })
        expect(topology.roomUniversalKey).toBe(roomU)
        expect(topology.exits).toEqual([])
        expect(assetDBMock.getItems).toHaveBeenCalled()
    })

    it('does not re-query Dynamo on topology cache hit until InternalCache.clear', async () => {
        const roomU = 'ROOM#wireTest6' as const
        const assetA = 'ASSET#wireA6' as const
        const input = { roomUniversalKey: roomU, mergeParticipationOrder: [assetA] } as const
        await internalCache.ComponentTopology.get(input)
        const getItemsAfterFirst = assetDBMock.getItems.mock.calls.length

        await internalCache.ComponentTopology.get(input)
        expect(assetDBMock.getItems.mock.calls.length).toEqual(getItemsAfterFirst)

        internalCache.clear()
        await internalCache.ComponentTopology.get(input)
        expect(assetDBMock.getItems.mock.calls.length).toBeGreaterThan(getItemsAfterFirst)
    })

    it('invalidate forces re-assembly', async () => {
        const roomU = 'ROOM#wireTest7' as const
        const assetA = 'ASSET#wireA7' as const
        const input = { roomUniversalKey: roomU, mergeParticipationOrder: [assetA] } as const
        const aggregateGetSpy = jest.spyOn(internalCache.ComponentAggregate, 'get')
        await internalCache.ComponentTopology.get(input)
        const callsAfterFirst = aggregateGetSpy.mock.calls.length

        internalCache.ComponentTopology.invalidate(componentTopologyPerspectiveCacheKey(input))
        await internalCache.ComponentTopology.get(input)
        expect(aggregateGetSpy.mock.calls.length).toBeGreaterThan(callsAfterFirst)

        aggregateGetSpy.mockRestore()
    })
})
