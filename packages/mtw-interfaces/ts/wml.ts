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

export type PurgeAssetAPIMessage = {
    message: 'purgeAsset';
    AssetId: EphemeraAssetId;
    expectedZone: 'Draft' | 'Archive';
    requireExists?: boolean;
}

export type BackupWMLAPIMessage = {
    message: 'backupWML';
    assetId: EphemeraAssetId;
    to: string;
}

/** Operator/bootstrap path: promote asset to Canon via internal coordination (not a product client API). */
export type PromoteToCanonAPIMessage = {
    message: 'promoteToCanon';
    AssetId: EphemeraAssetId;
}

export type WMLAPIMessage = { RequestId?: string; connectionId?: string } & (
    ApplyEditAPIMessage |
    MoveAssetAPIMessage |
    PurgeAssetAPIMessage |
    BackupWMLAPIMessage |
    PromoteToCanonAPIMessage
)

export const isApplyEditAPIMessage = (message: WMLAPIMessage): message is ApplyEditAPIMessage & { RequestId?: string; connectionId?: string } => (message.message === 'applyEdit')
export const isMoveAssetAPIMessage = (message: WMLAPIMessage): message is MoveAssetAPIMessage & { RequestId?: string; connectionId?: string } => (message.message === 'moveAsset')
export const isPurgeAssetAPIMessage = (message: WMLAPIMessage): message is PurgeAssetAPIMessage & { RequestId?: string; connectionId?: string } => (message.message === 'purgeAsset')
export const isBackupWMLAPIMessage = (message: WMLAPIMessage): message is BackupWMLAPIMessage & { RequestId?: string; connectionId?: string } => (message.message === 'backupWML')
export const isPromoteToCanonAPIMessage = (message: WMLAPIMessage): message is PromoteToCanonAPIMessage & { RequestId?: string; connectionId?: string } => (message.message === 'promoteToCanon')
