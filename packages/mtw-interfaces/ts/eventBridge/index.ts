import { EphemeraCharacterId } from "../baseClasses";

// Legacy EventBridge types (existing functionality)
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
        guestId?: string;
    }
}

// Data Source Event Contracts (new functionality)
// These will be populated during migration phases

// WML Data Source Events (Phase 2)
export * from './wml'

// Assets Data Source Events (Phase 3)  
export * from './assets'

// Ephemera Data Source Events (Phase 4)
export * from './ephemera'

// Shared base classes and utilities
export * from './baseClasses'
