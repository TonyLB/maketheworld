import { ParseTag } from "../parser/baseClasses"

export type SchemaAssetLegalContents = SchemaActionTag | SchemaComputedTag | SchemaConditionTag | SchemaExitTag | SchemaFeatureTag | SchemaImageTag | SchemaImportTag | SchemaMapTag | SchemaRoomTag | SchemaVariableTag
export type SchemaConditionLegalContents =  SchemaConditionTag | SchemaExitTag | SchemaFeatureTag | SchemaImageTag | SchemaMapTag | SchemaRoomTag

//
// TODO: Optional parse property is only needed for comparison in WMLQuery.  When schemaToWML functionality
// makes WMLQuery obsolete, remove the parse property entirely.
//
type SchemaBase = {
    parse?: ParseTag
}

export type SchemaConditionMixin = {
    conditions: {
        if: string;
        not?: boolean;
        dependencies: string[];
    }[]
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
export type SchemaConditionTagAssetContext = {
    tag: 'If';
    contextTag: 'Asset';
    key?: string;
    contents: SchemaAssetLegalContents[];
} & SchemaBase & SchemaConditionMixin

export type SchemaConditionTagNameContext = {
    tag: 'If';
    contextTag: 'Name';
    key?: string;
    contents: SchemaTaggedMessageIncomingContents[];
} & SchemaBase & SchemaConditionMixin

export type SchemaConditionTagDescriptionContext = {
    tag: 'If';
    contextTag: 'Description';
    key?: string;
    contents: SchemaTaggedMessageIncomingContents[];
} & SchemaBase & SchemaConditionMixin

export type SchemaConditionTagRoomContext = {
    tag: 'If';
    contextTag: 'Room';
    key?: string;
    contents: SchemaRoomLegalContents[];
} & SchemaBase & SchemaConditionMixin

export type SchemaConditionTagFeatureContext = {
    tag: 'If';
    contextTag: 'Feature';
    key?: string;
    contents: SchemaFeatureLegalContents[];
} & SchemaBase & SchemaConditionMixin

export type SchemaConditionTagMapContext = {
    tag: 'If';
    contextTag: 'Map';
    key?: string;
    contents: SchemaMapLegalContents[];
} & SchemaBase & SchemaConditionMixin

export type SchemaConditionTag = SchemaConditionTagAssetContext | SchemaConditionTagDescriptionContext | SchemaConditionTagNameContext | SchemaConditionTagRoomContext | SchemaConditionTagFeatureContext | SchemaConditionTagMapContext

export const isSchemaConditionTagDescriptionContext = (value: SchemaConditionTag): value is SchemaConditionTagDescriptionContext => (value.contextTag === 'Description')
export const isSchemaConditionTagRoomContext = (value: SchemaConditionTag): value is SchemaConditionTagRoomContext => (value.contextTag === 'Room')
export const isSchemaConditionTagFeatureContext = (value: SchemaConditionTag): value is SchemaConditionTagFeatureContext => (value.contextTag === 'Feature')
export const isSchemaConditionTagMapContext = (value: SchemaConditionTag): value is SchemaConditionTagMapContext => (value.contextTag === 'Map')

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
} & SchemaBase

export type SchemaTaggedMessageIncomingContents = SchemaStringTag | SchemaLinkTag | SchemaBookmarkTag | SchemaLineBreakTag | SchemaSpacerTag | SchemaConditionTagDescriptionContext | SchemaWhitespaceTag
export type SchemaTaggedMessageLegalContents = SchemaStringTag | SchemaLinkTag | SchemaBookmarkTag | SchemaLineBreakTag | SchemaSpacerTag | SchemaConditionTag

export type SchemaDescriptionTag = {
    tag: 'Description';
    display?: 'before' | 'after' | 'replace';
    contents: SchemaTaggedMessageLegalContents[];
} & SchemaBase

export type SchemaBookmarkTag = {
    tag: 'Bookmark';
    key: string;
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
export type SchemaRoomLegalContents = SchemaDescriptionTag | SchemaExitTag | SchemaFeatureTag | SchemaConditionTagRoomContext
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

export type SchemaFeatureLegalContents = SchemaDescriptionTag | SchemaNameTag | SchemaConditionTagFeatureContext
export type SchemaFeatureTag = {
    tag: 'Feature';
    key: string;
    global: boolean;
    name: SchemaTaggedMessageLegalContents[];
    render: SchemaTaggedMessageLegalContents[];
    contents: SchemaFeatureLegalContents[];
} & SchemaBase

export type SchemaMapLegalContents = SchemaExitTag | SchemaImageTag | SchemaRoomTag | SchemaConditionTagMapContext

export type SchemaMapRoom = {
    key: string;
    x: number;
    y: number;
    index: number;
} & SchemaConditionMixin

export type SchemaMapTag = {
    tag: 'Map';
    key: string;
    name: SchemaTaggedMessageLegalContents[];
    contents: SchemaMapLegalContents[];
    rooms: SchemaMapRoom[];
    images: string[];
} & SchemaBase

export type SchemaMessageRoom = {
    key: string;
    index: number;
} & SchemaConditionMixin

export type SchemaMessageLegalContents = SchemaRoomTag | SchemaTaggedMessageLegalContents

export type SchemaMessageTag = {
    tag: 'Message';
    key: string;
    render: SchemaTaggedMessageLegalContents[];
    contents: SchemaMessageLegalContents[];
    rooms: SchemaMessageRoom[];
} & SchemaBase

export type SchemaMomentTag = {
    tag: 'Moment';
    key: string;
    contents: SchemaMessageTag[];
} & SchemaBase

export type SchemaStringTag = {
    tag: 'String';
    value: string;
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
    SchemaBookmarkTag |
    SchemaNameTag |
    SchemaRoomTag |
    SchemaFeatureTag |
    SchemaMapTag |
    SchemaStringTag |
    SchemaWhitespaceTag |
    SchemaMessageTag |
    SchemaMomentTag

export type SchemaWithContents = SchemaAssetTag |
    SchemaStoryTag |
    SchemaConditionTag |
    SchemaRoomTag |
    SchemaFeatureTag |
    SchemaDescriptionTag |
    SchemaBookmarkTag |
    SchemaExitTag |
    SchemaCharacterTag |
    SchemaMapTag |
    SchemaNameTag |
    SchemaFirstImpressionTag |
    SchemaOneCoolThingTag |
    SchemaOutfitTag |
    SchemaMessageTag |
    SchemaMomentTag

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
export const isSchemaBookmark = (value: SchemaTag): value is SchemaBookmarkTag => (value.tag === 'Bookmark')
export const isSchemaExit = (value: SchemaTag): value is SchemaExitTag => (value.tag === 'Exit')
export const isSchemaFeature = (value: SchemaTag): value is SchemaFeatureTag => (value.tag === 'Feature')
export const isSchemaRoom = (value: SchemaTag): value is SchemaRoomTag => (value.tag === 'Room')
export const isSchemaMap = (value: SchemaTag): value is SchemaMapTag => (value.tag === 'Map')
export const isSchemaMessage = (value: SchemaTag): value is SchemaMessageTag => (value.tag === 'Message')
export const isSchemaMoment = (value: SchemaTag): value is SchemaMomentTag => (value.tag === 'Moment')
export const isSchemaFeatureContents = (value: SchemaTag): value is SchemaFeatureLegalContents => (isSchemaExit(value) || isSchemaFeature(value) || value.tag === 'Description' || isSchemaCondition(value))
export const isSchemaFeatureIncomingContents = (value: SchemaTag): value is SchemaFeatureLegalContents => (isSchemaExit(value) || isSchemaFeature(value) || value.tag === 'Description' || isSchemaCondition(value) || isSchemaName(value))
export const isSchemaRoomContents = (value: SchemaTag): value is SchemaRoomLegalContents => (['Image', 'Exit', 'Feature', 'Description', 'If'].includes(value.tag))
export const isSchemaRoomIncomingContents = (value: SchemaTag): value is SchemaRoomLegalContents => (['Name', 'Image', 'Exit', 'Feature', 'Description', 'If'].includes(value.tag))
export const isSchemaMapContents = (value: SchemaTag): value is SchemaMapLegalContents => (['Image', 'Exit', 'Room', 'If'].includes(value.tag))

export const isSchemaFirstImpression = (value: SchemaTag): value is SchemaFirstImpressionTag => (value.tag === 'FirstImpression')
export const isSchemaOneCoolThing = (value: SchemaTag): value is SchemaOneCoolThingTag => (value.tag === 'OneCoolThing')
export const isSchemaPronouns = (value: SchemaTag): value is SchemaPronounsTag => (value.tag === 'Pronouns')
export const isSchemaOutfit = (value: SchemaTag): value is SchemaOutfitTag => (value.tag === 'Outfit')
export const isSchemaImage = (value: SchemaTag): value is SchemaImageTag => (value.tag === 'Image')

export const isSchemaLink = (value: SchemaTag): value is SchemaLinkTag => (value.tag === 'Link')
export const isSchemaWhitespace = (value: SchemaTag): value is SchemaWhitespaceTag => (value.tag === 'Whitespace')
export const isSchemaLineBreak = (value: SchemaTag): value is SchemaLineBreakTag => (value.tag === 'br')
export const isSchemaSpacer = (value: SchemaTag): value is SchemaSpacerTag => (value.tag === 'Space')
export const isSchemaCondition = (value: SchemaTag): value is SchemaConditionTag => (value.tag === 'If')

export const isSchemaAction = (value: SchemaTag): value is SchemaActionTag => (value.tag === 'Action')
export const isSchemaVariable = (value: SchemaTag): value is SchemaVariableTag => (value.tag === 'Variable')
export const isSchemaComputed = (value: SchemaTag): value is SchemaComputedTag => (value.tag === 'Computed')

export const isSchemaImport = (value: SchemaTag): value is SchemaImportTag => (value.tag === 'Import')
export const isSchemaUse = (value: SchemaTag): value is SchemaUseTag => (value.tag === 'Use')

export const isSchemaCharacter = (value: SchemaTag): value is SchemaCharacterTag => (value.tag === 'Character')
export const isSchemaAsset = (value: SchemaTag): value is SchemaAssetTag => (value.tag === 'Asset')

export const isSchemaWithContents = (value: SchemaTag): value is SchemaWithContents => (
    ['Asset', 'Story', 'If', 'Room', 'Feature', 'Description', 'Exit', 'Character', 'Map', 'Message', 'Moment', 'Name', 'FirstImpression', 'OneCoolThing', 'Outfit'].includes(value.tag)
)

export type SchemaWithKey = SchemaAssetTag | SchemaStoryTag | SchemaRoomTag | SchemaFeatureTag | SchemaBookmarkTag | SchemaCharacterTag | SchemaMapTag | SchemaImageTag | SchemaActionTag | SchemaVariableTag | SchemaComputedTag | SchemaExitTag | SchemaMessageTag | SchemaMomentTag
export const isSchemaWithKey = (value: SchemaTag): value is SchemaWithKey => (
    ['Asset', 'Story', 'Room', 'Feature', 'Bookmark', 'Character', 'Map', 'Image', 'Action', 'Variable', 'Computed', 'Exit', 'Message', 'Moment'].includes(value.tag)
)

export const isSchemaTaggedMessageLegalContents = (value: SchemaTag): value is SchemaTaggedMessageLegalContents => (
    ['String', 'Link', 'Bookmark', 'Space', 'br', 'If'].includes(value.tag)
)

export const isSchemaTag = (value: any): value is SchemaTag => {
    if ('tag' in value) {
        if (
            ['Asset',
            'Story',
            'FirstImpression',
            'Pronouns',
            'OneCoolThing',
            'Outfit',
            'Character',
            'Image',
            'Variable',
            'Computed',
            'Action',
            'Use',
            'Import',
            'If',
            'Exit',
            'Description',
            'br',
            'Spacer',
            'Link',
            'Name',
            'Room',
            'Feature',
            'Bookmark',
            'Message',
            'Moment',
            'Map',
            'String',
            'Whitespace']
                .includes(value.tag)
        ) {
            return true
        }
    }
    return false
}