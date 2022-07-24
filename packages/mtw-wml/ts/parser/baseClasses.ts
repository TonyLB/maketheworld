import { Token } from './tokenizer/baseClasses'

type ParseTagBase = {
    startTagToken: number;
    endTagToken: number;
    startContentsToken?: number;
    endContentsToken?: number;
    closeToken?: number;
}

type ParseNestingBase = {
    contents: ParseTag[];
} & ParseTagBase

type ParseValueBase = {
    value: string;
} & ParseTagBase

type ParseAssetBase = {
    key: string;
} & ParseNestingBase

export type ParseAssetTag = {
    tag: 'Asset';
} & ParseAssetBase

export type ParseStoryTag = {
    tag: 'Story';
    instance: boolean;
} & ParseAssetBase

export type ParseNameTag = {
    tag: 'Name';
    spaceBefore?: boolean;
    spaceAfter?: boolean;
} & ParseValueBase

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

export type ParseCharacterTag = {
    tag: 'Character';
    player?: string;
    name: ParseNameTag;
    pronouns: ParsePronounsTag;
    firstImpression?: ParseFirstImpressionTag;
    oneCoolThing?: ParseOneCoolThingTag;
    outfit?: ParseOutfitTag;
    image?: ParseImageTag;
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
} & ParseNestingBase

export type ParseActionTag = {
    tag: 'Action';
    src: string;
} & ParseTagBase

export type ParseUseTag = {
    tag: 'Use';
    key: string;
    as?: string;
    type?: string;
} & ParseTagBase

export type ParseImportTag = {
    tag: 'Import';
    from: string;
} & ParseNestingBase

export type ParseConditionTag = {
    tag: 'Condition';
    if: string;
    dependencies: ParseDependencyTag[];
} & ParseNestingBase

export type ParseExitTag = {
    tag: 'Exit';
    key: string;
    name: string;
    to?: string;
    from?: string;
} & ParseTagBase

export type ParseLinkTag = {
    tag: 'Link';
    to: string;
} & ParseNestingBase

export type ParseDescriptionTag = {
    tag: 'Description';
    display: 'before' | 'after' | 'replace';
    spaceBefore: boolean;
    spaceAfter: boolean;
} & ParseNestingBase

export type ParseLineBreakTag = {
    tag: 'br';
} & ParseTagBase

export type ParseRoomTag = {
    tag: 'Room';
    key: string;
    global: boolean;
    display?: string;
    x?: number;
    y?: number;
} & ParseNestingBase

export type ParseFeatureTag = {
    tag: 'Feature';
    key: string;
    global: boolean;
} & ParseNestingBase

export type ParseTag = ParseAssetTag |
    ParseStoryTag |
    ParseCharacterTag |
    ParseNameTag |
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
    ParseFeatureTag
