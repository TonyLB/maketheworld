import { splitType } from '@tonylb/mtw-utilities/ts/types'
import type { CharacterMetaItem } from '../../../internalCache/characterMeta'
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { RoomStackItem } from './types'

export const computeRoomStackUpdate = (
    args: {
        targetRoomId: EphemeraRoomId;
        characterMeta: CharacterMetaItem;
        roomAssets: string[];
        canonAssets: string[];
    }
): { targetAsset?: string; targetAssetListIndex?: number } => {
    const { characterMeta, roomAssets, canonAssets } = args
    const orderIndexByAsset = Object.assign(
        {},
        ...([...canonAssets, ...(characterMeta.assets || [])].map((asset, index) => ({ [asset]: index })))
    ) as Record<string, number>
    return roomAssets.reduce<{ targetAsset?: string; targetAssetListIndex?: number }>((previous, asset) => {
        const assetIndex = orderIndexByAsset[asset.split('#')[1]]
        if (typeof assetIndex !== 'undefined') {
            if (typeof previous.targetAssetListIndex === 'undefined' || previous.targetAssetListIndex > assetIndex) {
                return {
                    targetAsset: asset.split('#')[1],
                    targetAssetListIndex: assetIndex,
                }
            }
        }
        return previous
    }, {})
}

export const applyRoomStackToCharacterDraft = (
    draft: Record<string, unknown>,
    args: {
        targetRoomId: EphemeraRoomId;
        targetAsset?: string;
        targetAssetListIndex?: number;
        orderIndexByAsset: Record<string, number>;
    }
): void => {
    draft.RoomId = splitType(args.targetRoomId)[1]
    if (typeof args.targetAssetListIndex === 'undefined') {
        return
    }
    const roomStack = (draft.RoomStack || [{ asset: 'primitives', RoomId: 'VORTEX' }]) as RoomStackItem[]
    const indexOfFirstReplacement = roomStack.findIndex(
        ({ asset: stackAsset }) => (
            !(stackAsset in args.orderIndexByAsset && args.orderIndexByAsset[stackAsset] < args.targetAssetListIndex!)
        )
    )
    draft.RoomStack = [
        ...(indexOfFirstReplacement === -1 ? roomStack : roomStack.slice(0, indexOfFirstReplacement)),
        {
            asset: args.targetAsset,
            RoomId: draft.RoomId,
        },
    ]
}
