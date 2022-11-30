import WMLConverter from "../convert"
import {
    isParseExit,
    isParseRoom,
    isParseTagNesting,
    ParseActionTag,
    ParseAssetTag,
    ParseCharacterTag,
    ParseComputedTag,
    ParseConditionTag,
    ParseDescriptionTag,
    ParseExitTag,
    ParseFeatureTag,
    ParseFirstImpressionTag,
    ParseImageTag,
    ParseImportTag,
    ParseLinkTag,
    ParseMapTag,
    ParseNameTag,
    ParseOneCoolThingTag,
    ParseOutfitTag,
    ParsePronounsTag,
    ParseRoomTag,
    ParseStoryTag,
    ParseStringTag,
    ParseTag,
    ParseUseTag,
    ParseVariableTag
} from "../parser/baseClasses"
import schemaFromAction from "./action"
import schemaFromAsset, { schemaFromStory } from "./asset"
import {
    SchemaActionTag,
    SchemaAssetLegalContents,
    SchemaAssetTag,
    SchemaCharacterLegalContents,
    SchemaCharacterTag,
    SchemaComputedTag,
    SchemaConditionTag,
    SchemaTaggedMessageLegalContents,
    SchemaDescriptionTag,
    SchemaException,
    SchemaExitTag,
    SchemaFeatureLegalContents,
    SchemaFeatureTag,
    SchemaFirstImpressionTag,
    SchemaImageTag,
    SchemaImportTag,
    SchemaLinkTag,
    SchemaLiteralLegalContents,
    SchemaMapLegalContents,
    SchemaMapTag,
    SchemaNameTag,
    SchemaOneCoolThingTag,
    SchemaOutfitTag,
    SchemaPronounsTag,
    SchemaRoomLegalContents,
    SchemaRoomTag,
    SchemaStoryTag,
    SchemaStringTag,
    SchemaTag,
    SchemaUseTag,
    SchemaVariableTag,
} from "./baseClasses"
import schemaFromBookmark from "./bookmark"
import schemaFromCharacter, { schemaFromFirstImpression, schemaFromOneCoolThing, schemaFromOutfit, schemaFromPronouns } from "./character"
import schemaFromComputed from "./computed"
import schemaFromDescription from "./description"
import schemaFromFeature from "./feature"
import schemaFromImport from "./import"
import schemaFromMap from "./map"
import schemaFromName from "./name"
import schemaFromRoom from "./room"
import schemaFromUse from "./use"
import { transformWithContext, TransformWithContextCallback } from "./utils"
import schemaFromVariable from "./variable"

const schemaConvert = new WMLConverter()

function schemaFromParseItem(item: ParseAssetTag, siblings: SchemaTag[]): SchemaAssetTag
function schemaFromParseItem(item: ParseStoryTag, siblings: SchemaTag[]): SchemaStoryTag
function schemaFromParseItem(item: ParseMapTag, siblings: SchemaTag[]): SchemaMapTag
function schemaFromParseItem(item: ParseImportTag, siblings: SchemaTag[]): SchemaImportTag
function schemaFromParseItem(item: ParseUseTag, siblings: SchemaTag[]): SchemaUseTag
function schemaFromParseItem(item: ParseExitTag, siblings: SchemaTag[]): SchemaExitTag
function schemaFromParseItem(item: ParseRoomTag, siblings: SchemaTag[]): SchemaRoomTag
function schemaFromParseItem(item: ParseNameTag, siblings: SchemaTag[]): SchemaNameTag
function schemaFromParseItem(item: ParseStringTag, siblings: SchemaTag[]): SchemaStringTag
function schemaFromParseItem(item: ParseDescriptionTag, siblings: SchemaTag[]): SchemaDescriptionTag
function schemaFromParseItem(item: ParseFeatureTag, siblings: SchemaTag[]): SchemaFeatureTag
function schemaFromParseItem(item: ParseLinkTag, siblings: SchemaTag[]): SchemaLinkTag
function schemaFromParseItem(item: ParseConditionTag, siblings: SchemaTag[]): SchemaConditionTag
function schemaFromParseItem(item: ParseActionTag, siblings: SchemaTag[]): SchemaActionTag
function schemaFromParseItem(item: ParseComputedTag, siblings: SchemaTag[]): SchemaComputedTag
function schemaFromParseItem(item: ParseImageTag, siblings: SchemaTag[]): SchemaImageTag
function schemaFromParseItem(item: ParseVariableTag, siblings: SchemaTag[]): SchemaVariableTag
function schemaFromParseItem(item: ParsePronounsTag, siblings: SchemaTag[]): SchemaPronounsTag
function schemaFromParseItem(item: ParseFirstImpressionTag, siblings: SchemaTag[]): SchemaFirstImpressionTag
function schemaFromParseItem(item: ParseOneCoolThingTag, siblings: SchemaTag[]): SchemaOneCoolThingTag
function schemaFromParseItem(item: ParseOutfitTag, siblings: SchemaTag[]): SchemaOutfitTag
function schemaFromParseItem(item: ParseCharacterTag, siblings: SchemaTag[]): SchemaCharacterTag
function schemaFromParseItem(item: ParseTag, siblings: SchemaTag[]): SchemaTag
function schemaFromParseItem(item: ParseTag, siblings: SchemaTag[]): SchemaTag {
    let schemaContents: SchemaTag[] = []
    if (isParseTagNesting(item)) {
        schemaContents = (item.contents as any).reduce((previous, item) => ([
            ...previous,
            schemaFromParseItem(item, previous)
        ]), [] as SchemaTag[])
    }
    switch(item.tag) {
        case 'Asset':
            return schemaFromAsset(item, schemaContents as SchemaAssetLegalContents[])
        case 'Story':
            return schemaFromStory(item, schemaContents as SchemaAssetLegalContents[])
        case 'Map':
            return schemaFromMap(item, schemaContents as SchemaMapLegalContents[])
        case 'Import':
            return schemaFromImport(item, schemaContents as SchemaUseTag[])
        case 'Use':
            return schemaFromUse(item)
        case 'Exit':
            return schemaConvert.schemaConvert(item, siblings, schemaContents)
        case 'Room':
            return schemaFromRoom(item, schemaContents as SchemaRoomLegalContents[])
        case 'String':
            return schemaConvert.schemaConvert(item, siblings, schemaContents)
        case 'Name':
            return schemaFromName(item, schemaContents as SchemaLiteralLegalContents[])
        case 'Description':
            return schemaFromDescription(item, schemaContents as SchemaTaggedMessageLegalContents[])
        case 'Bookmark':
            return schemaFromBookmark(item, schemaContents as SchemaTaggedMessageLegalContents[])
        case 'Feature':
            return schemaFromFeature(item, schemaContents as SchemaFeatureLegalContents[])
        case 'Link':
            return schemaConvert.schemaConvert(item, siblings, schemaContents)
        case 'If':
            return schemaConvert.schemaConvert(item, siblings, schemaContents)
        case 'Else':
            return schemaConvert.schemaConvert(item, siblings, schemaContents)
        case 'ElseIf':
            return schemaConvert.schemaConvert(item, siblings, schemaContents)
        case 'Action':
            return schemaFromAction(item)
        case 'Computed':
            return schemaFromComputed(item)
        case 'Image':
            return schemaConvert.schemaConvert(item, siblings, schemaContents)
        case 'Variable':
            return schemaFromVariable(item)
        case 'Pronouns':
            return schemaFromPronouns(item)
        case 'FirstImpression':
            return schemaFromFirstImpression(item, schemaContents as SchemaLiteralLegalContents[])
        case 'OneCoolThing':
            return schemaFromOneCoolThing(item, schemaContents as SchemaLiteralLegalContents[])
        case 'Outfit':
            return schemaFromOutfit(item, schemaContents as SchemaLiteralLegalContents[])
        case 'Character':
            return schemaFromCharacter(item, schemaContents as SchemaCharacterLegalContents[])
        case 'Whitespace':
            return schemaConvert.schemaConvert(item, siblings, schemaContents)
        case 'br':
            return schemaConvert.schemaConvert(item, siblings, schemaContents)
        case 'Space':
            return schemaConvert.schemaConvert(item, siblings, schemaContents)
        default:
            return {
                tag: 'String',
                value: '',
                parse: item
            }
    }
}

const exitContextCallback: TransformWithContextCallback = ((item: ParseTag, context: ParseTag[]): ParseTag => {
    if (isParseExit(item)) {
        const closestRoomTag = context.reduceRight<ParseRoomTag | undefined>((previous, contextItem) => (previous ? previous : (isParseRoom(contextItem) ? contextItem : undefined)), undefined)
        if (closestRoomTag) {
            const newTo = item.to || closestRoomTag.key
            const newFrom = item.from || closestRoomTag.key
            const newKey = item.key || `${newFrom}#${newTo}`
            if (newTo !== closestRoomTag.key && newFrom !== closestRoomTag.key) {
                throw new SchemaException(`Cannot assign both to (${newTo}) and from (${newFrom}) different from containing room (${closestRoomTag.key}) in Exit tag.`, item)
            }
            if (!(newTo && newFrom)) {
                throw new SchemaException('Exits must have both to and from properties (or be able to derive them from context)', item)
            }
            return {
                ...item,
                to: newTo,
                from: newFrom,
                key: newKey
            }
        }
    }
    return item
}) as TransformWithContextCallback

export const schemaFromParse = (tags: ParseTag[]): SchemaTag[] => {
    const firstPass = transformWithContext(tags, exitContextCallback)
    return firstPass.map((item) => (schemaFromParseItem(item, [])))
}