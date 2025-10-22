import { EphemeraAssetId, Zone } from "./baseClasses";

export type ApplyEditAPIMessage = {
    message: 'applyEdit';
    AssetId: EphemeraAssetId;
    schema: string;
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
