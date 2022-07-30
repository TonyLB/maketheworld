type SchemaNestingBase<T extends SchemaTag> = {
    contents: T[];
}

type LegalSchemaContents = SchemaActionTag | SchemaComputedTag | SchemaConditionTag | SchemaExitTag | SchemaFeatureTag | SchemaImageTag | SchemaImportTag | SchemaMapTag | SchemaRoomTag | SchemaVariableTag
type SchemaAssetBase = {
    key: string;
} & SchemaNestingBase<LegalSchemaContents>

export type SchemaAssetTag = {
    tag: 'Asset';
} & SchemaAssetBase

export type SchemaStoryTag = {
    tag: 'Story';
    instance: boolean;
} & SchemaAssetBase

export type SchemaImageTag = {
    tag: 'Image';
    key: string;
    fileURL?: string;
}

type SchemaPronouns = {
    subject: string;
    object: string;
    possessive: string;
    adjective: string;
    reflexive: string;
}

export type SchemaCharacterTag = {
    tag: 'Character';
    player?: string;
    name: string;
    pronouns: SchemaPronouns;
    firstImpression?: string;
    oneCoolThing?: string;
    outfit?: string;
    image?: SchemaImageTag;
}

export type SchemaVariableTag = {
    tag: 'Variable';
    key: string;
    default?: string;
}

export type SchemaComputedTag = {
    tag: 'Computed';
    key: string;
    src: string;
    dependencies: string[];
}

export type SchemaActionTag = {
    tag: 'Action';
    src: string;
}

export type SchemaUseTag = {
    tag: 'Use';
    key: string;
    as?: string;
    type?: string;
}

type SchemaImportMapping = {
    key: string;
    type: 'Room' | 'Feature' | 'Variable' | 'Computed' | 'Action' | 'Map'
}

export type SchemaImportTag = {
    tag: 'Import';
    from: string;
    mapping: Record<string, SchemaImportMapping>;
}

export type SchemaConditionTag = {
    tag: 'Condition';
    if: string;
    dependencies: string[];
} & SchemaNestingBase<LegalSchemaContents>

export type SchemaExitTag = {
    tag: 'Exit';
    key: string;
    name: string;
    to: string;
    from: string;
}

export type SchemaLinkTag = {
    tag: 'Link';
    to: string;
} & SchemaNestingBase<SchemaStringTag>

export type SchemaDescriptionTag = {
    tag: 'Description';
    display: 'before' | 'after' | 'replace';
    spaceBefore: boolean;
    spaceAfter: boolean;
} & SchemaNestingBase<SchemaStringTag | SchemaLinkTag | SchemaLineBreakTag>

export type SchemaLineBreakTag = {
    tag: 'br';
}

export type SchemaNameTag = {
    tag: 'Name';
    name: string;
}

export type SchemaRoomTag = {
    tag: 'Room';
    key: string;
    global: boolean;
    display?: string;
    x?: number;
    y?: number;
} & SchemaNestingBase<SchemaDescriptionTag | SchemaExitTag | SchemaFeatureTag | SchemaNameTag>

export type SchemaFeatureTag = {
    tag: 'Feature';
    key: string;
    global: boolean;
}& SchemaNestingBase<SchemaDescriptionTag | SchemaNameTag>

export type SchemaMapTag = {
    tag: 'Map';
    key: string;
} & SchemaNestingBase<SchemaExitTag | SchemaImageTag | SchemaRoomTag>

export type SchemaStringTag = {
    tag: 'String';
    value: string;
}

export type SchemaTag = SchemaAssetTag |
    SchemaStoryTag |
    SchemaCharacterTag |
    SchemaImageTag |
    SchemaVariableTag |
    SchemaComputedTag |
    SchemaActionTag |
    SchemaUseTag |
    SchemaImportTag |
    SchemaConditionTag |
    SchemaExitTag |
    SchemaDescriptionTag |
    SchemaLineBreakTag |
    SchemaLinkTag |
    SchemaNameTag |
    SchemaRoomTag |
    SchemaFeatureTag |
    SchemaMapTag |
    SchemaStringTag

export class SchemaException extends Error {
    startToken: number
    endToken: number
    constructor(message: string) {
        super(message)
        this.name = 'WMLSchemaException'
    }
}
