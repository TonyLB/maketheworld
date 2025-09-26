import { EphemeraAssetId } from "./baseClasses";

export type ApplyEditAPIMessage = {
    message: 'applyEdit';
    AssetId: EphemeraAssetId;
    schema: string;
}

export type MoveAssetAPIMessage = {
    message: 'moveAsset';
    AssetId: EphemeraAssetId;
    fromZone: string;
    toZone: string;
    player?: string;
    subFolder?: string;
}

export type WMLAPIMessage = { RequestId?: string; connectionId?: string } & (
    ApplyEditAPIMessage |
    MoveAssetAPIMessage
)

export const isApplyEditAPIMessage = (message: WMLAPIMessage): message is ApplyEditAPIMessage => (message.message === 'applyEdit')
export const isMoveAssetAPIMessage = (message: WMLAPIMessage): message is MoveAssetAPIMessage => (message.message === 'moveAsset')
