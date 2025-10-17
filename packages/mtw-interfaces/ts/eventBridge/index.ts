import { EphemeraCharacterId } from "../baseClasses";

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
        guestName?: string;
        guestId?: string;
    }
}

// Data Source Event Contracts (new functionality)
// Import directly from specific data source directories:
// - @tonylb/mtw-interfaces/ts/eventBridge/wml
// - @tonylb/mtw-interfaces/ts/eventBridge/assets  
// - @tonylb/mtw-interfaces/ts/eventBridge/ephemera
// - @tonylb/mtw-interfaces/ts/eventBridge/baseClasses
