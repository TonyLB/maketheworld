import { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { internalCache, InternalCache } from '../../internalCache'
import { mergeRoomAcrossStack, mergeLensAcrossStack } from './mergeComponentsAcrossStack'
import { getLensMarksWithDefaults } from '@tonylb/mtw-wml/ts/standardize/worldState/lensMarks'
import type { EphemeraCacheMarkState, EphemeraCacheMarkValue } from '../../renderCache/baseClasses'

export type PerspectiveSpec = {
    assetStack: AssetUUID[];
}

export type ComputeDefaultMarksForRoomArgs = {
    roomId: EphemeraRoomId;
    perspective: PerspectiveSpec;
    internalCacheOverride?: InternalCache;
}

/**
 * computeDefaultMarksForRoom
 *
 * NOTE: This helper intentionally couples Ephemera state logic to the Assets/WML
 * dataSource in a read-only way. It reaches into the standardized Room and Lens
 * components (via the internal cache and componentExamples helpers) to derive
 * the default Lens-controlled Mark/Match pairs for a Room in a given perspective.
 *
 * This coupling is acceptable for v1 of the world-state system but is expected
 * to be revisited in a future iteration, likely replaced by an explicit
 * Assets-to-Ephemera pipeline for world-state defaults.
 *
 * See: lambda/ephemera/dataSource/state/AGENT.v1.planning.md (section on default state).
 */
export const computeDefaultMarksForRoom = async ({
    roomId,
    perspective,
    internalCacheOverride
}: ComputeDefaultMarksForRoomArgs): Promise<EphemeraCacheMarkState> => {
    const cache = internalCacheOverride || internalCache
    const { assetStack } = perspective

    if (!assetStack.length) {
        return { markValue: [] }
    }

    //
    // Fetch Room and Lens components across the asset stack and merge them
    // according to stack order, reusing the same semantics as the Assets-side
    // example enrichment helpers.
    //
    const componentMetaByAsset = await cache.ComponentMeta.getAcrossAssets(
        roomId as unknown as ComponentUUID,
        assetStack
    )

    const byAssets = Object.entries(componentMetaByAsset).map(([AssetId, component]) => ({
        AssetId: AssetId as AssetUUID,
        component
    }))

    const mergedRoom = mergeRoomAcrossStack(byAssets, assetStack)
    if (!mergedRoom) {
        //
        // If the Room cannot be resolved in this perspective, return an empty
        // markState rather than throwing; callers can decide how to handle it.
        //
        return { markValue: [] }
    }

    //
    // For v1, assume there is at most one Lens per Room in the merged view
    // and that it controls all relevant Marks for the default state. If no
    // Lens is present, there are no Lens-controlled defaults.
    //
    const lensByAssets = byAssets.filter(({ component }) => (component.tag === 'Lens'))
    const mergedLens = mergeLensAcrossStack(lensByAssets, assetStack)

    if (!mergedLens) {
        return { markValue: [] }
    }

    const lensMarksWithDefaults = getLensMarksWithDefaults(mergedLens)

    const markValue: EphemeraCacheMarkValue[] = lensMarksWithDefaults
        .filter(({ markId }) => Boolean(markId))
        .map(({ markId, default: value }) => ({
            mark: markId,
            value: value ?? ''
        }))

    return {
        markValue
    }
}

export default computeDefaultMarksForRoom

