import type { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { StandardRoom } from '@tonylb/mtw-wml/ts/standardize/components/room'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'

import type { AuthoritativeComponentData } from '../componentData/dynamoStandardComponents'
import { createComponentAggregateCacheHandler } from '../aggregate/factory'
import { inMemoryComponentAggregateInternalCacheSlice } from '../aggregate/testHarness'

import { createComponentExamplesCacheHandler } from './factory'
import { componentExamplesPerspectiveCacheKey } from './keys'

describe('ComponentExamplesMergedCache', () => {
    const roomU = 'ROOM#r1' as const
    const assetA = 'ASSET#a1' as const

    const bareRoom = new StandardRoom(deIndentWML(`<Room key=(one) uuid=(ROOM#r1) />`))

    function makeHandler(
        authoritativeByUniversal: ReadonlyMap<EphemeraId, AuthoritativeComponentData>
    ) {
        const ComponentAggregate = createComponentAggregateCacheHandler(
            inMemoryComponentAggregateInternalCacheSlice({ authoritativeByUniversal })
        )
        const handler = createComponentExamplesCacheHandler({ ComponentAggregate })
        return { handler, ComponentAggregate }
    }

    it('returns empty set when host has no situation facets', async () => {
        const { handler } = makeHandler(
            new Map([
                [
                    roomU,
                    {
                        ComponentId: roomU,
                        byAssets: [{ AssetId: assetA, component: bareRoom as unknown as StandardComponent }],
                    },
                ],
            ])
        )
        const set = await handler.get({ hostUniversalKey: roomU, mergeParticipationOrder: [assetA] })
        expect(set.size).toBe(0)
    })

    it('does not re-run assembly on cache hit until clear', async () => {
        const { handler, ComponentAggregate } = makeHandler(
            new Map([
                [
                    roomU,
                    {
                        ComponentId: roomU,
                        byAssets: [{ AssetId: assetA, component: bareRoom as unknown as StandardComponent }],
                    },
                ],
            ])
        )
        const input = { hostUniversalKey: roomU, mergeParticipationOrder: [assetA] } as const
        const aggregateGetSpy = jest.spyOn(ComponentAggregate, 'get')

        await handler.get(input)
        const callsAfterFirst = aggregateGetSpy.mock.calls.length

        await handler.get(input)
        expect(aggregateGetSpy.mock.calls.length).toEqual(callsAfterFirst)

        handler.clear()
        await handler.get(input)
        expect(aggregateGetSpy.mock.calls.length).toBeGreaterThan(callsAfterFirst)

        aggregateGetSpy.mockRestore()
    })

    it('invalidate drops cached entry for the perspective key', async () => {
        const { handler, ComponentAggregate } = makeHandler(
            new Map([
                [
                    roomU,
                    {
                        ComponentId: roomU,
                        byAssets: [{ AssetId: assetA, component: bareRoom as unknown as StandardComponent }],
                    },
                ],
            ])
        )
        const input = { hostUniversalKey: roomU, mergeParticipationOrder: [assetA] } as const
        const cacheKey = componentExamplesPerspectiveCacheKey(input)
        const aggregateGetSpy = jest.spyOn(ComponentAggregate, 'get')

        await handler.get(input)
        const callsAfterFirst = aggregateGetSpy.mock.calls.length

        handler.invalidate(cacheKey)
        await handler.get(input)
        expect(aggregateGetSpy.mock.calls.length).toBeGreaterThan(callsAfterFirst)

        aggregateGetSpy.mockRestore()
    })
})
