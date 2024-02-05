import { ParseTag } from "../parser/baseClasses"
import { GenericTree } from "../tree/baseClasses"

export type SchemaAssetLegalContents = SchemaActionTag | SchemaBookmarkTag | SchemaComputedTag | SchemaConditionTag | SchemaExitTag | SchemaFeatureTag | SchemaImageTag | SchemaImportTag | SchemaMapTag | SchemaRoomTag | SchemaVariableTag | SchemaMessageTag | SchemaMomentTag
export type SchemaConditionLegalContents =  SchemaConditionTag | SchemaExitTag | SchemaFeatureTag | SchemaImageTag | SchemaMapTag | SchemaRoomTag

type SchemaBase = {
}

export type SchemaImportableBase = SchemaBase & {
    from?: string;
    as?: string;
}

export type SchemaConditionMixin = {
    conditions: {
        if: string;
        not?: boolean;
        dependencies?: string[];
    }[]
}

type SchemaAssetBase = {
    key: string;
    fileName?: string;
    zone?: string;
    subFolder?: string;
    player?: string;
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

export type SchemaFirstImpressionTag = {
    tag: 'FirstImpression';
    value: string;
} & SchemaBase

export type SchemaOneCoolThingTag = {
    tag: 'OneCoolThing';
    value: string;
} & SchemaBase

export type SchemaOutfitTag = {
    tag: 'Outfit';
    value: string;
} & SchemaBase

export const isSchemaLiteralTag = (item: SchemaTag): item is SchemaFirstImpressionTag | SchemaOneCoolThingTag | SchemaOutfitTag => (
    isSchemaFirstImpression(item) || isSchemaOneCoolThing(item) || isSchemaOutfit(item)
)
export type SchemaCharacterLegalContents = SchemaNameTag | SchemaPronounsTag | SchemaFirstImpressionTag | SchemaOneCoolThingTag | SchemaOutfitTag | SchemaImageTag | SchemaImportTag
export const isSchemaCharacterContents = (item: SchemaTag): item is SchemaCharacterLegalContents => (
    isSchemaName(item) || isSchemaPronouns(item) || isSchemaFirstImpression(item) || isSchemaOneCoolThing(item) || isSchemaOutfit(item) || isSchemaImage(item) || isSchemaImport(item)
)

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
} & SchemaBase

export type SchemaVariableTag = {
    tag: 'Variable';
    key: string;
    default?: string;
} & SchemaImportableBase

export type SchemaComputedTag = {
    tag: 'Computed';
    key: string;
    src: string;
    dependencies?: string[];
} & SchemaImportableBase

export type SchemaActionTag = {
    tag: 'Action';
    key: string;
    src: string;
} & SchemaImportableBase

export type SchemaImportMapping = {
    key: string;
    type: 'Room' | 'Feature' | 'Knowledge' | 'Variable' | 'Computed' | 'Action' | 'Map'
}

export const isSchemaImportMappingType = (value: string): value is SchemaImportMapping["type"] => (['Room', 'Feature', 'Knowledge', 'Variable', 'Computed', 'Action','Map'].includes(value))

export type SchemaImportTag = {
    tag: 'Import';
    key?: string;
    from: string;
    mapping: Record<string, SchemaImportMapping>;
} & SchemaBase

export type SchemaExportTag = {
    tag: 'Export';
    mapping: Record<string, SchemaImportMapping>
} & SchemaBase

export type SchemaConditionTag = {
    tag: 'If';
    key?: string;
} & SchemaBase & SchemaConditionMixin

export type SchemaExitTag = {
    tag: 'Exit';
    key: string;
    to: string;
    from: string;
} & SchemaBase

export type SchemaLinkTag = {
    tag: 'Link';
    to: string;
    text: string;
} & SchemaBase

export type SchemaTaggedMessageIncomingContents = SchemaStringTag | SchemaLinkTag | SchemaBookmarkTag | SchemaLineBreakTag | SchemaSpacerTag | SchemaConditionTag | SchemaWhitespaceTag | SchemaAfterTag | SchemaBeforeTag | SchemaReplaceTag
export type SchemaTaggedMessageLegalContents = SchemaStringTag | SchemaLinkTag | SchemaBookmarkTag | SchemaLineBreakTag | SchemaSpacerTag | SchemaConditionTag | SchemaAfterTag | SchemaBeforeTag | SchemaReplaceTag
export type SchemaOutputTag = SchemaStringTag | SchemaLinkTag | SchemaBookmarkTag | SchemaLineBreakTag | SchemaSpacerTag | SchemaConditionTag | SchemaAfterTag | SchemaBeforeTag | SchemaReplaceTag
export const isSchemaOutputTag = (tag: SchemaTag): tag is SchemaOutputTag => (
    isSchemaString(tag) ||
    isSchemaLink(tag) ||
    isSchemaBookmark(tag) ||
    isSchemaLineBreak(tag) ||
    isSchemaSpacer(tag) ||
    isSchemaCondition(tag) ||
    isSchemaAfter(tag) ||
    isSchemaBefore(tag) ||
    isSchemaReplace(tag)
)

export type SchemaDescriptionTag = {
    tag: 'Description';
} & SchemaBase

export type SchemaAfterTag = {
    tag: 'After';
} & SchemaBase

export type SchemaBeforeTag = {
    tag: 'Before';
} & SchemaBase

export type SchemaReplaceTag = {
    tag: 'Replace';
} & SchemaBase

export type SchemaBookmarkTag = {
    tag: 'Bookmark';
    key: string;
    display?: 'before' | 'after' | 'replace';
} & SchemaImportableBase

export type SchemaLineBreakTag = {
    tag: 'br';
} & SchemaBase

export type SchemaSpacerTag = {
    tag: 'Space';
} & SchemaBase

export type SchemaNameTag = {
    tag: 'Name';
} & SchemaBase

//
// TODO: Refactor room schema formation to keep name and description tags not folded into name
// and render properties
//
export type SchemaRoomLegalContents = SchemaDescriptionTag | SchemaExitTag | SchemaFeatureTag | SchemaConditionTag
export type SchemaRoomLegalIncomingContents = SchemaNameTag | SchemaDescriptionTag | SchemaExitTag | SchemaFeatureTag | SchemaConditionTag
export type SchemaRoomTag = {
    tag: 'Room';
    key: string;
    x?: number;
    y?: number;
} & SchemaImportableBase

export type SchemaFeatureLegalContents = SchemaDescriptionTag | SchemaNameTag | SchemaConditionTag
export type SchemaFeatureTag = {
    tag: 'Feature';
    key: string;
} & SchemaImportableBase

export type SchemaKnowledgeLegalContents = SchemaDescriptionTag | SchemaNameTag | SchemaConditionTag
export type SchemaKnowledgeTag = {
    tag: 'Knowledge';
    key: string;
} & SchemaImportableBase

export type SchemaMapLegalContents = SchemaExitTag | SchemaImageTag | SchemaRoomTag | SchemaConditionTag | SchemaNameTag

export type SchemaMapRoom = {
    key: string;
    x: number;
    y: number;
} & SchemaConditionMixin

export type SchemaPositionTag = {
    tag: 'Position';
    x: number;
    y: number;
}

export type SchemaMapTag = {
    tag: 'Map';
    key: string;
} & SchemaImportableBase

export type SchemaMessageTag = {
    tag: 'Message';
    key: string;
} & SchemaImportableBase

export type SchemaMomentTag = {
    tag: 'Moment';
    key: string;
} & SchemaImportableBase

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
    SchemaImportTag |
    SchemaExportTag |
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
    SchemaKnowledgeTag |
    SchemaPositionTag |
    SchemaMapTag |
    SchemaStringTag |
    SchemaWhitespaceTag |
    SchemaMessageTag |
    SchemaMomentTag |
    SchemaAfterTag |
    SchemaBeforeTag |
    SchemaReplaceTag

export type SchemaWithContents = SchemaAssetTag |
    SchemaStoryTag |
    SchemaConditionTag |
    SchemaRoomTag |
    SchemaFeatureTag |
    SchemaKnowledgeTag |
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
    SchemaMomentTag |
    SchemaAfterTag |
    SchemaBeforeTag |
    SchemaReplaceTag

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
export const isSchemaDescription = (value: SchemaTag): value is SchemaDescriptionTag => (value.tag === 'Description')
export const isSchemaAfter = (value: SchemaTag): value is SchemaAfterTag => (value.tag === 'After')
export const isSchemaBefore = (value: SchemaTag): value is SchemaBeforeTag => (value.tag === 'Before')
export const isSchemaReplace = (value: SchemaTag): value is SchemaReplaceTag => (value.tag === 'Replace')
export const isSchemaBookmark = (value: SchemaTag): value is SchemaBookmarkTag => (value.tag === 'Bookmark')
export const isSchemaExit = (value: SchemaTag): value is SchemaExitTag => (value.tag === 'Exit')
export const isSchemaFeature = (value: SchemaTag): value is SchemaFeatureTag => (value.tag === 'Feature')
export const isSchemaKnowledge = (value: SchemaTag): value is SchemaKnowledgeTag => (value.tag === 'Knowledge')
export const isSchemaRoom = (value: SchemaTag): value is SchemaRoomTag => (value.tag === 'Room')
export const isSchemaPosition = (value: SchemaTag): value is SchemaPositionTag => (value.tag === 'Position')
export const isSchemaMap = (value: SchemaTag): value is SchemaMapTag => (value.tag === 'Map')
export const isSchemaMessage = (value: SchemaTag): value is SchemaMessageTag => (value.tag === 'Message')
export const isSchemaMoment = (value: SchemaTag): value is SchemaMomentTag => (value.tag === 'Moment')
export const isSchemaAssetContents = (value: SchemaTag): value is SchemaAssetLegalContents => (isSchemaAction(value) || isSchemaBookmark(value) || isSchemaComputed(value) || isSchemaCondition(value) || isSchemaExit(value) || isSchemaFeature(value) || isSchemaKnowledge(value) || isSchemaImage(value) || isSchemaImport(value) || isSchemaExport(value) || isSchemaMap(value) || isSchemaRoom(value) || isSchemaVariable(value) || isSchemaMessage(value) || isSchemaMoment(value))
export const isSchemaFeatureContents = (value: SchemaTag): value is SchemaFeatureLegalContents => (value.tag === 'Description' || isSchemaCondition(value))
export const isSchemaKnowledgeContents = (value: SchemaTag): value is SchemaKnowledgeLegalContents => (value.tag === 'Description' || isSchemaCondition(value))
export const isSchemaFeatureIncomingContents = (value: SchemaTag): value is SchemaFeatureLegalContents => (value.tag === 'Description' || isSchemaCondition(value) || isSchemaName(value))
export const isSchemaKnowledgeIncomingContents = (value: SchemaTag): value is SchemaKnowledgeLegalContents => (value.tag === 'Description' || isSchemaCondition(value) || isSchemaName(value))
export const isSchemaRoomContents = (value: SchemaTag): value is SchemaRoomLegalContents => (['Image', 'Exit', 'Feature', 'Description', 'If'].includes(value.tag))
export const isSchemaRoomIncomingContents = (value: SchemaTag): value is SchemaRoomLegalIncomingContents => (['Name', 'Image', 'Exit', 'Feature', 'Description', 'If'].includes(value.tag))
export const isSchemaMapContents = (value: SchemaTag): value is SchemaMapLegalContents => (['Image', 'Exit', 'Room', 'If', 'Name'].includes(value.tag))

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
export const isSchemaExport = (value: SchemaTag): value is SchemaExportTag => (value.tag === 'Export')

export const isSchemaCharacter = (value: SchemaTag): value is SchemaCharacterTag => (value.tag === 'Character')
export const isSchemaAsset = (value: SchemaTag): value is SchemaAssetTag => (value.tag === 'Asset')

export const isSchemaWithContents = (value: SchemaTag): value is SchemaWithContents => (
    ['Asset', 'Story', 'If', 'Room', 'Feature', 'Bookmark', 'Knowledge', 'Description', 'Exit', 'Character', 'Map', 'Message', 'Moment', 'Name', 'FirstImpression', 'OneCoolThing', 'Outfit'].includes(value.tag)
)

export const isImportable = (value: SchemaTag): value is SchemaRoomTag | SchemaFeatureTag | SchemaBookmarkTag | SchemaKnowledgeTag | SchemaMapTag | SchemaMessageTag | SchemaMomentTag | SchemaActionTag | SchemaComputedTag | SchemaVariableTag => (
    ['Room', 'Feature', 'Bookmark', 'Knowledge', 'Map', 'Message', 'Moment', 'Action', 'Computed', 'Variable'].includes(value.tag)
)
export const isImportableTag = (tag: string): boolean => (
    ['Room', 'Feature', 'Bookmark', 'Knowledge', 'Map', 'Message', 'Moment', 'Action', 'Computed', 'Variable'].includes(tag)
)

export type SchemaWithKey = SchemaAssetTag | SchemaStoryTag | SchemaRoomTag | SchemaFeatureTag | SchemaKnowledgeTag | SchemaBookmarkTag | SchemaCharacterTag | SchemaMapTag | SchemaImageTag | SchemaActionTag | SchemaVariableTag | SchemaComputedTag | SchemaExitTag | SchemaMessageTag | SchemaMomentTag
export const isSchemaWithKey = (value: SchemaTag): value is SchemaWithKey => (
    ['Asset', 'Story', 'Room', 'Feature', 'Knowledge', 'Bookmark', 'Character', 'Map', 'Image', 'Action', 'Variable', 'Computed', 'Exit', 'Message', 'Moment'].includes(value.tag)
)

export const isSchemaTaggedMessageLegalContents = (value: SchemaTag): value is SchemaTaggedMessageLegalContents => (
    ['String', 'Link', 'Bookmark', 'Space', 'br', 'If', 'After', 'Before', 'Replace'].includes(value.tag)
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
            'Knowledge',
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

export type SchemaContextItem = {
    tag: SchemaTag;
    children: GenericTree<SchemaTag>;
}
