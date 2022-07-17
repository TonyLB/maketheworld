export type LibraryAsset = {
    AssetId: string;
    scopedId?: string;
    Story?: boolean;
    instance?: boolean;
}

export type LibraryCharacter = {
    CharacterId: string;
    Name: string;
    scopedId: string;
    fileName: string;
    fileURL?: string;
    FirstImpression?: string;
    Pronouns?: {
        subject: string;
        object: string;
        reflexive: string;
        possessive: string;
        adjective: string;
    };
    OneCoolThing?: string;
    Outfit?: string;
}
