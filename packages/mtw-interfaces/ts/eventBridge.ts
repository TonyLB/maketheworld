import { EphemeraCharacterId } from "./baseClasses";

export type EventBridgeUpdatePlayerCharacter = {
    CharacterId: EphemeraCharacterId;
    Name: string;
    scopedId: string;
    fileName: string;
    fileURL?: string;
}

export type EventBridgeUpdatePlayerAsset = {
    AssetId: string;
    scopedId: string;
    Story: boolean;
    instance: boolean;
}

export type EventBridgeUpdatePlayer = {
    "detail-type": "Update Player";
    details: {
        player: string;
        Characters: EventBridgeUpdatePlayerCharacter[];
        Assets: EventBridgeUpdatePlayerAsset[];
    }
}
