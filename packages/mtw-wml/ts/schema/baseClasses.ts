import { ParseTag } from "../parser/baseClasses"

export type SchemaAssetLegalContents = SchemaActionTag | SchemaComputedTag | SchemaConditionTag | SchemaExitTag | SchemaFeatureTag | SchemaImageTag | SchemaImportTag | SchemaMapTag | SchemaRoomTag | SchemaVariableTag
export type SchemaConditionLegalContents =  SchemaConditionTag | SchemaExitTag | SchemaFeatureTag | SchemaImageTag | SchemaMapTag | SchemaRoomTag

type SchemaBase = {
    parse: ParseTag
}

type SchemaAssetBase = {
    key: string;
    fileName?: string;
    zone?: string;
    subFolder?: string;
    player?: string;
    contents: SchemaAssetLegalContents[];
} & SchemaBase

export type SchemaAssetTag = {
    tag: 'Asset';
    Story: undefined;
} & SchemaAssetBase

export type SchemaStoryTag = {
    tag: 'Story';
    Story: true;
    instance: boolean;
} & SchemaAssetBase

export type SchemaImageTag = {
    tag: 'Image';
    key: string;
    fileURL?: string;
} & SchemaBase

type SchemaPronouns = {
    subject: string;
    object: string;
    possessive: string;
    adjective: string;
    reflexive: string;
}

export type SchemaPronounsTag = {
    tag: 'Pronouns';
} & SchemaPronouns & SchemaBase

export type SchemaLiteralLegalContents = SchemaStringTag
export type SchemaFirstImpressionTag = {
    tag: 'FirstImpression';
    value: string;
    contents: SchemaLiteralLegalContents[];
} & SchemaBase

export type SchemaOneCoolThingTag = {
    tag: 'OneCoolThing';
    value: string;
    contents: SchemaLiteralLegalContents[];
} & SchemaBase

export type SchemaOutfitTag = {
    tag: 'Outfit';
    value: string;
    contents: SchemaLiteralLegalContents[];
    parse?: ParseTag;
} & SchemaBase

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
    contents: SchemaCharacterLegalContents[];
} & SchemaBase

export type SchemaVariableTag = {
    tag: 'Variable';
    key: string;
    default?: string;
} & SchemaBase

export type SchemaComputedTag = {
    tag: 'Computed';
    key: string;
    src: string;
    dependencies: string[];
} & SchemaBase

export type SchemaActionTag = {
    tag: 'Action';
    key: string;
    src: string;
} & SchemaBase

export type SchemaUseTag = {
    tag: 'Use';
    key: string;
    as?: string;
    type?: string;
} & SchemaBase

type SchemaImportMapping = {
    key: string;
    type: 'Room' | 'Feature' | 'Variable' | 'Computed' | 'Action' | 'Map'
}

export type SchemaImportTag = {
    tag: 'Import';
    key?: string;
    from: string;
    mapping: Record<string, SchemaImportMapping>;
} & SchemaBase

//
// TODO:  Figure out how to define limits on schemaConditionTag contents
// without causing circular reference
//
export type SchemaConditionTag = {
    tag: 'Condition';
    if: string;
    key?: string;
    dependencies: string[];
    contents: SchemaAssetLegalContents[];
} & SchemaBase

export type SchemaExitTag = {
    tag: 'Exit';
    key: string;
    name: string;
    to: string;
    from: string;
    contents: SchemaLiteralLegalContents[];
} & SchemaBase

export type SchemaLinkTag = {
    tag: 'Link';
    to: string;
    text: string;
    spaceBefore?: boolean;
    spaceAfter?: boolean;
} & SchemaBase

export type SchemaTaggedMessageIncomingContents = SchemaStringTag | SchemaLinkTag | SchemaLineBreakTag | SchemaSpacerTag | SchemaWhitespaceTag
export type SchemaTaggedMessageLegalContents = SchemaStringTag | SchemaLinkTag | SchemaLineBreakTag | SchemaSpacerTag

export type SchemaDescriptionTag = {
    tag: 'Description';
    display?: 'before' | 'after' | 'replace';
    contents: SchemaTaggedMessageLegalContents[];
} & SchemaBase

export type SchemaLineBreakTag = {
    tag: 'br';
} & SchemaBase

export type SchemaSpacerTag = {
    tag: 'Space';
} & SchemaBase

export type SchemaNameTag = {
    tag: 'Name';
    contents: SchemaTaggedMessageLegalContents[];
} & SchemaBase

//
// TODO: Refactor room schema formation to keep name and description tags not folded into name
// and render properties
//
export type SchemaRoomLegalContents = SchemaDescriptionTag | SchemaExitTag | SchemaFeatureTag
export type SchemaRoomTag = {
    tag: 'Room';
    key: string;
    name: SchemaTaggedMessageLegalContents[];
    render: SchemaTaggedMessageLegalContents[];
    global: boolean;
    display?: string;
    x?: number;
    y?: number;
    contents: SchemaRoomLegalContents[];
} & SchemaBase

export type SchemaFeatureLegalContents = SchemaDescriptionTag | SchemaNameTag
export type SchemaFeatureTag = {
    tag: 'Feature';
    key: string;
    global: boolean;
    name: SchemaTaggedMessageLegalContents[];
    render: SchemaTaggedMessageLegalContents[];
    contents: SchemaFeatureLegalContents[];
} & SchemaBase

export type SchemaMapLegalContents = SchemaExitTag | SchemaImageTag | SchemaRoomTag
export type SchemaMapTag = {
    tag: 'Map';
    key: string;
    name: SchemaTaggedMessageLegalContents[];
    contents: SchemaMapLegalContents[];
    rooms: Record<string, { x: number; y: number; index: number }>;
    images: string[];
} & SchemaBase

export type SchemaStringTag = {
    tag: 'String';
    value: string;
    spaceBefore?: boolean;
    spaceAfter?: boolean;
} & SchemaBase

export type SchemaWhitespaceTag = {
    tag: 'Whitespace';
} & SchemaBase

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
    SchemaSpacerTag |
    SchemaLinkTag |
    SchemaNameTag |
    SchemaRoomTag |
    SchemaFeatureTag |
    SchemaMapTag |
    SchemaStringTag |
    SchemaWhitespaceTag

export type SchemaWithContents = SchemaAssetTag |
    SchemaStoryTag |
    SchemaConditionTag |
    SchemaRoomTag |
    SchemaFeatureTag |
    SchemaDescriptionTag |
    SchemaExitTag |
    SchemaCharacterTag |
    SchemaMapTag |
    SchemaNameTag |
    SchemaFirstImpressionTag |
    SchemaOneCoolThingTag |
    SchemaOutfitTag

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
export const isSchemaDescriptionContents = (value: SchemaTag): value is SchemaTaggedMessageLegalContents => (['Whitespae', 'String', 'Link', 'br'].includes(value.tag))
export const isSchemaDescription = (value: SchemaTag): value is SchemaDescriptionTag => (value.tag === 'Description')
export const isSchemaExit = (value: SchemaTag): value is SchemaExitTag => (value.tag === 'Exit')
export const isSchemaFeature = (value: SchemaTag): value is SchemaFeatureTag => (value.tag === 'Feature')
export const isSchemaRoom = (value: SchemaTag): value is SchemaRoomTag => (value.tag === 'Room')
export const isSchemaFeatureContents = (value: SchemaTag): value is SchemaFeatureLegalContents => (isSchemaExit(value) || isSchemaFeature(value) || value.tag === 'Description')
export const isSchemaRoomContents = (value: SchemaTag): value is SchemaRoomLegalContents => (['Image', 'Exit', 'Feature', 'Description'].includes(value.tag))
export const isSchemaMapContents = (value: SchemaTag): value is SchemaMapLegalContents => (['Image', 'Exit', 'Room'].includes(value.tag))

export const isSchemaFirstImpression = (value: SchemaTag): value is SchemaFirstImpressionTag => (value.tag === 'FirstImpression')
export const isSchemaOneCoolThing = (value: SchemaTag): value is SchemaOneCoolThingTag => (value.tag === 'OneCoolThing')
export const isSchemaPronouns = (value: SchemaTag): value is SchemaPronounsTag => (value.tag === 'Pronouns')
export const isSchemaOutfit = (value: SchemaTag): value is SchemaOutfitTag => (value.tag === 'Outfit')
export const isSchemaImage = (value: SchemaTag): value is SchemaImageTag => (value.tag === 'Image')

export const isSchemaLink = (value: SchemaTag): value is SchemaLinkTag => (value.tag === 'Link')
export const isSchemaWhitespace = (value: SchemaTag): value is SchemaWhitespaceTag => (value.tag === 'Whitespace')
export const isSchemaLineBreak = (value: SchemaTag): value is SchemaLineBreakTag => (value.tag === 'br')
export const isSchemaSpacer = (value: SchemaTag): value is SchemaSpacerTag => (value.tag === 'Space')

export const isSchemaCharacter = (value: SchemaTag): value is SchemaCharacterTag => (value.tag === 'Character')

export const isSchemaWithContents = (value: SchemaTag): value is SchemaWithContents => (
    ['Asset', 'Story', 'Condition', 'Room', 'Feature', 'Description', 'Exit', 'Character', 'Map', 'Name', 'FirstImpression', 'OneCoolThing', 'Outfit'].includes(value.tag)
)

export type SchemaWithKey = SchemaAssetTag | SchemaStoryTag | SchemaRoomTag | SchemaFeatureTag | SchemaCharacterTag | SchemaMapTag | SchemaImageTag | SchemaActionTag | SchemaVariableTag | SchemaComputedTag | SchemaExitTag
export const isSchemaWithKey = (value: SchemaTag): value is SchemaWithKey => (
    ['Asset', 'Story', 'Room', 'Feature', 'Character', 'Map', 'Image', 'Action', 'Variable', 'Computed', 'Exit'].includes(value.tag)
)
