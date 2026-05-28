import { SchemaAssetTag, SchemaStoryTag } from "./asset"
import { isSchemaGrant, SchemaGrantTag } from "./authorization"
import { isSchemaPronouns, SchemaCharacterLegalContents, SchemaCharacterTag, SchemaPronounsTag } from "./character"
import { isSchemaExit, isSchemaFeature, isSchemaGuidance, isSchemaKnowledge, isSchemaMap, isSchemaMessage, isSchemaMoment, isSchemaObject, isSchemaPosition, isSchemaRoom, isSchemaShortName, isSchemaInstructions, isSchemaDefault, isSchemaParent, isSchemaKey, isSchemaSituation, isSchemaArea, isSchemaRender, SchemaExitTag, SchemaFeatureTag, SchemaGuidanceTag, SchemaKnowledgeTag, SchemaMapTag, SchemaMessageTag, SchemaMomentTag, SchemaObjectTag, SchemaPositionTag, SchemaRoomTag, SchemaShortNameTag, SchemaInstructionsTag, SchemaDefaultTag, SchemaParentTag, SchemaKeyTag, SchemaSituationTag, SchemaAreaTag, SchemaRenderTag } from "./components"
import { isSchemaMatch, isSchemaMark, isSchemaLens, SchemaMatchTag, SchemaMarkTag, SchemaLensTag } from "./worldState"

import { isSchemaEdit, isSchemaRemove, isSchemaReplace, isSchemaReplaceMatch, isSchemaReplacePayload, SchemaEditTag, SchemaReplaceTag } from "./edit"
import { isSchemaDescription, isSchemaSummary, isSchemaDisplayName, SchemaDescriptionTag, SchemaDisplayNameTag, SchemaSummaryTag } from "./prose"
import { isSchemaImage, SchemaImageTag } from "./image"
import { isSchemaImport, SchemaImportTag } from "./metaData"
import { isSchemaLineBreak, isSchemaLink, isSchemaSpacer, isSchemaString, SchemaLineBreakTag, SchemaLinkTag, SchemaSpacerTag, SchemaStringTag, SchemaWhitespaceTag } from "./renderTree"

export type SchemaAssetLegalContents = SchemaCharacterTag | SchemaGrantTag | SchemaExitTag | SchemaFeatureTag | SchemaKnowledgeTag | SchemaImageTag | SchemaImportTag | SchemaMapTag | SchemaMarkTag | SchemaLensTag | SchemaRoomTag | SchemaMessageTag | SchemaMomentTag | SchemaGuidanceTag | SchemaSituationTag | SchemaAreaTag | SchemaShortNameTag | SchemaInstructionsTag | SchemaDefaultTag | SchemaSummaryTag


export const isSchemaLiteralTag = (item: SchemaTag): item is SchemaShortNameTag | SchemaInstructionsTag | SchemaDefaultTag => (
    isSchemaShortName(item) || isSchemaInstructions(item) || isSchemaDefault(item)
)
export const isSchemaCharacterContents = (item: SchemaTag): item is SchemaCharacterLegalContents => (
    isSchemaDisplayName(item) || isSchemaPronouns(item) || isSchemaImage(item) || isSchemaImport(item) || isSchemaShortName(item) || isSchemaRemove(item) || isSchemaReplace(item)
)

export type SchemaTaggedMessageIncomingContents = SchemaEditTag | SchemaStringTag | SchemaLinkTag | SchemaLineBreakTag | SchemaSpacerTag | SchemaWhitespaceTag | SchemaReplaceTag
export type SchemaTaggedMessageLegalContents = SchemaEditTag | SchemaStringTag | SchemaLinkTag | SchemaLineBreakTag | SchemaSpacerTag | SchemaReplaceTag | SchemaShortNameTag
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

export type SchemaMapLegalContents = SchemaExitTag | SchemaImageTag | SchemaRoomTag | SchemaShortNameTag

export type SchemaTag = SchemaAssetTag |
    SchemaStoryTag |
    SchemaPronounsTag |
    SchemaCharacterTag |
    SchemaImageTag |
    SchemaImportTag |
    SchemaExitTag |
    SchemaDescriptionTag |
    SchemaSummaryTag |
    SchemaLineBreakTag |
    SchemaSpacerTag |
    SchemaLinkTag |
    SchemaShortNameTag |
    SchemaInstructionsTag |
    SchemaDefaultTag |
    SchemaMatchTag |
    SchemaDisplayNameTag |
    SchemaRoomTag |
    SchemaFeatureTag |
    SchemaKnowledgeTag |
    SchemaPositionTag |
    SchemaMapTag |
    SchemaMarkTag |
    SchemaLensTag |
    SchemaStringTag |
    SchemaWhitespaceTag |
    SchemaMessageTag |
    SchemaMomentTag |
    SchemaGuidanceTag |
    SchemaSituationTag |
    SchemaAreaTag |
    SchemaEditTag |
    SchemaGrantTag |
    SchemaParentTag |
    SchemaKeyTag |
    SchemaObjectTag |
    SchemaRenderTag

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
    SchemaInstructionsTag |
    SchemaDefaultTag |
    SchemaMatchTag |
    SchemaDisplayNameTag |
    SchemaMessageTag |
    SchemaMomentTag |
    SchemaGuidanceTag |
    SchemaSituationTag |
    SchemaAreaTag |
    SchemaEditTag

export const isSchemaAssetContents = (value: SchemaTag): value is SchemaAssetLegalContents => (isSchemaCharacter(value) || isSchemaGrant(value) || isSchemaExit(value) || isSchemaFeature(value) || isSchemaKnowledge(value) || isSchemaImage(value) || isSchemaImport(value) || isSchemaMap(value) || isSchemaMark(value) || isSchemaLens(value) || isSchemaRoom(value) || isSchemaMessage(value) || isSchemaMoment(value) || isSchemaGuidance(value) || isSchemaSituation(value) || isSchemaArea(value) || isSchemaRemove(value) || isSchemaReplace(value) || isSchemaImport(value) || isSchemaShortName(value) || isSchemaInstructions(value) || isSchemaDefault(value) || isSchemaSummary(value))
export const isSchemaMapContents = (value: SchemaTag): value is SchemaMapLegalContents => (['Image', 'Exit', 'Room', 'ShortName'].includes(value.tag))

export const isSchemaCharacter = (value: SchemaTag): value is SchemaCharacterTag => (value.tag === 'Character')
export const isSchemaAsset = (value: SchemaTag): value is SchemaAssetTag => (value.tag === 'Asset')

export const isSchemaWithContents = (value: SchemaTag): value is SchemaWithContents => (
    ['Asset', 'Story', 'Room', 'Feature', 'Knowledge', 'Description', 'Summary', 'Exit', 'Character', 'Map', 'Message', 'Moment', 'Guidance', 'Situation', 'Area', 'DisplayName', 'ShortName', 'Instructions', 'Match', 'Replace', 'ReplaceMatch', 'ReplacePayload'].includes(value.tag)
)

export const isImportable = (value: SchemaTag): value is SchemaRoomTag | SchemaFeatureTag | SchemaKnowledgeTag | SchemaMapTag | SchemaMessageTag | SchemaMomentTag | SchemaMarkTag | SchemaLensTag | SchemaAreaTag => (
    ['Room', 'Feature', 'Knowledge', 'Map', 'Message', 'Moment', 'Mark', 'Lens', 'Area'].includes(value?.tag)
)
export const isImportableTag = (tag: string): boolean => (
    ['Room', 'Feature', 'Knowledge', 'Map', 'Message', 'Moment', 'Mark', 'Lens', 'Area'].includes(tag)
)

export type SchemaWithKey = SchemaRoomTag | SchemaFeatureTag | SchemaKnowledgeTag | SchemaCharacterTag | SchemaMapTag | SchemaImageTag | SchemaMarkTag | SchemaLensTag | SchemaMessageTag | SchemaMomentTag | SchemaGuidanceTag | SchemaSituationTag | SchemaAreaTag
export const isSchemaWithKey = (value: SchemaTag): value is SchemaWithKey => (
    ['Room', 'Feature', 'Knowledge', 'Character', 'Map', 'Image', 'Mark', 'Lens', 'Message', 'Moment', 'Guidance', 'Situation', 'Area'].includes(value.tag)
)
export type SchemaComponent = SchemaRoomTag | SchemaFeatureTag | SchemaKnowledgeTag | SchemaCharacterTag | SchemaMapTag | SchemaImageTag | SchemaMarkTag | SchemaLensTag | SchemaMessageTag | SchemaMomentTag | SchemaGuidanceTag | SchemaSituationTag | SchemaAreaTag
export const isSchemaComponentTag = (tag: string): tag is SchemaComponent["tag"] => (
    ['Room', 'Feature', 'Knowledge', 'Character', 'Map', 'Image', 'Mark', 'Lens', 'Message', 'Moment', 'Guidance', 'Situation', 'Area'].includes(tag)
)
export const isSchemaComponent = (value: SchemaTag): value is SchemaComponent => (
    isSchemaComponentTag(value.tag)
)
export type AssetUUID = `ASSET#${string}`
export const isSchemaAssetUUID = (value: string): value is AssetUUID => {
    return value.startsWith('ASSET#') && value.length > 6 && /^[A-Za-z0-9-\[\]]+$/.test(value.slice(6))
}
// EphemeraId (mtw-interfaces) is a subset of these tags for the ephemera domain; that list is maintained separately.
export type ComponentUUID = `${Uppercase<SchemaComponent["tag"]>}#${string}` | AssetUUID
export const isSchemaComponentUUID = (value: string): value is ComponentUUID => {
    if (isSchemaAssetUUID(value)) return true
    const [tag, ...rest] = value.split('#')
    const componentTag = `${tag[0]}${tag.slice(1).toLowerCase()}`
    return isSchemaComponentTag(componentTag) && rest.length === 1 && rest[0].length > 0
}

export const isSchemaTaggedMessageLegalContents = (value: SchemaTag): value is SchemaTaggedMessageLegalContents => (
    ['Remove', 'Replace', 'ReplaceMatch', 'ReplacePayload', 'String', 'Link', 'Space', 'br', 'ShortName'].includes(value.tag)
)

export const isSchemaTag = (value: any): value is SchemaTag => {
    return isSchemaAsset(value) ||
        isSchemaPronouns(value) ||
        isSchemaCharacter(value) ||
        isSchemaImage(value) ||
        isSchemaImport(value) ||
        isSchemaExit(value) ||
        isSchemaDescription(value) ||
        isSchemaSummary(value) ||
        isSchemaLineBreak(value) ||
        isSchemaSpacer(value) ||
        isSchemaLink(value) ||
        isSchemaShortName(value) ||
        isSchemaInstructions(value) ||
        isSchemaMatch(value) ||
        isSchemaDisplayName(value) ||
        isSchemaGuidance(value) ||
        isSchemaSituation(value) ||
        isSchemaArea(value) ||
        isSchemaRoom(value) ||
        isSchemaFeature(value) ||
        isSchemaKnowledge(value) ||
        isSchemaPosition(value) ||
        isSchemaMap(value) ||
        isSchemaMark(value) ||
        isSchemaLens(value) ||
        isSchemaString(value) ||
        isSchemaMessage(value) ||
        isSchemaMoment(value) ||
        isSchemaEdit(value) ||
        isSchemaGrant(value) ||
        isSchemaParent(value) ||
        isSchemaKey(value) ||
        isSchemaObject(value) ||
        isSchemaRender(value)
}

export type SchemaToWMLTopLevelOptions = {
    persistentOnly?: boolean
}

