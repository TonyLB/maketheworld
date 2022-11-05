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
    SchemaConditionMixin
} from "./baseClasses"
import schemaFromCharacter, { schemaFromFirstImpression, schemaFromOneCoolThing, schemaFromOutfit, schemaFromPronouns } from "./character"
import schemaFromComputed from "./computed"
import schemaFromCondition, { SchemaConditionTagFromParse } from "./condition"
import schemaFromDescription from "./description"
import schemaFromExit from "./exit"
import schemaFromFeature from "./feature"
import schemaFromImage from "./image"
import schemaFromImport from "./import"
import schemaFromLink from "./link"
import schemaFromMap from "./map"
import schemaFromName from "./name"
import schemaFromRoom from "./room"
import schemaFromString from "./string"
import schemaFromUse from "./use"
import { transformWithContext, TransformWithContextCallback } from "./utils"
import schemaFromVariable from "./variable"
import { schemaFromLineBreak, schemaFromSpacer, schemaFromWhitespace } from "./whiteSpace"

function schemaFromParseItem(item: ParseAssetTag): SchemaAssetTag
function schemaFromParseItem(item: ParseStoryTag): SchemaStoryTag
function schemaFromParseItem(item: ParseMapTag): SchemaMapTag
function schemaFromParseItem(item: ParseImportTag): SchemaImportTag
function schemaFromParseItem(item: ParseUseTag): SchemaUseTag
function schemaFromParseItem(item: ParseExitTag): SchemaExitTag
function schemaFromParseItem(item: ParseRoomTag): SchemaRoomTag
function schemaFromParseItem(item: ParseNameTag): SchemaNameTag
function schemaFromParseItem(item: ParseStringTag): SchemaStringTag
function schemaFromParseItem(item: ParseDescriptionTag): SchemaDescriptionTag
function schemaFromParseItem(item: ParseFeatureTag): SchemaFeatureTag
function schemaFromParseItem(item: ParseLinkTag): SchemaLinkTag
function schemaFromParseItem(item: ParseConditionTag): SchemaConditionTag
function schemaFromParseItem(item: ParseActionTag): SchemaActionTag
function schemaFromParseItem(item: ParseComputedTag): SchemaComputedTag
function schemaFromParseItem(item: ParseImageTag): SchemaImageTag
function schemaFromParseItem(item: ParseVariableTag): SchemaVariableTag
function schemaFromParseItem(item: ParsePronounsTag): SchemaPronounsTag
function schemaFromParseItem(item: ParseFirstImpressionTag): SchemaFirstImpressionTag
function schemaFromParseItem(item: ParseOneCoolThingTag): SchemaOneCoolThingTag
function schemaFromParseItem(item: ParseOutfitTag): SchemaOutfitTag
function schemaFromParseItem(item: ParseCharacterTag): SchemaCharacterTag
function schemaFromParseItem(item: ParseTag): SchemaTag
function schemaFromParseItem(item: ParseTag): SchemaTag {
    let schemaContents: SchemaTag[] = []
    let failedConditions: SchemaConditionMixin["conditions"] = []
    if (isParseTagNesting(item)) {
        schemaContents = (item.contents as any).map(schemaFromParseItem)
    }
    if (!(['If', 'Whitespace'].includes(item.tag))) {
        failedConditions = []
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
            return schemaFromExit(item, schemaContents as SchemaLiteralLegalContents[])
        case 'Room':
            return schemaFromRoom(item, schemaContents as SchemaRoomLegalContents[])
        case 'String':
            return schemaFromString(item)
        case 'Name':
            return schemaFromName(item, schemaContents as SchemaLiteralLegalContents[])
        case 'Description':
            return schemaFromDescription(item, schemaContents as SchemaTaggedMessageLegalContents[])
        case 'Feature':
            return schemaFromFeature(item, schemaContents as SchemaFeatureLegalContents[])
        case 'Link':
            return schemaFromLink(item, schemaContents as SchemaStringTag[])
        case 'If':
            failedConditions = [{
                if: item.if,
                dependencies: item.dependencies
            }]
            return schemaFromCondition(item, schemaContents as SchemaConditionTagFromParse<typeof item>["contents"])
        case 'Action':
            return schemaFromAction(item)
        case 'Computed':
            return schemaFromComputed(item)
        case 'Image':
            return schemaFromImage(item)
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
            return schemaFromWhitespace(item)
        case 'br':
            return schemaFromLineBreak(item)
        case 'Space':
            return schemaFromSpacer(item)
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
    return firstPass.map(schemaFromParseItem)
}