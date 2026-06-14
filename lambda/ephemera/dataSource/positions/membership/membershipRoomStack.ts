/**
 * Eviction-ladder navigate maintenance: destination asset chain vs current ladder.
 *
 * Destination chain is built from the shallowest room-participating asset the
 * character can access, walking the ordered accessible asset list (canon, then
 * personal) from root inward. That chain is compared to the current ladder to
 * extend, rewrite the tail rung, or fork (truncate abandoned branch).
 */
import { splitType } from '@tonylb/mtw-utilities/ts/types'
import type { CharacterMetaItem } from '../../../internalCache/characterMeta'
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { RoomStackItem } from './types'
import { DEFAULT_ROOM_STACK, normalizeRoomStack } from './trimEvictionLadder'

export const shortAssetId = (assetId: string): string => assetId.split('#').slice(-1)[0] ?? assetId

export const buildAccessibleAssetOrder = (
    canonAssets: string[],
    characterAssets: string[] | undefined
): string[] => {
    const seen = new Set<string>()
    const order: string[] = []
    for (const asset of [...canonAssets, ...(characterAssets || [])]) {
        if (!seen.has(asset)) {
            seen.add(asset)
            order.push(asset)
        }
    }
    return order
}

/**
 * Chain from root through the given asset in accessible order (inclusive).
 */
export const buildAssetChainForAsset = (asset: string, accessibleOrder: string[]): string[] => {
    const index = accessibleOrder.indexOf(asset)
    if (index === -1) {
        return []
    }
    return accessibleOrder.slice(0, index + 1)
}

/**
 * Shallowest participating asset wins. The destination chain walks accessible
 * order up to that asset, keeping canon assets and ladder frames on the path
 * while skipping sibling overlays (e.g. Dockside) that are not ancestors of
 * the destination layer.
 */
export const resolveDestinationAssetChain = (
    roomAssetIds: string[],
    canonAssets: string[],
    characterAssets: string[] | undefined,
    currentStack?: RoomStackItem[]
): string[] => {
    const accessibleOrder = buildAccessibleAssetOrder(canonAssets, characterAssets)
    const canonSet = new Set(canonAssets)
    const ladderAssets = new Set(normalizeRoomStack(currentStack).map(({ asset }) => asset))
    const participants = roomAssetIds
        .map(shortAssetId)
        .filter((asset) => accessibleOrder.includes(asset))

    let bestAsset: string | undefined
    let bestIndex = Number.POSITIVE_INFINITY
    for (const asset of participants) {
        const index = accessibleOrder.indexOf(asset)
        if (index !== -1 && index < bestIndex) {
            bestIndex = index
            bestAsset = asset
        }
    }

    if (!bestAsset) {
        return ['primitives']
    }

    return accessibleOrder
        .slice(0, bestIndex + 1)
        .filter((asset, index) => (
            index === bestIndex
            || canonSet.has(asset)
            || ladderAssets.has(asset)
        ))
}

export type RoomStackNavigateOperation = 'extend' | 'rewriteTail' | 'fork'

export const classifyRoomStackNavigateOperation = (
    currentStack: RoomStackItem[],
    destinationChain: string[]
): RoomStackNavigateOperation => {
    const currentAssets = normalizeRoomStack(currentStack).map(({ asset }) => asset)

    if (destinationChain.length > currentAssets.length) {
        const prefixMatches = destinationChain
            .slice(0, currentAssets.length)
            .every((asset, index) => asset === currentAssets[index])
        if (prefixMatches) {
            return 'extend'
        }
    }

    if (
        destinationChain.length === currentAssets.length
        && destinationChain.every((asset, index) => asset === currentAssets[index])
    ) {
        return 'rewriteTail'
    }

    return 'fork'
}

/**
 * Apply extend / rewrite-tail / fork by rebuilding frames from the destination
 * chain: inner frames preserve rooms where the asset prefix still matches;
 * the outer frame always receives the destination room short id.
 */
export const applyLadderUpdateFromDestinationChain = (
    currentStack: RoomStackItem[] | undefined,
    destinationChain: string[],
    targetRoomShortId: string
): RoomStackItem[] => {
    const normalizedStack = normalizeRoomStack(currentStack)
    if (destinationChain.length === 0) {
        return DEFAULT_ROOM_STACK
    }

    return destinationChain.map((asset, index) => {
        if (index < destinationChain.length - 1) {
            const existing = normalizedStack[index]
            return {
                asset,
                RoomId: existing?.asset === asset ? existing.RoomId : normalizedStack[0]?.RoomId ?? 'VORTEX',
            }
        }
        return { asset, RoomId: targetRoomShortId }
    })
}

export const computeRoomStackUpdate = (
    args: {
        targetRoomId: EphemeraRoomId;
        characterMeta: CharacterMetaItem;
        roomAssets: string[];
        canonAssets: string[];
    }
): { destinationChain: string[] } => {
    const destinationChain = resolveDestinationAssetChain(
        args.roomAssets,
        args.canonAssets,
        args.characterMeta.assets,
        args.characterMeta.RoomStack
    )
    return { destinationChain }
}

export const applyRoomStackToCharacterDraft = (
    draft: Record<string, unknown>,
    args: {
        targetRoomId: EphemeraRoomId;
        destinationChain: string[];
        priorRoomStack?: RoomStackItem[];
    }
): void => {
    const targetRoomShortId = splitType(args.targetRoomId)[1]
    draft.RoomId = targetRoomShortId
    draft.RoomStack = applyLadderUpdateFromDestinationChain(
        args.priorRoomStack ?? (draft.RoomStack as RoomStackItem[] | undefined),
        args.destinationChain,
        targetRoomShortId
    )
}
