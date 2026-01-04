import { SchemaAssetTag, SchemaStoryTag } from "./asset"
import { isSchemaGrant, SchemaGrantTag } from "./authorization"
import { isSchemaPronouns, SchemaCharacterLegalContents, SchemaCharacterTag, SchemaPronounsTag } from "./character"
import { isSchemaExit, isSchemaFeature, isSchemaKnowledge, isSchemaMap, isSchemaMessage, isSchemaMoment, isSchemaPosition, isSchemaRoom, isSchemaShortName, isSchemaParent, isSchemaKey, SchemaExitTag, SchemaFeatureTag, SchemaKnowledgeTag, SchemaMapTag, SchemaMessageTag, SchemaMomentTag, SchemaPositionTag, SchemaRoomTag, SchemaShortNameTag, SchemaParentTag, SchemaKeyTag } from "./components"
import { isSchemaMatch, isSchemaMark, SchemaMatchTag, SchemaMarkTag } from "./worldState"

import { isSchemaEdit, isSchemaRemove, isSchemaReplace, isSchemaReplaceMatch, isSchemaReplacePayload, SchemaEditTag, SchemaReplaceTag } from "./edit"
import { isSchemaDescription, isSchemaExample, isSchemaName, isSchemaSummary, SchemaDescriptionTag, SchemaExampleTag, SchemaNameTag, SchemaSummaryTag } from "./example"
import { isSchemaImage, SchemaImageTag } from "./image"
import { isSchemaImport, isSchemaMeta, SchemaImportTag, SchemaMetaTag } from "./metaData"
import { isSchemaLineBreak, isSchemaLink, isSchemaSpacer, isSchemaString, SchemaLineBreakTag, SchemaLinkTag, SchemaSpacerTag, SchemaStringTag, SchemaWhitespaceTag } from "./renderTree"

export type SchemaAssetLegalContents = SchemaCharacterTag | SchemaGrantTag | SchemaExitTag | SchemaFeatureTag | SchemaKnowledgeTag | SchemaImageTag | SchemaImportTag | SchemaMetaTag | SchemaMapTag | SchemaMarkTag | SchemaRoomTag | SchemaMessageTag | SchemaMomentTag | SchemaExampleTag | SchemaShortNameTag | SchemaSummaryTag


export const isSchemaLiteralTag = (item: SchemaTag): item is SchemaShortNameTag => (
    isSchemaShortName(item)
)
export const isSchemaCharacterContents = (item: SchemaTag): item is SchemaCharacterLegalContents => (
    isSchemaName(item) || isSchemaPronouns(item) || isSchemaImage(item) || isSchemaImport(item) || isSchemaMeta(item) || isSchemaShortName(item) || isSchemaRemove(item) || isSchemaReplace(item)
)

export type SchemaTaggedMessageIncomingContents = SchemaEditTag | SchemaStringTag | SchemaLinkTag | SchemaLineBreakTag | SchemaSpacerTag | SchemaWhitespaceTag | SchemaReplaceTag
export type SchemaTaggedMessageLegalContents = SchemaEditTag | SchemaStringTag | SchemaLinkTag | SchemaLineBreakTag | SchemaSpacerTag | SchemaReplaceTag
export type SchemaOutputTag = SchemaStringTag | SchemaLinkTag | SchemaLineBreakTag | SchemaSpacerTag | SchemaEditTag
export const isSchemaOutputTag = (tag: any): tag is SchemaOutputTag => (
    isSchemaString(tag) ||
    isSchemaLink(tag) ||
    isSchemaLineBreak(tag) ||
    isSchemaSpacer(tag) ||
    isSchemaRemove(tag) ||
    isSchemaReplace(tag) ||
    isSchemaReplaceMatch(tag) ||
    isSchemaReplacePayload(tag)
)

export type SchemaMapLegalContents = SchemaExitTag | SchemaImageTag | SchemaRoomTag | SchemaNameTag

export type SchemaTag = SchemaAssetTag |
    SchemaStoryTag |
    SchemaPronounsTag |
    SchemaCharacterTag |
    SchemaImageTag |
    SchemaImportTag |
    SchemaMetaTag |
    SchemaExitTag |
    SchemaDescriptionTag |
    SchemaSummaryTag |
    SchemaLineBreakTag |
    SchemaSpacerTag |
    SchemaLinkTag |
    SchemaShortNameTag |
    SchemaMatchTag |
    SchemaNameTag |
    SchemaExampleTag |
    SchemaRoomTag |
    SchemaFeatureTag |
    SchemaKnowledgeTag |
    SchemaPositionTag |
    SchemaMapTag |
    SchemaMarkTag |
    SchemaStringTag |
    SchemaWhitespaceTag |
    SchemaMessageTag |
    SchemaMomentTag |
    SchemaEditTag |
    SchemaGrantTag |
    SchemaParentTag |
    SchemaKeyTag

export type SchemaWithContents = SchemaAssetTag |
    SchemaStoryTag |
    SchemaRoomTag |
    SchemaFeatureTag |
    SchemaKnowledgeTag |
    SchemaDescriptionTag |
    SchemaSummaryTag |
    SchemaExitTag |
    SchemaCharacterTag |
    SchemaMapTag |
    SchemaShortNameTag |
    SchemaMatchTag |
    SchemaNameTag |
    SchemaExampleTag |
    SchemaMessageTag |
    SchemaMomentTag |
    SchemaEditTag

export const isSchemaAssetContents = (value: SchemaTag): value is SchemaAssetLegalContents => (isSchemaCharacter(value) || isSchemaGrant(value) || isSchemaExit(value) || isSchemaFeature(value) || isSchemaKnowledge(value) || isSchemaImage(value) || isSchemaImport(value) || isSchemaMeta(value) || isSchemaMap(value) || isSchemaMark(value) || isSchemaRoom(value) || isSchemaMessage(value) || isSchemaMoment(value) || isSchemaExample(value) || isSchemaRemove(value) || isSchemaReplace(value) || isSchemaImport(value) || isSchemaShortName(value) || isSchemaSummary(value))
export const isSchemaMapContents = (value: SchemaTag): value is SchemaMapLegalContents => (['Image', 'Exit', 'Room', 'Name'].includes(value.tag))

export const isSchemaCharacter = (value: SchemaTag): value is SchemaCharacterTag => (value.tag === 'Character')
export const isSchemaAsset = (value: SchemaTag): value is SchemaAssetTag => (value.tag === 'Asset')

export const isSchemaWithContents = (value: SchemaTag): value is SchemaWithContents => (
    ['Asset', 'Story', 'Example', 'Room', 'Feature', 'Knowledge', 'Description', 'Summary', 'Exit', 'Character', 'Map', 'Message', 'Moment', 'Name', 'ShortName', 'Match', 'Replace', 'ReplaceMatch', 'ReplacePayload'].includes(value.tag)
)

export const isImportable = (value: SchemaTag): value is SchemaRoomTag | SchemaFeatureTag | SchemaKnowledgeTag | SchemaMapTag | SchemaMessageTag | SchemaMomentTag | SchemaMarkTag => (
    ['Example', 'Room', 'Feature', 'Knowledge', 'Map', 'Message', 'Moment', 'Mark'].includes(value?.tag)
)
export const isImportableTag = (tag: string): boolean => (
    ['Example', 'Room', 'Feature', 'Knowledge', 'Map', 'Message', 'Moment', 'Mark'].includes(tag)
)

export type SchemaWithKey = SchemaExampleTag | SchemaRoomTag | SchemaFeatureTag | SchemaKnowledgeTag | SchemaCharacterTag | SchemaMapTag | SchemaImageTag | SchemaMarkTag | SchemaMessageTag | SchemaMomentTag
export const isSchemaWithKey = (value: SchemaTag): value is SchemaWithKey => (
    ['Example', 'Room', 'Feature', 'Knowledge', 'Character', 'Map', 'Image', 'Mark', 'Message', 'Moment'].includes(value.tag)
)
export type SchemaComponent = SchemaExampleTag | SchemaRoomTag | SchemaFeatureTag | SchemaKnowledgeTag | SchemaCharacterTag | SchemaMapTag | SchemaImageTag | SchemaMarkTag | SchemaMessageTag | SchemaMomentTag
export const isSchemaComponentTag = (tag: string): tag is SchemaComponent["tag"] => (
    ['Example', 'Room', 'Feature', 'Knowledge', 'Character', 'Map', 'Image', 'Mark', 'Message', 'Moment'].includes(tag)
)
export const isSchemaComponent = (value: SchemaTag): value is SchemaComponent => (
    isSchemaComponentTag(value.tag)
)
export type AssetUUID = `ASSET#${string}`
export const isSchemaAssetUUID = (value: string): value is AssetUUID => {
    return value.startsWith('ASSET#') && value.length > 6 && /^[A-Za-z0-9-\[\]]+$/.test(value.slice(6))
}
export type ComponentUUID = `${Uppercase<SchemaComponent["tag"]>}#${string}` | AssetUUID
export const isSchemaComponentUUID = (value: string): value is ComponentUUID => {
    if (isSchemaAssetUUID(value)) return true
    const [tag, ...rest] = value.split('#')
    const componentTag = `${tag[0]}${tag.slice(1).toLowerCase()}`
    return isSchemaComponentTag(componentTag) && rest.length === 1 && rest[0].length > 0
}

export const isSchemaTaggedMessageLegalContents = (value: SchemaTag): value is SchemaTaggedMessageLegalContents => (
    ['Remove', 'Replace', 'ReplaceMatch', 'ReplacePayload', 'String', 'Link', 'Space', 'br'].includes(value.tag)
)

export const isSchemaTag = (value: any): value is SchemaTag => {
    return isSchemaAsset(value) ||
        isSchemaPronouns(value) ||
        isSchemaCharacter(value) ||
        isSchemaImage(value) ||
        isSchemaImport(value) ||
        isSchemaMeta(value) ||
        isSchemaExit(value) ||
        isSchemaDescription(value) ||
        isSchemaSummary(value) ||
        isSchemaLineBreak(value) ||
        isSchemaSpacer(value) ||
        isSchemaLink(value) ||
        isSchemaShortName(value) ||
        isSchemaMatch(value) ||
        isSchemaName(value) ||
        isSchemaExample(value) ||
        isSchemaRoom(value) ||
        isSchemaFeature(value) ||
        isSchemaKnowledge(value) ||
        isSchemaPosition(value) ||
        isSchemaMap(value) ||
        isSchemaMark(value) ||
        isSchemaString(value) ||
        isSchemaMessage(value) ||
        isSchemaMoment(value) ||
        isSchemaEdit(value) ||
        isSchemaGrant(value) ||
        isSchemaParent(value) ||
        isSchemaKey(value)
}

export type SchemaToWMLTopLevelOptions = {
    persistentOnly?: boolean
}

