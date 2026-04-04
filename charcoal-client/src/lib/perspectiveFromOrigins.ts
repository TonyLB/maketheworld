/**
 * Derive room-scoped Perspective from origin chains (Room + Situations + Marks)
 * for use as assetStack (e.g. personalAssets getPerspective and other consumers).
 */

import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardSituation from '@tonylb/mtw-wml/ts/standardize/components/situation'
import StandardMark from '@tonylb/mtw-wml/ts/standardize/components/worldState'
import { mergeOriginChainsToOrderedAssets } from '@tonylb/mtw-wml/ts/standardize/mergeOriginChains'
import type { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import type { Perspective } from '@tonylb/mtw-interfaces/ts/perspective'

/**
 * Derive a Perspective for the given room in the context of the current asset.
 * Collects origin chains from the Room, its Situation facets, and their Mark facets;
 * merges them into a single base-first asset stack and appends currentAssetId.
 *
 * @returns Perspective with assetStack, or null if room not found or no origins.
 */
export function derivePerspectiveForRoom(
    standardForm: StandardForm,
    roomId: ComponentUUID,
    currentAssetId: AssetUUID
): Perspective | null {
    const room = standardForm.byUniversalId[roomId]
    if (!room || !(room instanceof StandardRoom)) return null

    const initialChains: AssetUUID[][] =
        room.origin && room.origin.length > 0 ? [room.origin] : []

    const { situations, originChains } = room.situations.items.reduce<{
        situations: StandardSituation[]
        originChains: AssetUUID[][]
    }>(
        (acc, facet) => {
            const id = facet.reference?.universalKey as ComponentUUID | undefined
            if (!id) return acc
            const comp = standardForm.byUniversalId[id]
            if (!(comp instanceof StandardSituation)) return acc
            const situations = [...acc.situations, comp]
            const originChains =
                comp.origin && comp.origin.length > 0
                    ? [...acc.originChains, comp.origin]
                    : acc.originChains
            return { situations, originChains }
        },
        { situations: [], originChains: initialChains }
    )

    const originChainsWithMarks = situations.reduce<AssetUUID[][]>(
        (chains, situation) => {
            const markItems = situation.marks?.items ?? []
            return markItems.reduce<AssetUUID[][]>((chs, facet) => {
                const id = facet.reference?.universalKey as ComponentUUID | undefined
                if (!id) return chs
                const comp = standardForm.byUniversalId[id]
                if (!(comp instanceof StandardMark) || !comp.origin?.length) return chs
                return [...chs, comp.origin]
            }, chains)
        },
        originChains
    )

    const filtered = originChainsWithMarks.filter((chain) => chain.length > 0)
    if (filtered.length === 0) return null

    const ordered = mergeOriginChainsToOrderedAssets(filtered)
    const stack = ordered.includes(currentAssetId)
        ? ordered
        : [...ordered, currentAssetId]

    return { assetStack: stack }
}
