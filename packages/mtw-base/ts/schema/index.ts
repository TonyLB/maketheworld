import { SchemaAssetTag, SchemaStoryTag } from "./asset"
import { isSchemaGrant, SchemaGrantTag } from "./authorization"
import { isSchemaPronouns, SchemaCharacterLegalContents, SchemaCharacterTag, SchemaPronounsTag } from "./character"
import { isSchemaExit, isSchemaFeature, isSchemaKnowledge, isSchemaMap, isSchemaMessage, isSchemaMoment, isSchemaPosition, isSchemaRoom, isSchemaShortName, SchemaExitTag, SchemaFeatureTag, SchemaKnowledgeTag, SchemaMapTag, SchemaMessageTag, SchemaMomentTag, SchemaPositionTag, SchemaRoomTag, SchemaShortNameTag } from "./components"
import { isSchemaAction, isSchemaComputed, isSchemaVariable, SchemaActionTag, SchemaComputedTag, SchemaVariableTag } from "./computation"
import { isSchemaCondition, isSchemaConditionFallthrough, isSchemaConditionStatement, isSchemaSelected, SchemaConditionFallthroughTag, SchemaConditionStatementTag, SchemaConditionTag, SchemaSelectedTag } from "./condition"
import { isSchemaEdit, isSchemaRemove, isSchemaReplace, isSchemaReplaceMatch, isSchemaReplacePayload, SchemaEditTag, SchemaReplaceTag } from "./edit"
import { isSchemaDescription, isSchemaExample, isSchemaName, isSchemaSummary, SchemaDescriptionTag, SchemaExampleTag, SchemaNameTag, SchemaSummaryTag } from "./example"
import { isSchemaImage, SchemaImageTag } from "./image"
import { isSchemaImport, isSchemaMeta, SchemaExportTag, SchemaImportTag, SchemaMetaTag } from "./metaData"
import { isSchemaLineBreak, isSchemaLink, isSchemaSpacer, isSchemaString, SchemaLineBreakTag, SchemaLinkTag, SchemaSpacerTag, SchemaStringTag, SchemaWhitespaceTag } from "./renderTree"

export type SchemaAssetLegalContents = SchemaCharacterTag | SchemaGrantTag | SchemaActionTag | SchemaComputedTag | SchemaConditionTag | SchemaExitTag | SchemaFeatureTag | SchemaImageTag | SchemaImportTag | SchemaMetaTag | SchemaMapTag | SchemaRoomTag | SchemaVariableTag | SchemaMessageTag | SchemaMomentTag
export type SchemaConditionLegalContents =  SchemaConditionTag | SchemaExitTag | SchemaFeatureTag | SchemaImageTag | SchemaMapTag | SchemaRoomTag

export const isSchemaLiteralTag = (item: SchemaTag): item is SchemaShortNameTag => (
    isSchemaShortName(item)
)
export const isSchemaCharacterContents = (item: SchemaTag): item is SchemaCharacterLegalContents => (
    isSchemaName(item) || isSchemaPronouns(item) || isSchemaImage(item) || isSchemaImport(item) || isSchemaMeta(item) || isSchemaShortName(item) || isSchemaRemove(item) || isSchemaReplace(item)
)

export type SchemaTaggedMessageIncomingContents = SchemaEditTag | SchemaStringTag | SchemaLinkTag | SchemaLineBreakTag | SchemaSpacerTag | SchemaConditionTag | SchemaConditionStatementTag | SchemaConditionFallthroughTag | SchemaWhitespaceTag | SchemaReplaceTag
export type SchemaTaggedMessageLegalContents = SchemaEditTag | SchemaStringTag | SchemaLinkTag | SchemaLineBreakTag | SchemaSpacerTag | SchemaConditionTag | SchemaConditionStatementTag | SchemaConditionFallthroughTag | SchemaReplaceTag | SchemaSelectedTag
export type SchemaOutputTag = SchemaStringTag | SchemaLinkTag | SchemaLineBreakTag | SchemaSpacerTag | SchemaConditionTag | SchemaConditionStatementTag | SchemaConditionFallthroughTag | SchemaEditTag | SchemaSelectedTag
export const isSchemaOutputTag = (tag: any): tag is SchemaOutputTag => (
    isSchemaString(tag) ||
    isSchemaLink(tag) ||
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

export type SchemaMapLegalContents = SchemaExitTag | SchemaImageTag | SchemaRoomTag | SchemaConditionTag | SchemaNameTag

export type SchemaTag = SchemaAssetTag |
    SchemaStoryTag |
    SchemaPronounsTag |
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
    SchemaShortNameTag |
    SchemaNameTag |
    SchemaExampleTag |
    SchemaRoomTag |
    SchemaFeatureTag |
    SchemaKnowledgeTag |
    SchemaPositionTag |
    SchemaMapTag |
    SchemaStringTag |
    SchemaWhitespaceTag |
    SchemaMessageTag |
    SchemaMomentTag |
    SchemaEditTag |
    SchemaGrantTag

export type SchemaWithContents = SchemaAssetTag |
    SchemaStoryTag |
    SchemaConditionTag |
    SchemaConditionStatementTag |
    SchemaConditionFallthroughTag |
    SchemaRoomTag |
    SchemaFeatureTag |
    SchemaKnowledgeTag |
    SchemaDescriptionTag |
    SchemaSummaryTag |
    SchemaExitTag |
    SchemaCharacterTag |
    SchemaMapTag |
    SchemaShortNameTag |
    SchemaNameTag |
    SchemaExampleTag |
    SchemaMessageTag |
    SchemaMomentTag |
    SchemaEditTag

export const isSchemaAssetContents = (value: SchemaTag): value is SchemaAssetLegalContents => (isSchemaCharacter(value) || isSchemaGrant(value) || isSchemaAction(value) || isSchemaComputed(value) || isSchemaCondition(value) || isSchemaExit(value) || isSchemaFeature(value) || isSchemaKnowledge(value) || isSchemaImage(value) || isSchemaImport(value) || isSchemaMeta(value) || isSchemaMap(value) || isSchemaRoom(value) || isSchemaVariable(value) || isSchemaMessage(value) || isSchemaMoment(value) || isSchemaSelected(value) || isSchemaRemove(value) || isSchemaReplace(value))
export const isSchemaMapContents = (value: SchemaTag): value is SchemaMapLegalContents => (['Image', 'Exit', 'Room', 'If', 'Name'].includes(value.tag))

export const isSchemaCharacter = (value: SchemaTag): value is SchemaCharacterTag => (value.tag === 'Character')
export const isSchemaAsset = (value: SchemaTag): value is SchemaAssetTag => (value.tag === 'Asset')

export const isSchemaWithContents = (value: SchemaTag): value is SchemaWithContents => (
    ['Asset', 'Story', 'If', 'Example', 'Room', 'Feature', 'Knowledge', 'Description', 'Summary', 'Exit', 'Character', 'Map', 'Message', 'Moment', 'Name', 'ShortName', 'Replace', 'ReplaceMatch', 'ReplacePayload'].includes(value.tag)
)

export const isImportable = (value: SchemaTag): value is SchemaRoomTag | SchemaFeatureTag | SchemaKnowledgeTag | SchemaMapTag | SchemaMessageTag | SchemaMomentTag | SchemaActionTag | SchemaComputedTag | SchemaVariableTag => (
    ['Example', 'Room', 'Feature', 'Knowledge', 'Map', 'Message', 'Moment', 'Action', 'Computed', 'Variable'].includes(value?.tag)
)
export const isImportableTag = (tag: string): boolean => (
    ['Example', 'Room', 'Feature', 'Knowledge', 'Map', 'Message', 'Moment', 'Action', 'Computed', 'Variable'].includes(tag)
)

export type SchemaWithKey = SchemaAssetTag | SchemaStoryTag | SchemaExampleTag | SchemaRoomTag | SchemaFeatureTag | SchemaKnowledgeTag | SchemaCharacterTag | SchemaMapTag | SchemaImageTag | SchemaActionTag | SchemaVariableTag | SchemaComputedTag | SchemaMessageTag | SchemaMomentTag
export const isSchemaWithKey = (value: SchemaTag): value is SchemaWithKey => (
    ['Asset', 'Story', 'Example', 'Room', 'Feature', 'Knowledge', 'Character', 'Map', 'Image', 'Action', 'Variable', 'Computed', 'Message', 'Moment'].includes(value.tag)
)
export type SchemaComponent = SchemaExampleTag | SchemaRoomTag | SchemaFeatureTag | SchemaKnowledgeTag | SchemaCharacterTag | SchemaMapTag | SchemaImageTag | SchemaActionTag | SchemaVariableTag | SchemaComputedTag | SchemaMessageTag | SchemaMomentTag
export const isSchemaComponentTag = (tag: string): tag is SchemaComponent["tag"] => (
    ['Example', 'Room', 'Feature', 'Knowledge', 'Character', 'Map', 'Image', 'Action', 'Variable', 'Computed', 'Message', 'Moment'].includes(tag)
)
export const isSchemaComponent = (value: SchemaTag): value is SchemaComponent => (
    isSchemaComponentTag(value.tag)
)
export type ComponentUUID = `${Uppercase<SchemaComponent["tag"]> | 'ASSET'}#${string}`
export const isSchemaComponentUUID = (value: string): value is ComponentUUID => {
    const [tag, ...rest] = value.split('#')
    const componentTag = `${tag[0]}${tag.slice(1).toLowerCase()}`
    return isSchemaComponentTag(componentTag) && rest.length === 1 && rest[0].length > 0
}

export const isSchemaTaggedMessageLegalContents = (value: SchemaTag): value is SchemaTaggedMessageLegalContents => (
    ['Remove', 'Replace', 'ReplaceMatch', 'ReplacePayload', 'String', 'Link', 'Space', 'br', 'If', 'Statement', 'Fallthrough'].includes(value.tag)
)

export const isSchemaTag = (value: any): value is SchemaTag => {
    return isSchemaAsset(value) ||
        isSchemaPronouns(value) ||
        isSchemaCharacter(value) ||
        isSchemaImage(value) ||
        isSchemaVariable(value) ||
        isSchemaComputed(value) ||
        isSchemaAction(value) ||
        isSchemaImport(value) ||
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
        isSchemaShortName(value) ||
        isSchemaName(value) ||
        isSchemaExample(value) ||
        isSchemaRoom(value) ||
        isSchemaFeature(value) ||
        isSchemaKnowledge(value) ||
        isSchemaPosition(value) ||
        isSchemaMap(value) ||
        isSchemaString(value) ||
        isSchemaMessage(value) ||
        isSchemaMoment(value) ||
        isSchemaEdit(value) ||
        isSchemaGrant(value)
}

export type SchemaToWMLTopLevelOptions = {
    persistentOnly?: boolean
}

