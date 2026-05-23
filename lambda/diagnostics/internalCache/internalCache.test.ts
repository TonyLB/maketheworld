jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')

import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

import { aggregatePerspectiveExplicit } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'

const assetDBMock = jest.mocked(assetDB)

import internalCache from './index'

describe('diagnostics internalCache', () => {
    beforeEach(() => {
        internalCache.clear()
        jest.clearAllMocks()
        assetDBMock.getItems.mockResolvedValue([] as any)
        assetDBMock.query.mockResolvedValue([] as any)
    })

    it('clear invokes tier-1 and gateway handler clears', () => {
        const dataClear = jest.spyOn(internalCache.ComponentData, 'clear')
        const verticalsClear = jest.spyOn(internalCache.ComponentVerticals, 'clear')
        const aggregateClear = jest.spyOn(internalCache.ComponentAggregate, 'clear')
        const examplesClear = jest.spyOn(internalCache.ComponentExamples, 'clear')

        internalCache.clear()

        expect(dataClear).toHaveBeenCalledTimes(1)
        expect(verticalsClear).toHaveBeenCalledTimes(1)
        expect(aggregateClear).toHaveBeenCalledTimes(1)
        expect(examplesClear).toHaveBeenCalledTimes(1)
    })

    it('ComponentData.get delegates to assetDB getItems for pair reads', async () => {
        assetDBMock.getItems.mockResolvedValue([])
        const componentId = 'ROOM#12345' as const
        const assetId = 'ASSET#Test' as const
        const result = await internalCache.ComponentData.get(componentId, assetId)
        expect(result.component.universalKey).toBe(componentId)
        expect(result.assetId).toBe(assetId)
        expect(assetDBMock.getItems).toHaveBeenCalledWith({
            Keys: [{ AssetId: componentId, DataCategory: assetId }],
            getAllFields: true,
        })
    })

    it('ComponentVerticals.get delegates to assetDB query', async () => {
        assetDBMock.query.mockResolvedValue([] as any)
        const universalKey = 'ROOM#Vortex' as const
        const [entry] = await internalCache.ComponentVerticals.get([universalKey])
        expect(entry).toEqual({ universalKey, hops: [] })
        expect(assetDBMock.query).toHaveBeenCalled()
    })

    it('exposes ComponentAggregate wired to sibling loaders', async () => {
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

    it('exposes ComponentExamples wired to ComponentAggregate', async () => {
        const roomU = 'ROOM#wireTest2' as const
        const assetA = 'ASSET#wireA2' as const
        const set = await internalCache.ComponentExamples.get({
            hostUniversalKey: roomU,
            mergeParticipationOrder: [assetA],
        })
        expect(set.size).toBe(0)
        expect(assetDBMock.getItems).toHaveBeenCalled()
    })

    it('does not re-query Dynamo on ComponentExamples cache hit until clear', async () => {
        const roomU = 'ROOM#wireTest3' as const
        const assetA = 'ASSET#wireA3' as const
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
