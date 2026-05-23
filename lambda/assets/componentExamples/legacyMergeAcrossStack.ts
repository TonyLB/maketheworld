//
// Legacy merge helpers retained only for aggregate gateway parity tests.
// Do not use in production paths -- normative merge is ComponentAggregate / canon stack.
//
import { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { StandardRoom } from '@tonylb/mtw-wml/ts/standardize/components/room'
import { excludeUndefined } from '@tonylb/mtw-utilities/ts/lists'

type ComponentDataByAsset = {
    AssetId: AssetUUID;
    component: StandardComponent;
}[];

export const mergeRoomAcrossStack = (
    byAssets: ComponentDataByAsset,
    assetStack: AssetUUID[]
): StandardRoom | undefined => {
    if (!byAssets.length || !assetStack.length) {
        return undefined
    }

    const indexByAsset = assetStack.reduce<Record<AssetUUID, number>>(
        (previous, assetId, index) => ({
            ...previous,
            [assetId]: index,
        }),
        {}
    )

    const withIndex = byAssets
        .map(({ AssetId, component }) => {
            if (!(component instanceof StandardRoom)) return undefined
            const index = indexByAsset[AssetId]
            if (typeof index !== 'number') return undefined
            return { index, room: component } as { index: number; room: StandardRoom }
        })
        .filter(excludeUndefined)
        .sort((a, b) => a.index - b.index)

    if (!withIndex.length) return undefined

    let merged: StandardRoom = withIndex[0].room as StandardRoom
    for (let i = 1; i < withIndex.length; i++) {
        merged = merged.merge(withIndex[i].room) as StandardRoom
    }
    return merged
}
