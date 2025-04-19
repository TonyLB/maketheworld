import { EphemeraAssetId } from "./baseClasses";

export type ApplyEditAPIMessage = {
    message: 'applyEdit';
    AssetId: EphemeraAssetId;
    schema: string;
}

export type WMLAPIMessage = { RequestId?: string; connectionId?: string } & (
    ApplyEditAPIMessage
)

export const isApplyEditAPIMessage = (message: WMLAPIMessage): message is ApplyEditAPIMessage => (message.message === 'applyEdit')
