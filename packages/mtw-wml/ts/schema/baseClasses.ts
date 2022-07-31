import { ParseTag } from "../parser/baseClasses";

export type SchemaAssetLegalContents = SchemaActionTag | SchemaComputedTag | SchemaConditionTag | SchemaExitTag | SchemaFeatureTag | SchemaImageTag | SchemaImportTag | SchemaMapTag | SchemaRoomTag | SchemaVariableTag
export type SchemaConditionLegalContents =  SchemaConditionTag | SchemaExitTag | SchemaFeatureTag | SchemaImageTag | SchemaMapTag | SchemaRoomTag

type SchemaAssetBase = {
    key: string;
    fileName?: string;
    zone?: string;
    subFolder?: string;
    player?: string;
    contents: SchemaAssetLegalContents[];
}

export type SchemaAssetTag = {
    tag: 'Asset';
    Story: undefined;
} & SchemaAssetBase

export type SchemaStoryTag = {
    tag: 'Asset';
    Story: true;
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

export type SchemaPronounsTag = {
    tag: 'Pronouns';
} & SchemaPronouns

export type SchemaFirstImpressionTag = {
    tag: 'FirstImpression';
    value: string;
}

export type SchemaOneCoolThingTag = {
    tag: 'OneCoolThing';
    value: string;
}

export type SchemaOutfitTag = {
    tag: 'Outfit';
    value: string;
}

export type SchemaCharacterLegalContents = SchemaNameTag | SchemaPronounsTag | SchemaFirstImpressionTag | SchemaOneCoolThingTag | SchemaOutfitTag | SchemaImageTag
//
// TODO: Refactor unnecessary capitalization on schema fields
//
export type SchemaCharacterTag = {
    tag: 'Character';
    key: string;
    player?: string;
    fileName?: string;
    zone?: string;
    subFolder?: string;
    Name: string;
    Pronouns: SchemaPronouns;
    FirstImpression?: string;
    OneCoolThing?: string;
    Outfit?: string;
    fileURL: string;
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
    key: string;
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
    contents: SchemaAssetLegalContents[];
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
    text: string;
}

export type SchemaDescriptionLegalContents = SchemaStringTag | SchemaLinkTag | SchemaLineBreakTag

export type SchemaDescriptionTag = {
    tag: 'Description';
    display: 'before' | 'after' | 'replace';
    spaceBefore: boolean;
    spaceAfter: boolean;
    contents: SchemaDescriptionLegalContents[];
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
export type SchemaRoomLegalContents = SchemaDescriptionTag | SchemaExitTag | SchemaFeatureTag
export type SchemaRoomTag = {
    tag: 'Room';
    key: string;
    name: string;
    render: SchemaDescriptionLegalContents[];
    global: boolean;
    display?: string;
    x?: number;
    y?: number;
    contents: SchemaRoomLegalContents[];
}

export type SchemaFeatureLegalContents = SchemaDescriptionTag | SchemaNameTag
export type SchemaFeatureTag = {
    tag: 'Feature';
    key: string;
    global: boolean;
    name: string;
    render: SchemaDescriptionLegalContents[];
    contents: SchemaFeatureLegalContents[];
}

export type SchemaMapLegalContents = SchemaExitTag | SchemaImageTag | SchemaRoomTag
export type SchemaMapTag = {
    tag: 'Map';
    key: string;
    name: string;
    contents: SchemaMapLegalContents[];
    rooms: Record<string, { x: number; y: number; }>;
    images: string[];
}

export type SchemaStringTag = {
    tag: 'String';
    value: string;
}

export type SchemaTag = SchemaAssetTag |
    SchemaStoryTag |
    SchemaFirstImpressionTag |
    SchemaPronounsTag |
    SchemaOneCoolThingTag |
    SchemaOutfitTag |
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
export const isSchemaDescriptionContents = (value: SchemaTag): value is SchemaDescriptionLegalContents => (['Whitespae', 'String', 'Link', 'br'].includes(value.tag))
export const isSchemaDescription = (value: SchemaTag): value is SchemaDescriptionTag => (value.tag === 'Description')
export const isSchemaExit = (value: SchemaTag): value is SchemaExitTag => (value.tag === 'Exit')
export const isSchemaFeature = (value: SchemaTag): value is SchemaFeatureTag => (value.tag === 'Feature')
export const isSchemaRoom = (value: SchemaTag): value is SchemaRoomTag => (value.tag === 'Room')
export const isSchemaExitOrFeature = (value: SchemaTag): value is (SchemaExitTag | SchemaFeatureTag) => (isSchemaExit(value) || isSchemaFeature(value))
export const isSchemaRoomContents = (value: SchemaTag): value is SchemaRoomLegalContents => (['Image', 'Exit', 'Feature'].includes(value.tag))
export const isSchemaMapContents = (value: SchemaTag): value is SchemaMapLegalContents => (['Image', 'Exit', 'Room'].includes(value.tag))

export const isSchemaFirstImpression = (value: SchemaTag): value is SchemaFirstImpressionTag => (value.tag === 'FirstImpression')
export const isSchemaOneCoolThing = (value: SchemaTag): value is SchemaOneCoolThingTag => (value.tag === 'OneCoolThing')
export const isSchemaPronouns = (value: SchemaTag): value is SchemaPronounsTag => (value.tag === 'Pronouns')
export const isSchemaOutfit = (value: SchemaTag): value is SchemaOutfitTag => (value.tag === 'Outfit')
export const isSchemaImage = (value: SchemaTag): value is SchemaImageTag => (value.tag === 'Image')
