import type { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { StandardRoom } from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardArea from '@tonylb/mtw-wml/ts/standardize/components/area'
import { projectRoomExits } from '@tonylb/mtw-wml/ts/standardize/projection/projectRoomExits'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'

import type { AuthoritativeComponentData } from '../componentData/dynamoStandardComponents'
import { createComponentAggregateCacheHandler } from '../aggregate/factory'
import { inMemoryComponentAggregateInternalCacheSlice } from '../aggregate/testHarness'

import { assembleRoomTopologyAtPerspective } from './assemble'
import {
    buildTwoLayerAreaTopologyAuthoritativeMap,
    twoLayerAreaTopologyFixture,
} from './fixtures/twoLayerAreaTopology'

describe('assembleRoomTopologyAtPerspective', () => {
    const { highway, townCenter, region, assetA } = twoLayerAreaTopologyFixture

    function makeAggregate(
        authoritativeByUniversal: ReadonlyMap<EphemeraId, AuthoritativeComponentData>
    ) {
        return createComponentAggregateCacheHandler(
            inMemoryComponentAggregateInternalCacheSlice({ authoritativeByUniversal })
        )
    }

    it('returns empty exits when referencedByUnion has no AREA# Edge referrers', async () => {
        const bareRoom = new StandardRoom(deIndentWML(`<Room key=(highway) uuid=(ROOM#highway) />`))
        const aggregate = makeAggregate(
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
        const getSpy = jest.spyOn(aggregate, 'get')
        const topology = await assembleRoomTopologyAtPerspective({
            input: { roomUniversalKey: highway, mergeParticipationOrder: [assetA] },
            aggregate,
        })
        expect(topology.exits).toEqual([])
        expect(getSpy).toHaveBeenCalledTimes(1)
        getSpy.mockRestore()
    })

    it('batch-loads Areas from referencedByUnion and projects exits (two aggregate batches)', async () => {
        const aggregate = makeAggregate(buildTwoLayerAreaTopologyAuthoritativeMap())
        const getSpy = jest.spyOn(aggregate, 'get')

        const topology = await assembleRoomTopologyAtPerspective({
            input: { roomUniversalKey: highway, mergeParticipationOrder: [assetA] },
            aggregate,
        })

        expect(getSpy).toHaveBeenCalledTimes(2)
        expect(getSpy.mock.calls[0]?.[0]).toHaveLength(1)
        expect(getSpy.mock.calls[0]?.[0][0]?.universalKey).toBe(highway)
        expect(getSpy.mock.calls[1]?.[0]).toHaveLength(1)
        expect(getSpy.mock.calls[1]?.[0][0]?.universalKey).toBe(region)

        expect(topology.roomUniversalKey).toBe(highway)
        expect(topology.exits).toEqual(
            projectRoomExits(
                highway,
                [
                    buildTwoLayerAreaTopologyAuthoritativeMap()
                        .get(region as EphemeraId)!
                        .byAssets[0]!.component as StandardArea,
                ]
            ).toJSON()
        )

        const townTopology = await assembleRoomTopologyAtPerspective({
            input: { roomUniversalKey: townCenter, mergeParticipationOrder: [assetA] },
            aggregate,
        })
        expect(townTopology.exits).toEqual(
            projectRoomExits(
                townCenter,
                [
                    buildTwoLayerAreaTopologyAuthoritativeMap()
                        .get(region as EphemeraId)!
                        .byAssets[0]!.component as StandardArea,
                ]
            ).toJSON()
        )

        getSpy.mockRestore()
    })
})
