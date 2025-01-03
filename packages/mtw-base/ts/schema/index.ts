import { SchemaAssetTag, SchemaStoryTag } from "./asset"
import { SchemaBase, SchemaImportableBase } from "./baseClasses"
import { SchemaCharacterTag, SchemaFirstImpressionTag, SchemaOneCoolThingTag, SchemaOutfitTag, SchemaPronounsTag } from "./character"
import { SchemaFeatureTag, SchemaKnowledgeTag, SchemaMapTag, SchemaMessageTag, SchemaMomentTag, SchemaPositionTag, SchemaRoomTag, SchemaShortNameTag } from "./components"
import { SchemaActionTag, SchemaComputedTag, SchemaVariableTag } from "./computation"
import { SchemaConditionFallthroughTag, SchemaConditionStatementTag, SchemaConditionTag, SchemaSelectedTag } from "./condition"
import { SchemaEditTag, SchemaRemoveTag, SchemaReplaceMatchTag, SchemaReplacePayloadTag, SchemaReplaceTag } from "./edit"
import { SchemaDescriptionTag, SchemaExampleTag, SchemaNameTag, SchemaSummaryTag } from "./example"
import { SchemaImageTag } from "./image"
import { SchemaExportTag, SchemaImportTag, SchemaMetaTag } from "./metaData"
import { isSchemaLineBreak, isSchemaLink, isSchemaSpacer, isSchemaString, SchemaLineBreakTag, SchemaLinkTag, SchemaSpacerTag, SchemaStringTag, SchemaWhitespaceTag } from "./renderTree"

export type SchemaAssetLegalContents = SchemaCharacterTag | SchemaActionTag | SchemaBookmarkTag | SchemaComputedTag | SchemaConditionTag | SchemaExitTag | SchemaFeatureTag | SchemaImageTag | SchemaImportTag | SchemaMetaTag | SchemaMapTag | SchemaRoomTag | SchemaVariableTag | SchemaMessageTag | SchemaMomentTag
export type SchemaConditionLegalContents =  SchemaConditionTag | SchemaExitTag | SchemaFeatureTag | SchemaImageTag | SchemaMapTag | SchemaRoomTag
export type SchemaCharacterLegalContents = SchemaNameTag | SchemaPronounsTag | SchemaFirstImpressionTag | SchemaOneCoolThingTag | SchemaOutfitTag | SchemaImageTag | SchemaImportTag | SchemaMetaTag

export const isSchemaLiteralTag = (item: SchemaTag): item is SchemaFirstImpressionTag | SchemaOneCoolThingTag | SchemaOutfitTag => (
    isSchemaFirstImpression(item) || isSchemaOneCoolThing(item) || isSchemaOutfit(item)
)
export const isSchemaCharacterContents = (item: SchemaTag): item is SchemaCharacterLegalContents => (
    isSchemaName(item) || isSchemaPronouns(item) || isSchemaFirstImpression(item) || isSchemaOneCoolThing(item) || isSchemaOutfit(item) || isSchemaImage(item) || isSchemaImport(item) || isSchemaMeta(item)
)

export type SchemaExitTag = {
    tag: 'Exit';
    key: string;
    to: string;
    from: string;
} & SchemaBase

export type SchemaTaggedMessageIncomingContents = SchemaEditTag | SchemaStringTag | SchemaLinkTag | SchemaBookmarkTag | SchemaLineBreakTag | SchemaSpacerTag | SchemaConditionTag | SchemaConditionStatementTag | SchemaConditionFallthroughTag | SchemaWhitespaceTag | SchemaReplaceTag
export type SchemaTaggedMessageLegalContents = SchemaEditTag | SchemaStringTag | SchemaLinkTag | SchemaBookmarkTag | SchemaLineBreakTag | SchemaSpacerTag | SchemaConditionTag | SchemaConditionStatementTag | SchemaConditionFallthroughTag | SchemaReplaceTag | SchemaSelectedTag
export type SchemaOutputTag = SchemaStringTag | SchemaLinkTag | SchemaBookmarkTag | SchemaLineBreakTag | SchemaSpacerTag | SchemaConditionTag | SchemaConditionStatementTag | SchemaConditionFallthroughTag | SchemaEditTag | SchemaSelectedTag
export const isSchemaOutputTag = (tag: any): tag is SchemaOutputTag => (
    isSchemaString(tag) ||
    isSchemaLink(tag) ||
    isSchemaBookmark(tag) ||
    isSchemaLineBreak(tag) ||
    isSchemaSpacer(tag) ||
    isSchemaCondition(tag) ||
    isSchemaConditionStatement(tag) ||
    isSchemaConditionFallthrough(tag) ||
    isSchemaRemove(tag) ||
    isSchemaReplace(tag) ||
    isSchemaReplaceMatch(tag) ||
    isSchemaReplacePayload(tag) ||
    isSchemaSelected(tag)
)

export type SchemaBookmarkTag = {
    tag: 'Bookmark';
    key: string;
    display?: 'replace';
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
    SchemaExampleTag |
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
    SchemaEditTag

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
    SchemaExampleTag |
    SchemaFirstImpressionTag |
    SchemaOneCoolThingTag |
    SchemaOutfitTag |
    SchemaMessageTag |
    SchemaMomentTag |
    SchemaEditTag

export const isSchemaName = (value: SchemaTag): value is SchemaNameTag => (value.tag === 'Name')
export const isSchemaShortName = (value: SchemaTag): value is SchemaShortNameTag => (value.tag === 'ShortName')
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
export const isSchemaExample = (value: SchemaTag): value is SchemaExampleTag => (value.tag === 'Example')
export const isSchemaPosition = (value: SchemaTag): value is SchemaPositionTag => (value.tag === 'Position')
export const isSchemaTheme = (value: SchemaTag): value is SchemaThemeTag => (value.tag === 'Theme')
export const isSchemaPrompt = (value: SchemaTag): value is SchemaPromptTag => (value.tag === 'Prompt')
export const isSchemaMap = (value: SchemaTag): value is SchemaMapTag => (value.tag === 'Map')
export const isSchemaMessage = (value: SchemaTag): value is SchemaMessageTag => (value.tag === 'Message')
export const isSchemaMoment = (value: SchemaTag): value is SchemaMomentTag => (value.tag === 'Moment')
export const isSchemaAssetContents = (value: SchemaTag): value is SchemaAssetLegalContents => (isSchemaCharacter(value) || isSchemaAction(value) || isSchemaBookmark(value) || isSchemaComputed(value) || isSchemaCondition(value) || isSchemaExit(value) || isSchemaFeature(value) || isSchemaKnowledge(value) || isSchemaImage(value) || isSchemaImport(value) || isSchemaExport(value) || isSchemaMeta(value) || isSchemaMap(value) || isSchemaRoom(value) || isSchemaTheme(value) || isSchemaVariable(value) || isSchemaMessage(value) || isSchemaMoment(value) || isSchemaSelected(value) || isSchemaRemove(value) || isSchemaReplace(value))
export const isSchemaMapContents = (value: SchemaTag): value is SchemaMapLegalContents => (['Image', 'Exit', 'Room', 'If', 'Name', 'Theme'].includes(value.tag))

export const isSchemaFirstImpression = (value: SchemaTag): value is SchemaFirstImpressionTag => (value.tag === 'FirstImpression')
export const isSchemaOneCoolThing = (value: SchemaTag): value is SchemaOneCoolThingTag => (value.tag === 'OneCoolThing')
export const isSchemaPronouns = (value: SchemaTag): value is SchemaPronounsTag => (value.tag === 'Pronouns')
export const isSchemaOutfit = (value: SchemaTag): value is SchemaOutfitTag => (value.tag === 'Outfit')
export const isSchemaImage = (value: SchemaTag): value is SchemaImageTag => (value.tag === 'Image')

export const isSchemaCondition = (arg: any): arg is SchemaConditionTag => (
    typeof arg === 'object' &&
    'tag' in arg &&
    arg.tag === 'If' &&
    (!arg.wrapperTag || typeof arg.wrapperTag === 'string')
)
export const isSchemaConditionStatement = (arg: any): arg is SchemaConditionStatementTag => (
    typeof arg === 'object' &&
    'tag' in arg &&
    arg.tag === 'Statement' &&
    'if' in arg &&
    typeof arg.if === 'string' &&
    (!arg.selected || typeof arg.selected === 'boolean') &&
    (!arg.dependencies || (Array.isArray(arg.dependencies) && arg.dependencies.every((entry) => (typeof entry === 'string'))))
)
export const isSchemaConditionFallthrough = (arg: any): arg is SchemaConditionFallthroughTag => (
    typeof arg === 'object' &&
    'tag' in arg &&
    arg.tag === 'Fallthrough' &&
    (!arg.selected || typeof arg.selected === 'boolean')
)

export const isSchemaAction = (value: SchemaTag): value is SchemaActionTag => (value.tag === 'Action')
export const isSchemaVariable = (value: SchemaTag): value is SchemaVariableTag => (value.tag === 'Variable')
export const isSchemaComputed = (value: SchemaTag): value is SchemaComputedTag => (value.tag === 'Computed')

export const isSchemaImport = (value: SchemaTag): value is SchemaImportTag => (value.tag === 'Import')
export const isSchemaExport = (value: SchemaTag): value is SchemaExportTag => (value.tag === 'Export')
export const isSchemaMeta = (value: SchemaTag): value is SchemaMetaTag => (value.tag === 'Meta')
export const isSchemaSelected = (value: SchemaTag): value is SchemaSelectedTag => (value.tag === 'Selected')

export const isSchemaCharacter = (value: SchemaTag): value is SchemaCharacterTag => (value.tag === 'Character')
export const isSchemaAsset = (value: SchemaTag): value is SchemaAssetTag => (value.tag === 'Asset')

export const isSchemaWithContents = (value: SchemaTag): value is SchemaWithContents => (
    ['Asset', 'Story', 'If', 'Example', 'Room', 'Theme', 'Prompt', 'Feature', 'Bookmark', 'Knowledge', 'Description', 'Summary', 'Exit', 'Character', 'Map', 'Message', 'Moment', 'Name', 'ShortName', 'FirstImpression', 'OneCoolThing', 'Outfit', 'Replace', 'ReplaceMatch', 'ReplacePayload'].includes(value.tag)
)

export const isImportable = (value: SchemaTag): value is SchemaRoomTag | SchemaFeatureTag | SchemaBookmarkTag | SchemaKnowledgeTag | SchemaMapTag | SchemaMessageTag | SchemaMomentTag | SchemaActionTag | SchemaComputedTag | SchemaVariableTag => (
    ['Example', 'Room', 'Theme', 'Feature', 'Bookmark', 'Knowledge', 'Map', 'Message', 'Moment', 'Action', 'Computed', 'Variable'].includes(value?.tag)
)
export const isImportableTag = (tag: string): boolean => (
    ['Example', 'Room', 'Theme', 'Feature', 'Bookmark', 'Knowledge', 'Map', 'Message', 'Moment', 'Action', 'Computed', 'Variable'].includes(tag)
)

export type SchemaWithKey = SchemaAssetTag | SchemaStoryTag | SchemaExampleTag | SchemaRoomTag | SchemaFeatureTag | SchemaKnowledgeTag | SchemaBookmarkTag | SchemaCharacterTag | SchemaMapTag | SchemaThemeTag | SchemaImageTag | SchemaActionTag | SchemaVariableTag | SchemaComputedTag | SchemaMessageTag | SchemaMomentTag
export const isSchemaWithKey = (value: SchemaTag): value is SchemaWithKey => (
    ['Asset', 'Story', 'Example', 'Room', 'Theme', 'Feature', 'Knowledge', 'Bookmark', 'Character', 'Map', 'Image', 'Action', 'Variable', 'Computed', 'Message', 'Moment'].includes(value.tag)
)

export const isSchemaTaggedMessageLegalContents = (value: SchemaTag): value is SchemaTaggedMessageLegalContents => (
    ['Remove', 'Replace', 'ReplaceMatch', 'ReplacePayload', 'String', 'Link', 'Bookmark', 'Space', 'br', 'If', 'Statement', 'Fallthrough'].includes(value.tag)
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
            'If',
            'Exit',
            'Description',
            'br',
            'Spacer',
            'Link',
            'Name',
            'Example',
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

export type SchemaToWMLTopLevelOptions = {
    persistentOnly?: boolean
}
