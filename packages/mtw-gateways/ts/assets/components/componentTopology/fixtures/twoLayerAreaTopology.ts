import type { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import type { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import StandardArea from '@tonylb/mtw-wml/ts/standardize/components/area'
import { StandardRoom } from '@tonylb/mtw-wml/ts/standardize/components/room'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'

import type { AuthoritativeComponentData } from '../../componentData/dynamoStandardComponents'
import type { PersistedReferencedByEntry } from '../../componentData/referencedBy'

export const twoLayerAreaTopologyFixture = {
    highway: 'ROOM#highway' as const,
    townCenter: 'ROOM#townCenter' as const,
    region: 'AREA#region' as const,
    assetA: 'ASSET#a1' as const,
    assetB: 'ASSET#b2' as const,
}

const { highway, townCenter, region, assetA, assetB } = twoLayerAreaTopologyFixture

const regionArea = new StandardArea(
    deIndentWML(`
    <Area uuid=(region) key=(region)>
        <Room key=(highway) uuid=(ROOM#highway) />
        <Room key=(townCenter) uuid=(ROOM#townCenter) />
        <Exit uuid=(highwayToTown)>
            <From>ROOM#highway</From>
            <To>ROOM#townCenter</To>
            <Forward>east</Forward>
            <Back>west</Back>
        </Exit>
    </Area>
`)
)

const bareHighwayRoom = new StandardRoom(
    deIndentWML(`<Room key=(highway) uuid=(ROOM#highway) />`)
)

const edgeReferrer: PersistedReferencedByEntry = {
    referrerUniversalKey: region as ComponentUUID,
    referenceType: 'Edge',
}

/** In-memory authoritative map for one Area edge + room referencedBy (gateway tests). */
export function buildTwoLayerAreaTopologyAuthoritativeMap(): Map<EphemeraId, AuthoritativeComponentData> {
    return new Map([
        [
            highway,
            {
                ComponentId: highway,
                byAssets: [
                    {
                        AssetId: assetA,
                        component: bareHighwayRoom as unknown as StandardComponent,
                        referencedBy: [edgeReferrer],
                    },
                ],
            },
        ],
        [
            region as EphemeraId,
            {
                ComponentId: region as EphemeraId,
                byAssets: [{ AssetId: assetA, component: regionArea as unknown as StandardComponent }],
            },
        ],
        [
            townCenter,
            {
                ComponentId: townCenter,
                byAssets: [
                    {
                        AssetId: assetA,
                        component: new StandardRoom(
                            deIndentWML(`<Room key=(townCenter) uuid=(ROOM#townCenter) />`)
                        ) as unknown as StandardComponent,
                        referencedBy: [edgeReferrer],
                    },
                ],
            },
        ],
    ])
}

export const twoLayerAreaTopologyMergeOrder = [assetA, assetB] as const
