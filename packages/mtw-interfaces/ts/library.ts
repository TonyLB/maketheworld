import { EphemeraCharacterId } from "./baseClasses";

export type LibraryAsset = {
    AssetId: string;
    scopedId?: string;
    Story?: boolean;
    instance?: boolean;
}

export type LibraryCharacter = {
    CharacterId: EphemeraCharacterId;
    Name: string;
    scopedId: string;
    fileName: string;
    fileURL?: string;
    Pronouns?: {
        subject: string;
        object: string;
        reflexive: string;
        possessive: string;
        adjective: string;
    };
}
