import { SchemaAssetTag, SchemaStoryTag } from "./asset"
import { SchemaBase, SchemaImportableBase } from "./baseClasses"
import { isSchemaFirstImpression, isSchemaOneCoolThing, isSchemaOutfit, isSchemaPronouns, SchemaCharacterLegalContents, SchemaCharacterTag, SchemaFirstImpressionTag, SchemaOneCoolThingTag, SchemaOutfitTag, SchemaPronounsTag } from "./character"
import { isSchemaExit, isSchemaFeature, isSchemaKnowledge, isSchemaMap, isSchemaMessage, isSchemaMoment, isSchemaPosition, isSchemaRoom, isSchemaShortName, SchemaExitTag, SchemaFeatureTag, SchemaKnowledgeTag, SchemaMapTag, SchemaMessageTag, SchemaMomentTag, SchemaPositionTag, SchemaRoomTag, SchemaShortNameTag } from "./components"
import { isSchemaAction, isSchemaComputed, isSchemaVariable, SchemaActionTag, SchemaComputedTag, SchemaVariableTag } from "./computation"
import { isSchemaCondition, isSchemaConditionFallthrough, isSchemaConditionStatement, isSchemaSelected, SchemaConditionFallthroughTag, SchemaConditionStatementTag, SchemaConditionTag, SchemaSelectedTag } from "./condition"
import { isSchemaEdit, isSchemaRemove, isSchemaReplace, isSchemaReplaceMatch, isSchemaReplacePayload, SchemaEditTag, SchemaReplaceTag } from "./edit"
import { isSchemaDescription, isSchemaExample, isSchemaName, isSchemaSummary, SchemaDescriptionTag, SchemaExampleTag, SchemaNameTag, SchemaSummaryTag } from "./example"
import { isSchemaImage, SchemaImageTag } from "./image"
import { isSchemaExport, isSchemaImport, isSchemaMeta, SchemaExportTag, SchemaImportTag, SchemaMetaTag } from "./metaData"
import { isSchemaLineBreak, isSchemaLink, isSchemaSpacer, isSchemaString, SchemaLineBreakTag, SchemaLinkTag, SchemaSpacerTag, SchemaStringTag, SchemaWhitespaceTag } from "./renderTree"

export type SchemaAssetLegalContents = SchemaCharacterTag | SchemaActionTag | SchemaBookmarkTag | SchemaComputedTag | SchemaConditionTag | SchemaExitTag | SchemaFeatureTag | SchemaImageTag | SchemaImportTag | SchemaMetaTag | SchemaMapTag | SchemaRoomTag | SchemaVariableTag | SchemaMessageTag | SchemaMomentTag
export type SchemaConditionLegalContents =  SchemaConditionTag | SchemaExitTag | SchemaFeatureTag | SchemaImageTag | SchemaMapTag | SchemaRoomTag

export const isSchemaLiteralTag = (item: SchemaTag): item is SchemaFirstImpressionTag | SchemaOneCoolThingTag | SchemaOutfitTag => (
    isSchemaFirstImpression(item) || isSchemaOneCoolThing(item) || isSchemaOutfit(item)
)
export const isSchemaCharacterContents = (item: SchemaTag): item is SchemaCharacterLegalContents => (
    isSchemaName(item) || isSchemaPronouns(item) || isSchemaFirstImpression(item) || isSchemaOneCoolThing(item) || isSchemaOutfit(item) || isSchemaImage(item) || isSchemaImport(item) || isSchemaMeta(item)
)

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

export const isSchemaBookmark = (value: SchemaTag): value is SchemaBookmarkTag => (value.tag === 'Bookmark')
export const isSchemaTheme = (value: SchemaTag): value is SchemaThemeTag => (value.tag === 'Theme')
export const isSchemaPrompt = (value: SchemaTag): value is SchemaPromptTag => (value.tag === 'Prompt')
export const isSchemaAssetContents = (value: SchemaTag): value is SchemaAssetLegalContents => (isSchemaCharacter(value) || isSchemaAction(value) || isSchemaBookmark(value) || isSchemaComputed(value) || isSchemaCondition(value) || isSchemaExit(value) || isSchemaFeature(value) || isSchemaKnowledge(value) || isSchemaImage(value) || isSchemaImport(value) || isSchemaExport(value) || isSchemaMeta(value) || isSchemaMap(value) || isSchemaRoom(value) || isSchemaTheme(value) || isSchemaVariable(value) || isSchemaMessage(value) || isSchemaMoment(value) || isSchemaSelected(value) || isSchemaRemove(value) || isSchemaReplace(value))
export const isSchemaMapContents = (value: SchemaTag): value is SchemaMapLegalContents => (['Image', 'Exit', 'Room', 'If', 'Name', 'Theme'].includes(value.tag))

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
    return isSchemaAsset(value) ||
        isSchemaFirstImpression(value) ||
        isSchemaPronouns(value) ||
        isSchemaOneCoolThing(value) ||
        isSchemaOutfit(value) ||
        isSchemaCharacter(value) ||
        isSchemaImage(value) ||
        isSchemaVariable(value) ||
        isSchemaComputed(value) ||
        isSchemaAction(value) ||
        isSchemaImport(value) ||
        isSchemaExport(value) ||
        isSchemaMeta(value) ||
        isSchemaSelected(value) ||
        isSchemaCondition(value) ||
        isSchemaConditionStatement(value) ||
        isSchemaConditionFallthrough(value) ||
        isSchemaExit(value) ||
        isSchemaDescription(value) ||
        isSchemaSummary(value) ||
        isSchemaLineBreak(value) ||
        isSchemaSpacer(value) ||
        isSchemaLink(value) ||
        isSchemaBookmark(value) ||
        isSchemaShortName(value) ||
        isSchemaName(value) ||
        isSchemaExample(value) ||
        isSchemaRoom(value) ||
        isSchemaFeature(value) ||
        isSchemaKnowledge(value) ||
        isSchemaPosition(value) ||
        isSchemaTheme(value) ||
        isSchemaPrompt(value) ||
        isSchemaMap(value) ||
        isSchemaString(value) ||
        isSchemaMessage(value) ||
        isSchemaMoment(value) ||
        isSchemaEdit(value)
}

export type SchemaToWMLTopLevelOptions = {
    persistentOnly?: boolean
}

