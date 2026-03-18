import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { StandardRoom } from '@tonylb/mtw-wml/ts/standardize/components/room'
import { StandardLens } from '@tonylb/mtw-wml/ts/standardize/components/worldState'
import { excludeUndefined } from '@tonylb/mtw-utilities/ts/lists'

//
// NOTE: This file intentionally duplicates the asset-stack merge pattern from
// lambda/assets/componentExamples/exampleEnrichment.ts, but is kept local to
// Ephemera to avoid a hard runtime dependency on the Assets lambda. If you
// change merge semantics there (ordering, precedence, etc.), update these
// helpers to match.
//

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

export const mergeLensAcrossStack = (
    byAssets: ComponentDataByAsset,
    assetStack: AssetUUID[]
): StandardLens | undefined => {
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
            if (!(component instanceof StandardLens)) return undefined
            const index = indexByAsset[AssetId]
            if (typeof index !== 'number') return undefined
            return { index, lens: component } as { index: number; lens: StandardLens }
        })
        .filter(excludeUndefined)
        .sort((a, b) => a.index - b.index)

    if (!withIndex.length) return undefined

    let merged: StandardLens = withIndex[0].lens as StandardLens
    for (let i = 1; i < withIndex.length; i++) {
        merged = merged.merge(withIndex[i].lens) as StandardLens
    }
    return merged
}

