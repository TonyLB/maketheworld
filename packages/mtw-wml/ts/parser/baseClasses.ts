import {
    Token,
    TokenExpressionValue,
    TokenKeyValue,
    TokenLiteralValue,
    ParseStackTokenEntry
} from './tokenizer/baseClasses'

type ParseTagBase = {
    startTagToken: number;
    endTagToken: number;
}

export type ParseLiteralLegalContents = ParseStringTag
type ParseValueBase = {
    value: string;
    contents: ParseLiteralLegalContents[];
} & ParseTagBase

export type ParseAssetLegalContents = ParseActionTag |
    ParseCommentTag |
    ParseComputedTag |
    ParseConditionTag |
    ParseExitTag |
    ParseFeatureTag |
    ParseImageTag |
    ParseImportTag |
    ParseMapTag |
    ParseRoomTag |
    ParseVariableTag |
    ParseWhitespaceTag

type ParseAssetBase = {
    key: string;
    fileName?: string;
    zone?: string;
    subFolder?: string;
    player?: string;
    contents: ParseAssetLegalContents[];
} & ParseTagBase

export type ParseAssetTag = {
    tag: 'Asset';
} & ParseAssetBase

export type ParseStoryTag = {
    tag: 'Story';
    instance: boolean;
} & ParseAssetBase

export type ParseNameTag = ParseTaggedMessageTag<"Name">

export type ParsePronounsTag = {
    tag: 'Pronouns';
    subject: string;
    object: string;
    possessive: string;
    reflexive: string;
    adjective: string;
} & ParseTagBase

export type ParseOneCoolThingTag = {
    tag: 'OneCoolThing';
} & ParseValueBase

export type ParseFirstImpressionTag = {
    tag: 'FirstImpression';
} & ParseValueBase

export type ParseOutfitTag = {
    tag: 'Outfit';
} & ParseValueBase

export type ParseImageTag = {
    tag: 'Image';
    key: string;
    fileURL?: string;
} & ParseTagBase

export type ParseCharacterLegalContents = ParseNameTag | ParsePronounsTag | ParseFirstImpressionTag | ParseOneCoolThingTag | ParseOutfitTag | ParseImageTag
export type ParseCharacterTag = {
    tag: 'Character';
    key: string;
    player?: string;
    fileName?: string;
    zone?: string;
    subFolder?: string;
    contents: ParseCharacterLegalContents[];
} & ParseTagBase

export type ParseVariableTag = {
    tag: 'Variable';
    key: string;
    default?: string;
} & ParseTagBase

export type ParseDependencyTag = {
    tag: 'Depend';
    on: string;
} & ParseTagBase

export type ParseComputedTag = {
    tag: 'Computed';
    key: string;
    src: string;
    dependencies: ParseDependencyTag[];
} & ParseTagBase

export type ParseActionTag = {
    tag: 'Action';
    key: string;
    src: string;
} & ParseTagBase

export type ParseUseTag = {
    tag: 'Use';
    key: string;
    as?: string;
    type?: string;
} & ParseTagBase

export type ParseImportLegalContents = ParseUseTag
export type ParseImportTag = {
    tag: 'Import';
    from: string;
    contents: ParseImportLegalContents[];
} & ParseTagBase

export type ParseConditionLegalContextTag = 'Asset' | 'Description'

export type ParseConditionTagAssetContext = {
    tag: 'If';
    contextTag: 'Asset';
    if: string;
    dependencies: ParseDependencyTag[];
    contents: ParseAssetLegalContents[];
} & ParseTagBase

export type ParseConditionTagDescriptionContext = {
    tag: 'If';
    contextTag: 'Description';
    if: string;
    dependencies: ParseDependencyTag[];
    contents: ParseTaggedMessageLegalContents[];
} & ParseTagBase

export type ParseConditionTypeFromContextTag<T extends ParseConditionLegalContextTag> =
    T extends 'Description' ? ParseConditionTagDescriptionContext : ParseConditionTagAssetContext

export type ParseConditionTag = ParseConditionTagAssetContext | ParseConditionTagDescriptionContext

export const isParseConditionTagAssetContext = (value: ParseConditionTag): value is ParseConditionTagAssetContext => (value.contextTag === 'Asset')
export const isParseConditionTagDescriptionContext = (value: ParseConditionTag): value is ParseConditionTagDescriptionContext => (value.contextTag === 'Description')

export type ParseExitTag = {
    tag: 'Exit';
    key?: string;
    name: string;
    to?: string;
    from?: string;
    contents: ParseStringTag[];
} & ParseTagBase

export type ParseLinkLegalContents = ParseStringTag | ParseWhitespaceTag
export type ParseLinkTag = {
    tag: 'Link';
    to: string;
    contents: ParseLinkLegalContents[];
} & ParseTagBase

export type ParseTaggedMessageLegalContents = ParseWhitespaceTag | ParseStringTag | ParseLinkTag | ParseLineBreakTag | ParseSpacerTag

export type ParseTaggedMessageTag<T extends string> = {
    tag: T;
    display?: 'before' | 'after' | 'replace';
    contents: ParseTaggedMessageLegalContents[];
} & ParseTagBase

export type ParseDescriptionTag = ParseTaggedMessageTag<"Description">

export type ParseLineBreakTag = {
    tag: 'br';
} & ParseTagBase

export type ParseSpacerTag = {
    tag: 'Space';
} & ParseTagBase

export type ParseRoomLegalContents = ParseDescriptionTag | ParseNameTag | ParseExitTag | ParseFeatureTag
export type ParseRoomTag = {
    tag: 'Room';
    key: string;
    global: boolean;
    display?: string;
    x?: number;
    y?: number;
    contents: ParseRoomLegalContents[];
} & ParseTagBase

export type ParseFeatureLegalContents = ParseDescriptionTag | ParseNameTag
export type ParseFeatureTag = {
    tag: 'Feature';
    key: string;
    global: boolean;
    contents: ParseFeatureLegalContents[];
} & ParseTagBase

export type ParseMapLegalContents = ParseNameTag | ParseRoomTag | ParseImageTag | ParseExitTag
export type ParseMapTag = {
    tag: 'Map';
    key: string;
    contents: ParseMapLegalContents[];
} & ParseTagBase

export type ParseStringTag = {
    tag: 'String';
    value: string;
} & ParseTagBase

export type ParseWhitespaceTag = {
    tag: 'Whitespace';
} & ParseTagBase

export type ParseCommentTag = {
    tag: 'Comment';
} & ParseTagBase

export type ParseTag = ParseAssetTag |
    ParseStoryTag |
    ParseNameTag |
    ParseCharacterTag |
    ParsePronounsTag |
    ParseOneCoolThingTag |
    ParseFirstImpressionTag |
    ParseOutfitTag |
    ParseImageTag |
    ParseVariableTag |
    ParseComputedTag |
    ParseDependencyTag |
    ParseActionTag |
    ParseUseTag |
    ParseImportTag |
    ParseConditionTag |
    ParseExitTag |
    ParseDescriptionTag |
    ParseLineBreakTag |
    ParseLinkTag |
    ParseRoomTag |
    ParseFeatureTag |
    ParseMapTag |
    ParseStringTag |
    ParseWhitespaceTag |
    ParseSpacerTag |
    ParseCommentTag

export type ParseLegalTag = ParseTag["tag"]

export const isParseLegalTag = (tag: string): tag is ParseLegalTag => ([
    'Asset',
    'Story',
    'Name',
    'Character',
    'Pronouns',
    'OneCoolThing',
    'FirstImpression',
    'Outfit',
    'Image',
    'Variable',
    'Computed',
    'Depend',
    'Action',
    'Use',
    'Import',
    'If',
    'Exit',
    'Description',
    'br',
    'Link',
    'Room',
    'Feature',
    'Map',
    'String',
    'Whitespace',
    'Space',
    'Comment'
].includes(tag))

export type ParseStackTagOpenPendingEntry = {
    type: 'TagOpenPending';
    tag: string;
    startTagToken: number;
}

export type ParseStackTagOpenEntry = {
    type: 'TagOpen';
    tag: ParseLegalTag;
    startTagToken: number;
    properties: Record<string, (TokenExpressionValue | TokenKeyValue | TokenLiteralValue | boolean)>;
}

export type ParseStackTagEntry<T extends ParseTag> = {
    type: 'Tag';
    tag: T;
}

export class ParseException extends Error {
    startToken: number
    endToken: number
    constructor(message: string, startToken: number, endToken: number) {
        super(message)
        this.name = 'ParseException'
        this.startToken = startToken
        this.endToken = endToken
    }
}

export const isParseTagDependency = (value: ParseTag): value is ParseDependencyTag => (value.tag === 'Depend')
export const isParseTagNesting = (value: ParseTag): value is (ParseRoomTag | ParseFeatureTag | ParseAssetTag | ParseStoryTag | ParseCharacterTag | ParseImportTag | ParseDescriptionTag | ParseConditionTag | ParseLinkTag | ParseMapTag | ParseExitTag | ParseNameTag | ParseFirstImpressionTag | ParseOneCoolThingTag | ParseOutfitTag) => (
    ['Room', 'Feature', 'Asset', 'Story', 'Character', 'Import', 'Description', 'If', 'Link', 'Map', 'Exit', 'Name', 'FirstImpression', 'OneCoolThing', 'Outfit'].includes(value.tag)
)
export const isParseExit = (value: ParseTag): value is ParseExitTag => (value.tag === 'Exit')
export const isParseRoom = (value: ParseTag): value is ParseRoomTag => (value.tag === 'Room')
export const isParseString = (value: ParseTag): value is ParseStringTag => (value.tag === 'String')

export type ParseStackEntry = ParseStackTagOpenPendingEntry | ParseStackTagOpenEntry | ParseStackTagEntry<ParseTag> | ParseStackTokenEntry<Token>

export const isParseStackTagOpenEntry = (value: ParseStackEntry): value is ParseStackTagOpenEntry => (value.type === 'TagOpen')

export type ParseTagFactory<T extends ParseTag> = (value: { open: ParseStackTagOpenEntry, context: ParseStackTagOpenEntry[]; contents: ParseTag[], endTagToken: number }) => ParseStackTagEntry<T>

export const parseTagDefaultProps: Record<string, string> = {
    If: 'if'
}
