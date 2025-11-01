import { EphemeraAssetId, Zone } from "./baseClasses";

export type ApplyEditAPIMessage = {
    message: 'applyEdit';
    AssetId: EphemeraAssetId;
    schema: string;
    /**
     * If true, creates the asset if it doesn't exist or has no content.
     * Requires zone to be specified when creating.
     * Default: false (returns error if asset doesn't exist)
     */
    createIfNeeded?: boolean;
    /**
     * Zone to use when creating new assets (only used if createIfNeeded is true)
     */
    zone?: Zone;
}

export type MoveAssetAPIMessage = {
    message: 'moveAsset';
    AssetId: EphemeraAssetId;
    fromZone: Zone;
    toZone: Zone;
    player?: string;
    subFolder?: string;
}

export type WMLAPIMessage = { RequestId?: string; connectionId?: string } & (
    ApplyEditAPIMessage |
    MoveAssetAPIMessage
)

export const isApplyEditAPIMessage = (message: WMLAPIMessage): message is ApplyEditAPIMessage & { RequestId?: string; connectionId?: string } => (message.message === 'applyEdit')
export const isMoveAssetAPIMessage = (message: WMLAPIMessage): message is MoveAssetAPIMessage & { RequestId?: string; connectionId?: string } => (message.message === 'moveAsset')
