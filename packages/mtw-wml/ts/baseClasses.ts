import { ParseTag } from "./parser/baseClasses";

type SchemaNestingBase<T extends SchemaTag> = {
    contents: T[];
}

export type LegalAssetContents = SchemaActionTag | SchemaComputedTag | SchemaConditionTag | SchemaExitTag | SchemaFeatureTag | SchemaImageTag | SchemaImportTag | SchemaMapTag | SchemaRoomTag | SchemaVariableTag
export type LegalConditionContents = SchemaActionTag | SchemaComputedTag | SchemaConditionTag | SchemaExitTag | SchemaFeatureTag | SchemaImageTag | SchemaImportTag | SchemaMapTag | SchemaRoomTag | SchemaVariableTag

type SchemaAssetBase = {
    key: string;
    fileName?: string;
    zone?: string;
    subFolder?: string;
    player?: string;
    contents: LegalAssetContents[];
}

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

//
// TODO:  Figure out how to define limits on schemaConditionTag contents
// without causing circular reference
//
export type SchemaConditionTag = {
    tag: 'Condition';
    if: string;
    dependencies: string[];
    contents: LegalAssetContents[];
}

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
    contents: SchemaStringTag[];
}

export type LegalDescriptionContents = SchemaStringTag | SchemaLinkTag | SchemaLineBreakTag

export type SchemaDescriptionTag = {
    tag: 'Description';
    display: 'before' | 'after' | 'replace';
    spaceBefore: boolean;
    spaceAfter: boolean;
    contents: LegalDescriptionContents[];
}

export type SchemaLineBreakTag = {
    tag: 'br';
}

export type SchemaNameTag = {
    tag: 'Name';
    name: string;
}

//
// TODO: Refactor room schema formation to keep name and description tags not folded into name
// and render properties
//
export type LegalRoomContents = SchemaDescriptionTag | SchemaExitTag | SchemaFeatureTag | SchemaNameTag
export type SchemaRoomTag = {
    tag: 'Room';
    key: string;
    name: string;
    global: boolean;
    display?: string;
    x?: number;
    y?: number;
    contents: LegalRoomContents[];
}

export type LegalFeatureContents = SchemaDescriptionTag | SchemaNameTag
export type SchemaFeatureTag = {
    tag: 'Feature';
    key: string;
    global: boolean;
    contents: LegalFeatureContents[];
}

export type LegalMapContents = SchemaExitTag | SchemaImageTag | SchemaRoomTag
export type SchemaMapTag = {
    tag: 'Map';
    key: string;
    contents: LegalMapContents[];
}

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
    parseTag: ParseTag;
    constructor(message: string, parseTag: ParseTag) {
        super(message)
        this.name = 'WMLSchemaException'
        this.parseTag = parseTag
    }
}

export const isSchemaName = (value: SchemaTag): value is SchemaNameTag => (value.tag === 'Name')
export const isSchemaString = (value: SchemaTag): value is SchemaStringTag => (value.tag === 'String')
export const isSchemaExit = (value: SchemaTag): value is SchemaExitTag => (value.tag === 'Exit')
export const isSchemaFeature = (value: SchemaTag): value is SchemaFeatureTag => (value.tag === 'Feature')
export const isSchemaExitOrFeature = (value: SchemaTag): value is (SchemaExitTag | SchemaFeatureTag) => (isSchemaExit(value) || isSchemaFeature(value))
