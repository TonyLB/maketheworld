import { EphemeraCharacterId } from "./baseClasses";

type AssetWorkspaceConstructorBase = {
    fileName: string;
    subFolder?: string;
}

type AssetWorkspaceConstructorCanon = {
    zone: 'Canon';
} & AssetWorkspaceConstructorBase

type AssetWorkspaceConstructorLibrary = {
    zone: 'Library';
} & AssetWorkspaceConstructorBase

type AssetWorkspaceConstructorPersonal = {
    zone: 'Personal';
    player: string;
} & AssetWorkspaceConstructorBase

type AssetWorkspaceAddress = AssetWorkspaceConstructorCanon | AssetWorkspaceConstructorLibrary | AssetWorkspaceConstructorPersonal

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
    }
}

export type EventBridgeCacheAsset = {
    "detail-type": "Cache Asset";
    details: {
        updateOnly?: boolean;
    } & AssetWorkspaceAddress
}