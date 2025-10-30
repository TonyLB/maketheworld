import { EphemeraCharacterId } from "./baseClasses";

export type LibraryAsset = {
    AssetId: string;
    Story?: boolean;
    instance?: boolean;
    // Optional during transition; will be required once all callers provide zone
    zone?: 'Canon' | 'Library' | 'Personal' | 'Draft' | 'Archive';
    ShortName?: string;
    Summary?: string[];
    // scopedId is reserved for Character flows and should not be present on generic assets. TODO: Full removal after legacy code migration.
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
