import { GenericTree } from "../tree/baseClasses"

export type SchemaAssetLegalContents = SchemaActionTag | SchemaBookmarkTag | SchemaComputedTag | SchemaConditionTag | SchemaExitTag | SchemaFeatureTag | SchemaImageTag | SchemaImportTag | SchemaMetaTag | SchemaMapTag | SchemaRoomTag | SchemaVariableTag | SchemaMessageTag | SchemaMomentTag
export type SchemaConditionLegalContents =  SchemaConditionTag | SchemaExitTag | SchemaFeatureTag | SchemaImageTag | SchemaMapTag | SchemaRoomTag

type SchemaBase = {
}

type SchemaWrapper = {
    wrapperKey?: string;
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
    update?: boolean;
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
} & SchemaImportableBase

export type SchemaPronouns = {
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
export type SchemaCharacterLegalContents = SchemaNameTag | SchemaPronounsTag | SchemaFirstImpressionTag | SchemaOneCoolThingTag | SchemaOutfitTag | SchemaImageTag | SchemaImportTag | SchemaMetaTag
export const isSchemaCharacterContents = (item: SchemaTag): item is SchemaCharacterLegalContents => (
    isSchemaName(item) || isSchemaPronouns(item) || isSchemaFirstImpression(item) || isSchemaOneCoolThing(item) || isSchemaOutfit(item) || isSchemaImage(item) || isSchemaImport(item) || isSchemaMeta(item)
)

export type SchemaCharacterTag = {
    tag: 'Character';
    key: string;
    Pronouns: SchemaPronouns;
    update?: boolean;
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
    type: 'Room' | 'Feature' | 'Knowledge' | 'Variable' | 'Computed' | 'Action' | 'Map' | 'Moment'
}

export const isSchemaImportMappingType = (value: string): value is SchemaImportMapping["type"] => (['Room', 'Feature', 'Knowledge', 'Variable', 'Computed', 'Action','Map', 'Moment'].includes(value))

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

export type SchemaMetaTag = {
    tag: 'Meta';
    key: string;
    time: number;
} & SchemaBase

export type SchemaInheritedTag = {
    tag: 'Inherited';
} & SchemaBase

export type SchemaSelectedTag = {
    tag: 'Selected';
} & SchemaBase

export type SchemaConditionTag = {
    tag: 'If';
} & SchemaWrapper & SchemaBase

export type SchemaConditionStatementTag = {
    tag: 'Statement';
    if: string;
    selected?: boolean;
    dependencies?: string[]
} & SchemaBase

export type SchemaConditionFallthroughTag = {
    tag: 'Fallthrough';
    selected?: boolean;
} & SchemaBase

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

export type SchemaTaggedMessageIncomingContents = SchemaStringTag | SchemaLinkTag | SchemaBookmarkTag | SchemaLineBreakTag | SchemaSpacerTag | SchemaConditionTag | SchemaConditionStatementTag | SchemaConditionFallthroughTag | SchemaWhitespaceTag | SchemaReplaceTag
export type SchemaTaggedMessageLegalContents = SchemaStringTag | SchemaLinkTag | SchemaBookmarkTag | SchemaLineBreakTag | SchemaSpacerTag | SchemaConditionTag | SchemaConditionStatementTag | SchemaConditionFallthroughTag | SchemaReplaceTag | SchemaInheritedTag | SchemaSelectedTag
export type SchemaOutputTag = SchemaStringTag | SchemaLinkTag | SchemaBookmarkTag | SchemaLineBreakTag | SchemaSpacerTag | SchemaConditionTag | SchemaConditionStatementTag | SchemaConditionFallthroughTag | SchemaReplaceTag | SchemaInheritedTag | SchemaSelectedTag
export const isSchemaOutputTag = (tag: SchemaTag): tag is SchemaOutputTag => (
    isSchemaString(tag) ||
    isSchemaLink(tag) ||
    isSchemaBookmark(tag) ||
    isSchemaLineBreak(tag) ||
    isSchemaSpacer(tag) ||
    isSchemaCondition(tag) ||
    isSchemaConditionStatement(tag) ||
    isSchemaConditionFallthrough(tag) ||
    isSchemaReplace(tag) ||
    isSchemaInherited(tag) ||
    isSchemaSelected(tag)
)

export type SchemaDescriptionTag = {
    tag: 'Description';
} & SchemaBase

export type SchemaSummaryTag = {
    tag: 'Summary';
} & SchemaBase

export type SchemaReplaceTag = {
    tag: 'Replace';
} & SchemaWrapper & SchemaBase

export type SchemaReplaceMatchTag = {
    tag: 'ReplaceMatch';
} & SchemaBase

export type SchemaReplacePayloadTag = {
    tag: 'ReplacePayload';
} & SchemaBase

export type SchemaRemoveTag = {
    tag: 'Remove';
} & SchemaBase

export type SchemaBookmarkTag = {
    tag: 'Bookmark';
    key: string;
    display?: 'replace';
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

export type SchemaShortNameTag = {
    tag: 'ShortName';
} & SchemaBase

export type SchemaRoomTag = {
    tag: 'Room';
    key: string;
    x?: number;
    y?: number;
} & SchemaImportableBase

export type SchemaFeatureTag = {
    tag: 'Feature';
    key: string;
} & SchemaImportableBase

export type SchemaKnowledgeTag = {
    tag: 'Knowledge';
    key: string;
} & SchemaImportableBase

export type SchemaThemeTag = {
    tag: 'Theme';
    key: string;
} & SchemaImportableBase

export type SchemaPromptTag = {
    tag: 'Prompt';
    value: string;
} & SchemaBase

export type SchemaMapLegalContents = SchemaExitTag | SchemaImageTag | SchemaRoomTag | SchemaConditionTag | SchemaNameTag | SchemaThemeTag

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
    SchemaMetaTag |
    SchemaInheritedTag |
    SchemaSelectedTag |
    SchemaConditionTag |
    SchemaConditionStatementTag |
    SchemaConditionFallthroughTag |
    SchemaExitTag |
    SchemaDescriptionTag |
    SchemaSummaryTag |
    SchemaLineBreakTag |
    SchemaSpacerTag |
    SchemaLinkTag |
    SchemaBookmarkTag |
    SchemaShortNameTag |
    SchemaNameTag |
    SchemaRoomTag |
    SchemaFeatureTag |
    SchemaKnowledgeTag |
    SchemaPositionTag |
    SchemaThemeTag |
    SchemaPromptTag |
    SchemaMapTag |
    SchemaStringTag |
    SchemaWhitespaceTag |
    SchemaMessageTag |
    SchemaMomentTag |
    SchemaReplaceTag |
    SchemaReplaceMatchTag |
    SchemaReplacePayloadTag |
    SchemaRemoveTag

export type SchemaWithContents = SchemaAssetTag |
    SchemaStoryTag |
    SchemaConditionTag |
    SchemaConditionStatementTag |
    SchemaConditionFallthroughTag |
    SchemaRoomTag |
    SchemaThemeTag |
    SchemaPromptTag |
    SchemaFeatureTag |
    SchemaKnowledgeTag |
    SchemaDescriptionTag |
    SchemaSummaryTag |
    SchemaBookmarkTag |
    SchemaExitTag |
    SchemaCharacterTag |
    SchemaMapTag |
    SchemaShortNameTag |
    SchemaNameTag |
    SchemaFirstImpressionTag |
    SchemaOneCoolThingTag |
    SchemaOutfitTag |
    SchemaMessageTag |
    SchemaMomentTag |
    SchemaReplaceTag |
    SchemaReplaceMatchTag |
    SchemaReplacePayloadTag |
    SchemaRemoveTag |
    SchemaInheritedTag

export const isSchemaName = (value: SchemaTag): value is SchemaNameTag => (value.tag === 'Name')
export const isSchemaShortName = (value: SchemaTag): value is SchemaShortNameTag => (value.tag === 'ShortName')
export const isSchemaString = (value: SchemaTag): value is SchemaStringTag => (value.tag === 'String')
export const isSchemaDescription = (value: SchemaTag): value is SchemaDescriptionTag => (value.tag === 'Description')
export const isSchemaSummary = (value: SchemaTag): value is SchemaSummaryTag => (value.tag === 'Summary')
export const isSchemaReplace = (value: SchemaTag): value is SchemaReplaceTag => (value.tag === 'Replace')
export const isSchemaReplaceMatch = (value: SchemaTag): value is SchemaReplaceMatchTag => (value.tag === 'ReplaceMatch')
export const isSchemaReplacePayload = (value: SchemaTag): value is SchemaReplacePayloadTag => (value.tag === 'ReplacePayload')
export const isSchemaRemove = (value: SchemaTag): value is SchemaRemoveTag => (value.tag === 'Remove')
export const isSchemaEdit = (value: SchemaTag): value is SchemaRemoveTag | SchemaReplaceTag | SchemaReplaceMatchTag | SchemaReplacePayloadTag => (['Remove', 'Replace', 'ReplaceMatch', 'ReplacePayload'].includes(value.tag))
export const isSchemaBookmark = (value: SchemaTag): value is SchemaBookmarkTag => (value.tag === 'Bookmark')
export const isSchemaExit = (value: SchemaTag): value is SchemaExitTag => (value.tag === 'Exit')
export const isSchemaFeature = (value: SchemaTag): value is SchemaFeatureTag => (value.tag === 'Feature')
export const isSchemaKnowledge = (value: SchemaTag): value is SchemaKnowledgeTag => (value.tag === 'Knowledge')
export const isSchemaRoom = (value: SchemaTag): value is SchemaRoomTag => (value.tag === 'Room')
export const isSchemaPosition = (value: SchemaTag): value is SchemaPositionTag => (value.tag === 'Position')
export const isSchemaTheme = (value: SchemaTag): value is SchemaThemeTag => (value.tag === 'Theme')
export const isSchemaPrompt = (value: SchemaTag): value is SchemaPromptTag => (value.tag === 'Prompt')
export const isSchemaMap = (value: SchemaTag): value is SchemaMapTag => (value.tag === 'Map')
export const isSchemaMessage = (value: SchemaTag): value is SchemaMessageTag => (value.tag === 'Message')
export const isSchemaMoment = (value: SchemaTag): value is SchemaMomentTag => (value.tag === 'Moment')
export const isSchemaAssetContents = (value: SchemaTag): value is SchemaAssetLegalContents => (isSchemaAction(value) || isSchemaBookmark(value) || isSchemaComputed(value) || isSchemaCondition(value) || isSchemaExit(value) || isSchemaFeature(value) || isSchemaKnowledge(value) || isSchemaImage(value) || isSchemaImport(value) || isSchemaExport(value) || isSchemaMeta(value) || isSchemaMap(value) || isSchemaRoom(value) || isSchemaTheme(value) || isSchemaVariable(value) || isSchemaMessage(value) || isSchemaMoment(value) || isSchemaInherited(value) || isSchemaSelected(value) || isSchemaRemove(value) || isSchemaReplace(value))
export const isSchemaMapContents = (value: SchemaTag): value is SchemaMapLegalContents => (['Image', 'Exit', 'Room', 'If', 'Name', 'Theme'].includes(value.tag))

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
export const isSchemaConditionStatement = (value: SchemaTag): value is SchemaConditionStatementTag => (value.tag === 'Statement')
export const isSchemaConditionFallthrough = (value: SchemaTag): value is SchemaConditionFallthroughTag => (value.tag === 'Fallthrough')

export const isSchemaAction = (value: SchemaTag): value is SchemaActionTag => (value.tag === 'Action')
export const isSchemaVariable = (value: SchemaTag): value is SchemaVariableTag => (value.tag === 'Variable')
export const isSchemaComputed = (value: SchemaTag): value is SchemaComputedTag => (value.tag === 'Computed')

export const isSchemaImport = (value: SchemaTag): value is SchemaImportTag => (value.tag === 'Import')
export const isSchemaExport = (value: SchemaTag): value is SchemaExportTag => (value.tag === 'Export')
export const isSchemaMeta = (value: SchemaTag): value is SchemaMetaTag => (value.tag === 'Meta')
export const isSchemaInherited = (value: SchemaTag): value is SchemaInheritedTag => (value.tag === 'Inherited')
export const isSchemaSelected = (value: SchemaTag): value is SchemaSelectedTag => (value.tag === 'Selected')

export const isSchemaCharacter = (value: SchemaTag): value is SchemaCharacterTag => (value.tag === 'Character')
export const isSchemaAsset = (value: SchemaTag): value is SchemaAssetTag => (value.tag === 'Asset')

export const isSchemaWithContents = (value: SchemaTag): value is SchemaWithContents => (
    ['Asset', 'Story', 'If', 'Room', 'Theme', 'Prompt', 'Feature', 'Bookmark', 'Knowledge', 'Description', 'Summary', 'Exit', 'Character', 'Map', 'Message', 'Moment', 'Name', 'ShortName', 'FirstImpression', 'OneCoolThing', 'Outfit', 'Replace', 'ReplaceMatch', 'ReplacePayload', 'Inherited'].includes(value.tag)
)

export const isImportable = (value: SchemaTag): value is SchemaRoomTag | SchemaFeatureTag | SchemaBookmarkTag | SchemaKnowledgeTag | SchemaMapTag | SchemaMessageTag | SchemaMomentTag | SchemaActionTag | SchemaComputedTag | SchemaVariableTag => (
    ['Room', 'Theme', 'Feature', 'Bookmark', 'Knowledge', 'Map', 'Message', 'Moment', 'Action', 'Computed', 'Variable'].includes(value.tag)
)
export const isImportableTag = (tag: string): boolean => (
    ['Room', 'Theme', 'Feature', 'Bookmark', 'Knowledge', 'Map', 'Message', 'Moment', 'Action', 'Computed', 'Variable'].includes(tag)
)

export type SchemaWithKey = SchemaAssetTag | SchemaStoryTag | SchemaRoomTag | SchemaFeatureTag | SchemaKnowledgeTag | SchemaBookmarkTag | SchemaCharacterTag | SchemaMapTag | SchemaThemeTag | SchemaImageTag | SchemaActionTag | SchemaVariableTag | SchemaComputedTag | SchemaMessageTag | SchemaMomentTag
export const isSchemaWithKey = (value: SchemaTag): value is SchemaWithKey => (
    ['Asset', 'Story', 'Room', 'Theme', 'Feature', 'Knowledge', 'Bookmark', 'Character', 'Map', 'Image', 'Action', 'Variable', 'Computed', 'Message', 'Moment'].includes(value.tag)
)

export const isSchemaTaggedMessageLegalContents = (value: SchemaTag): value is SchemaTaggedMessageLegalContents => (
    ['String', 'Link', 'Bookmark', 'Space', 'br', 'If', 'Statement', 'Fallthrough', 'Inherited'].includes(value.tag)
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
            'Export',
            'Inherited',
            'If',
            'Exit',
            'Description',
            'br',
            'Spacer',
            'Link',
            'Name',
            'Room',
            'Theme',
            'Prompt',
            'Feature',
            'Knowledge',
            'Bookmark',
            'Message',
            'Moment',
            'Map',
            'String',
            'Whitespace',
            'Replace']
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

export type SchemaToWMLTopLevelOptions = {
    persistentOnly?: boolean
}
