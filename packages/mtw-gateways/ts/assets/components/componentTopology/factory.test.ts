import type { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { StandardRoom } from '@tonylb/mtw-wml/ts/standardize/components/room'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'

import type { AuthoritativeComponentData } from '../componentData/dynamoStandardComponents'
import { createComponentAggregateCacheHandler } from '../aggregate/factory'
import { inMemoryComponentAggregateInternalCacheSlice } from '../aggregate/testHarness'

import { assembleRoomTopologyAtPerspective } from './assemble'
import { createComponentTopologyCacheHandler } from './factory'
import {
    buildTwoLayerAreaTopologyAuthoritativeMap,
    twoLayerAreaTopologyFixture,
} from './fixtures/twoLayerAreaTopology'
import { componentTopologyPerspectiveCacheKey } from './keys'

describe('ComponentTopologyMergedCache', () => {
    const { highway, assetA } = twoLayerAreaTopologyFixture

    const bareRoom = new StandardRoom(deIndentWML(`<Room key=(highway) uuid=(ROOM#highway) />`))

    function makeHandler(
        authoritativeByUniversal: ReadonlyMap<EphemeraId, AuthoritativeComponentData>
    ) {
        const ComponentAggregate = createComponentAggregateCacheHandler(
            inMemoryComponentAggregateInternalCacheSlice({ authoritativeByUniversal })
        )
        const handler = createComponentTopologyCacheHandler({ ComponentAggregate })
        return { handler, ComponentAggregate }
    }

    it('returns empty exits when room has no AREA# Edge referrers', async () => {
        const { handler } = makeHandler(
            new Map([
                [
                    highway,
                    {
                        ComponentId: highway,
                        byAssets: [{ AssetId: assetA, component: bareRoom as unknown as StandardComponent }],
                    },
                ],
            ])
        )
        const topology = await handler.get({ roomUniversalKey: highway, mergeParticipationOrder: [assetA] })
        expect(topology.exits).toEqual([])
    })

    it('does not re-run assembly on cache hit until clear', async () => {
        const { handler, ComponentAggregate } = makeHandler(buildTwoLayerAreaTopologyAuthoritativeMap())
        const input = { roomUniversalKey: highway, mergeParticipationOrder: [assetA] } as const
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
        const { handler, ComponentAggregate } = makeHandler(buildTwoLayerAreaTopologyAuthoritativeMap())
        const input = { roomUniversalKey: highway, mergeParticipationOrder: [assetA] } as const
        const cacheKey = componentTopologyPerspectiveCacheKey(input)
        const aggregateGetSpy = jest.spyOn(ComponentAggregate, 'get')

        await handler.get(input)
        const callsAfterFirst = aggregateGetSpy.mock.calls.length

        handler.invalidate(cacheKey)
        await handler.get(input)
        expect(aggregateGetSpy.mock.calls.length).toBeGreaterThan(callsAfterFirst)

        aggregateGetSpy.mockRestore()
    })

    it('matches assembleRoomTopologyAtPerspective on shared fixture', async () => {
        const authoritative = buildTwoLayerAreaTopologyAuthoritativeMap()
        const { handler, ComponentAggregate } = makeHandler(authoritative)
        const input = { roomUniversalKey: highway, mergeParticipationOrder: [assetA] } as const

        const [cached, assembled] = await Promise.all([
            handler.get(input),
            assembleRoomTopologyAtPerspective({ input, aggregate: ComponentAggregate }),
        ])

        expect(cached).toEqual(assembled)
    })
})
