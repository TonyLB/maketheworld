import type { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { StandardRoom } from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardSituation from '@tonylb/mtw-wml/ts/standardize/components/situation'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'

import type { AuthoritativeComponentData } from '../../componentData/dynamoStandardComponents'

export const twoLayerRoomFixture = {
    roomU: 'ROOM#r1' as const,
    assetA: 'ASSET#a1' as const,
    assetB: 'ASSET#b2' as const,
    situationBase: 'SITUATION#base' as const,
    situationOverride: 'SITUATION#override' as const,
}

const { roomU, assetA, assetB, situationBase, situationOverride } = twoLayerRoomFixture

const baseRoom = new StandardRoom(
    deIndentWML(`
    <Room key=(one) uuid=(ROOM#r1)>
        <Situation key=(base) uuid=(SITUATION#base) />
    </Room>
`)
)

const overrideRoom = new StandardRoom(
    deIndentWML(`
    <Room key=(one) uuid=(ROOM#r1)>
        <Situation key=(override) uuid=(SITUATION#override) />
    </Room>
`)
)

const baseSituation = new StandardSituation(
    deIndentWML(`<Situation key=(base) uuid=(SITUATION#base) />`)
)

const overrideSituation = new StandardSituation(
    deIndentWML(`<Situation key=(override) uuid=(SITUATION#override) />`)
)

/** In-memory authoritative map for two-layer room + two situation facets (gateway tests). */
export function buildTwoLayerRoomAuthoritativeMap(): Map<EphemeraId, AuthoritativeComponentData> {
    const byAssets = [
        { AssetId: assetA, component: baseRoom as unknown as StandardComponent },
        { AssetId: assetB, component: overrideRoom as unknown as StandardComponent },
    ]
    return new Map([
        [roomU, { ComponentId: roomU, byAssets }],
        [
            situationBase,
            {
                ComponentId: situationBase,
                byAssets: [{ AssetId: assetA, component: baseSituation as unknown as StandardComponent }],
            },
        ],
        [
            situationOverride,
            {
                ComponentId: situationOverride,
                byAssets: [{ AssetId: assetB, component: overrideSituation as unknown as StandardComponent }],
            },
        ],
    ])
}

export const twoLayerRoomMergeOrder = [assetA, assetB] as const
