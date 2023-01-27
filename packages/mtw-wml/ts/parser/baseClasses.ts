import {
    Token,
    TokenExpressionValue,
    TokenKeyValue,
    TokenLiteralValue,
    ParseStackTokenEntry
} from './tokenizer/baseClasses'
import keyValueTokenizer from './tokenizer/key';

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
    ParseElseTag |
    ParseElseIfTag |
    ParseFeatureTag |
    ParseImageTag |
    ParseImportTag |
    ParseMapTag |
    ParseRoomTag |
    ParseBookmarkTag |
    ParseVariableTag |
    ParseMessageTag |
    ParseMomentTag |
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

export type ParseComputedTag = {
    tag: 'Computed';
    key: string;
    src: string;
    dependencies: string[];
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

export type ParseConditionLegalContextTag = 'Asset' | 'Description' | 'Room' | 'Feature' | 'Map' | 'Bookmark'

export type ParseConditionContentsFromContextTag<T extends ParseConditionLegalContextTag> =
    T extends ('Description' | 'Bookmark')
        ? ParseTaggedMessageLegalContents
        : T extends 'Room'
            ? ParseRoomLegalContents
            : T extends 'Feature'
                ? ParseFeatureLegalContents
                : T extends 'Map'
                    ? ParseMapLegalContents
                    : ParseAssetLegalContents

export type ParseConditionTypeFromContextTag<K extends 'If' | 'Else' | 'ElseIf', T extends ParseConditionLegalContextTag> = {
    tag: K;
    contextTag: T;
    contents: ParseConditionContentsFromContextTag<T>[];
} & (K extends 'If' | 'ElseIf' ? {
    if: string;
    dependencies: string[];
} : {}) & ParseTagBase

export type ParseConditionTagAssetContext = ParseConditionTypeFromContextTag<'If', 'Asset'>
export type ParseConditionTagDescriptionContext = ParseConditionTypeFromContextTag<'If', 'Description'>
export type ParseConditionTagRoomContext = ParseConditionTypeFromContextTag<'If', 'Room'>
export type ParseConditionTagFeatureContext = ParseConditionTypeFromContextTag<'If', 'Feature'>
export type ParseConditionTagMapContext = ParseConditionTypeFromContextTag<'If', 'Map'>

export type ParseConditionTag = ParseConditionTypeFromContextTag<'If', ParseConditionLegalContextTag>

export const isLegalParseConditionContextTag = (value: string): value is ParseConditionLegalContextTag => (['Asset', 'Description', 'Room', 'Feature', 'Bookmark', 'Map'].includes(value))
export const isParseConditionTagAssetContext = (value: ParseConditionTag): value is ParseConditionTagAssetContext => (value.contextTag === 'Asset')
export const isParseConditionTagDescriptionContext = (value: ParseConditionTag): value is ParseConditionTagDescriptionContext => (value.contextTag === 'Description')
export const isParseConditionTagRoomContext = (value: ParseConditionTag): value is ParseConditionTagRoomContext => (value.contextTag === 'Room')
export const isParseConditionTagFeatureContext = (value: ParseConditionTag): value is ParseConditionTagFeatureContext => (value.contextTag === 'Feature')
export const isParseConditionTagMapContext = (value: ParseConditionTag): value is ParseConditionTagMapContext => (value.contextTag === 'Map')

export type ParseElseTagAssetContext = ParseConditionTypeFromContextTag<'Else', 'Asset'>
export type ParseElseTagDescriptionContext = ParseConditionTypeFromContextTag<'Else', 'Description'>
export type ParseElseTagRoomContext = ParseConditionTypeFromContextTag<'Else', 'Room'>
export type ParseElseTagFeatureContext = ParseConditionTypeFromContextTag<'Else', 'Feature'>
export type ParseElseTagMapContext = ParseConditionTypeFromContextTag<'Else', 'Map'>

export type ParseElseTag = ParseConditionTypeFromContextTag<'Else', ParseConditionLegalContextTag>

export const isParseElseTagAssetContext = (value: ParseElseTag): value is ParseElseTagAssetContext => (value.contextTag === 'Asset')
export const isParseElseTagDescriptionContext = (value: ParseElseTag): value is ParseElseTagDescriptionContext => (value.contextTag === 'Description')
export const isParseElseTagRoomContext = (value: ParseElseTag): value is ParseElseTagRoomContext => (value.contextTag === 'Room')
export const isParseElseTagFeatureContext = (value: ParseElseTag): value is ParseElseTagFeatureContext => (value.contextTag === 'Feature')
export const isParseElseTagMapContext = (value: ParseElseTag): value is ParseElseTagMapContext => (value.contextTag === 'Map')

export type ParseElseIfTagAssetContext = ParseConditionTypeFromContextTag<'ElseIf', 'Asset'>
export type ParseElseIfTagDescriptionContext = ParseConditionTypeFromContextTag<'ElseIf', 'Description'>
export type ParseElseIfTagRoomContext = ParseConditionTypeFromContextTag<'ElseIf', 'Room'>
export type ParseElseIfTagFeatureContext = ParseConditionTypeFromContextTag<'ElseIf', 'Feature'>
export type ParseElseIfTagMapContext = ParseConditionTypeFromContextTag<'ElseIf', 'Map'>

export type ParseElseIfTag = ParseConditionTypeFromContextTag<'ElseIf', ParseConditionLegalContextTag>

export const isParseElseIfTagAssetContext = (value: ParseElseIfTag): value is ParseElseIfTagAssetContext => (value.contextTag === 'Asset')
export const isParseElseIfTagDescriptionContext = (value: ParseElseIfTag): value is ParseElseIfTagDescriptionContext => (value.contextTag === 'Description')
export const isParseElseIfTagRoomContext = (value: ParseElseIfTag): value is ParseElseIfTagRoomContext => (value.contextTag === 'Room')
export const isParseElseIfTagFeatureContext = (value: ParseElseIfTag): value is ParseElseIfTagFeatureContext => (value.contextTag === 'Feature')
export const isParseElseIfTagMapContext = (value: ParseElseIfTag): value is ParseElseIfTagMapContext => (value.contextTag === 'Map')

export const parseDifferentiatingTags: Record<ParseConditionLegalContextTag,  ParseTag["tag"][]> = {
    Asset: ['Exit', 'Feature', 'Room', 'If', 'Else', 'ElseIf', 'Image', 'Map', 'Message'],
    Description: ['If', 'Else', 'ElseIf', 'Space', 'String', 'Link', 'Bookmark', 'br', 'Whitespace'],
    Bookmark: ['If', 'Else', 'ElseIf', 'Space', 'String', 'Link', 'Bookmark',  'br', 'Whitespace'],
    Room: ['If', 'Else', 'ElseIf', 'Description', 'Name', 'Exit'],
    Feature: ['If', 'Else', 'ElseIf', 'Description', 'Name'],
    Map: ['If', 'Else', 'ElseIf', 'Image', 'Room', 'Name', 'Exit']
}

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

export type ParseTaggedMessageLegalContents = ParseWhitespaceTag |
    ParseStringTag |
    ParseLinkTag |
    ParseBookmarkTag |
    ParseLineBreakTag |
    ParseSpacerTag |
    ParseConditionTagDescriptionContext |
    ParseElseTagDescriptionContext |
    ParseElseIfTagDescriptionContext |
    ParseAfterTag |
    ParseBeforeTag |
    ParseReplaceTag

export type ParseTaggedMessageTag<T extends string> = {
    tag: T;
    contents: ParseTaggedMessageLegalContents[];
} & ParseTagBase

export type ParseDescriptionTag = ParseTaggedMessageTag<"Description">
export type ParseAfterTag = ParseTaggedMessageTag<"After">
export type ParseBeforeTag = ParseTaggedMessageTag<"Before">
export type ParseReplaceTag = ParseTaggedMessageTag<"Replace">

export type ParseLineBreakTag = {
    tag: 'br';
} & ParseTagBase

export type ParseSpacerTag = {
    tag: 'Space';
} & ParseTagBase

export type ParseRoomLegalContents = ParseDescriptionTag | ParseNameTag | ParseExitTag | ParseFeatureTag | ParseConditionTagRoomContext | ParseElseTagRoomContext | ParseElseIfTagRoomContext
export type ParseRoomTag = {
    tag: 'Room';
    key: string;
    global: boolean;
    display?: string;
    x?: number;
    y?: number;
    contents: ParseRoomLegalContents[];
} & ParseTagBase

export type ParseFeatureLegalContents = ParseDescriptionTag | ParseNameTag | ParseConditionTagFeatureContext | ParseElseTagFeatureContext | ParseElseIfTagFeatureContext
export type ParseFeatureTag = {
    tag: 'Feature';
    key: string;
    global: boolean;
    contents: ParseFeatureLegalContents[];
} & ParseTagBase

export type ParseBookmarkTag = ParseTaggedMessageTag<"Bookmark"> & { key: string; }

export type ParseMapLegalContents = ParseNameTag | ParseRoomTag | ParseImageTag | ParseConditionTagMapContext | ParseElseTagMapContext | ParseElseIfTagMapContext
export type ParseMapTag = {
    tag: 'Map';
    key: string;
    contents: ParseMapLegalContents[];
} & ParseTagBase

export type ParseMessageLegalContents = ParseTaggedMessageLegalContents | ParseRoomTag
export type ParseMessageTag = {
    tag: 'Message';
    key: string;
    contents: ParseMessageLegalContents[];
} & ParseTagBase

export type ParseMomentTag = {
    tag: 'Moment';
    key: string;
    contents: ParseMessageTag[];
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
    ParseActionTag |
    ParseUseTag |
    ParseImportTag |
    ParseConditionTag |
    ParseElseTag |
    ParseElseIfTag |
    ParseExitTag |
    ParseDescriptionTag |
    ParseLineBreakTag |
    ParseLinkTag |
    ParseBookmarkTag |
    ParseRoomTag |
    ParseFeatureTag |
    ParseMapTag |
    ParseMessageTag |
    ParseMomentTag |
    ParseStringTag |
    ParseWhitespaceTag |
    ParseSpacerTag |
    ParseCommentTag |
    ParseAfterTag |
    ParseBeforeTag |
    ParseReplaceTag

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
    'Action',
    'Use',
    'Import',
    'If',
    'Else',
    'ElseIf',
    'Exit',
    'Description',
    'br',
    'Link',
    'Room',
    'Feature',
    'Map',
    'Bookmark',
    'Message',
    'Moment',
    'String',
    'Whitespace',
    'Space',
    'Comment',
    'After',
    'Before',
    'Replace'
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

export const isParseTagNesting = (value: ParseTag): value is (ParseRoomTag | ParseFeatureTag | ParseAssetTag | ParseStoryTag | ParseCharacterTag | ParseImportTag | ParseDescriptionTag | ParseConditionTag | ParseElseTag | ParseLinkTag | ParseBookmarkTag | ParseMapTag | ParseExitTag | ParseNameTag | ParseFirstImpressionTag | ParseOneCoolThingTag | ParseOutfitTag | ParseMessageTag | ParseMomentTag  | ParseAfterTag | ParseBeforeTag | ParseReplaceTag) => (
    ['Room', 'Feature', 'Asset', 'Story', 'Character', 'Import', 'Description', 'If', 'Else', 'ElseIf', 'Link', 'Bookmark', 'Map', 'Message', 'Moment', 'Exit', 'Name', 'FirstImpression', 'OneCoolThing', 'Outfit', 'After', 'Before', 'Replace'].includes(value.tag)
)

export const isParseTypeFromTag = <T extends ParseTag>(tag: T["tag"]) => (item: ParseTag | {}): item is T => ("tag" in item && item.tag === tag)
export const isParseExit = isParseTypeFromTag<ParseExitTag>('Exit')
export const isParseImage = isParseTypeFromTag<ParseImageTag>('Image')
export const isParseCondition = isParseTypeFromTag<ParseConditionTag>('If')
export const isParseElseIf = isParseTypeFromTag<ParseElseIfTag>('ElseIf')
export const isParseElse = isParseTypeFromTag<ParseElseTag>('Else')
export const isParseString = isParseTypeFromTag<ParseStringTag>('String')
export const isParseWhitespace = isParseTypeFromTag<ParseWhitespaceTag>('Whitespace')
export const isParseLineBreak = isParseTypeFromTag<ParseLineBreakTag>('br')
export const isParseSpacer = isParseTypeFromTag<ParseSpacerTag>('Space')
export const isParseLink = isParseTypeFromTag<ParseLinkTag>('Link')

export const isParseAction = isParseTypeFromTag<ParseActionTag>('Action')
export const isParseVariable = isParseTypeFromTag<ParseVariableTag>('Variable')
export const isParseComputed = isParseTypeFromTag<ParseComputedTag>('Computed')

export const isParseImport = isParseTypeFromTag<ParseImportTag>('Import')
export const isParseUse = isParseTypeFromTag<ParseUseTag>('Use')

export const isParseDescription = isParseTypeFromTag<ParseDescriptionTag>('Description')
export const isParseAfter = isParseTypeFromTag<ParseAfterTag>('After')
export const isParseBefore = isParseTypeFromTag<ParseBeforeTag>('Before')
export const isParseReplace = isParseTypeFromTag<ParseReplaceTag>('Replace')
export const isParseName = isParseTypeFromTag<ParseNameTag>('Name')
export const isParseRoom = isParseTypeFromTag<ParseRoomTag>('Room')
export const isParseFeature = isParseTypeFromTag<ParseFeatureTag>('Feature')
export const isParseBookmark = isParseTypeFromTag<ParseBookmarkTag>('Bookmark')
export const isParseMap = isParseTypeFromTag<ParseMapTag>('Map')
export const isParseMessage = isParseTypeFromTag<ParseMessageTag>('Message')
export const isParseMoment = isParseTypeFromTag<ParseMomentTag>('Moment')

export const isParsePronouns = isParseTypeFromTag<ParsePronounsTag>('Pronouns')
export const isParseFirstImpression = isParseTypeFromTag<ParseFirstImpressionTag>('FirstImpression')
export const isParseOneCoolThing = isParseTypeFromTag<ParseOneCoolThingTag>('OneCoolThing')
export const isParseOutfit = isParseTypeFromTag<ParseOutfitTag>('Outfit')
export const isParseCharacter = isParseTypeFromTag<ParseCharacterTag>('Character')

export const isParseAsset = isParseTypeFromTag<ParseAssetTag>('Asset')
export const isParseStory = isParseTypeFromTag<ParseStoryTag>('Story')

export const isParseComment = isParseTypeFromTag<ParseCommentTag>('Comment')

export type ParseStackEntry = ParseStackTagOpenPendingEntry | ParseStackTagOpenEntry | ParseStackTagEntry<ParseTag> | ParseStackTokenEntry<Token>

export const isParseStackTagOpenEntry = (value: ParseStackEntry): value is ParseStackTagOpenEntry => (value.type === 'TagOpen')

export type ParseTagFactoryProps = {
    open: ParseStackTagOpenEntry;
    context: ParseStackTagOpenEntry[];
    contents: ParseTag[];
    endTagToken: number
}

export type ParseTagFactoryPropsLimited<T extends ParseTag["tag"]> = {
    open: Omit<ParseStackTagOpenEntry, 'tag'> & { tag: T };
    context: ParseStackTagOpenEntry[];
    contents: ParseTag[];
    endTagToken: number;
}

export type ParseTagFactory<T extends ParseTag> = (value: ParseTagFactoryProps) => ParseStackTagEntry<T>

export const parseTagDefaultProps: Record<string, string> = {
    If: 'if',
    ElseIf: 'if'
}
