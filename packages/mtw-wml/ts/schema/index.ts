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
    SchemaConditionMixin
} from "./baseClasses"
import schemaFromBookmark from "./bookmark"
import schemaFromCharacter, { schemaFromFirstImpression, schemaFromOneCoolThing, schemaFromOutfit, schemaFromPronouns } from "./character"
import schemaFromComputed from "./computed"
import schemaFromCondition, { SchemaConditionTagFromParse, schemaFromElse, schemaFromElseIf } from "./condition"
import schemaFromDescription from "./description"
import schemaFromFeature from "./feature"
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

type SchemaFromParseItemOptions = {
    failedConditions: SchemaConditionMixin["conditions"];
    setFailedConditions: (value: SchemaConditionMixin["conditions"]) => void;
}

const schemaConvert = new WMLConverter()

function schemaFromParseItem(item: ParseAssetTag, siblings: SchemaTag[], options: SchemaFromParseItemOptions): SchemaAssetTag
function schemaFromParseItem(item: ParseStoryTag, siblings: SchemaTag[], options: SchemaFromParseItemOptions): SchemaStoryTag
function schemaFromParseItem(item: ParseMapTag, siblings: SchemaTag[], options: SchemaFromParseItemOptions): SchemaMapTag
function schemaFromParseItem(item: ParseImportTag, siblings: SchemaTag[], options: SchemaFromParseItemOptions): SchemaImportTag
function schemaFromParseItem(item: ParseUseTag, siblings: SchemaTag[], options: SchemaFromParseItemOptions): SchemaUseTag
function schemaFromParseItem(item: ParseExitTag, siblings: SchemaTag[], options: SchemaFromParseItemOptions): SchemaExitTag
function schemaFromParseItem(item: ParseRoomTag, siblings: SchemaTag[], options: SchemaFromParseItemOptions): SchemaRoomTag
function schemaFromParseItem(item: ParseNameTag, siblings: SchemaTag[], options: SchemaFromParseItemOptions): SchemaNameTag
function schemaFromParseItem(item: ParseStringTag, siblings: SchemaTag[], options: SchemaFromParseItemOptions): SchemaStringTag
function schemaFromParseItem(item: ParseDescriptionTag, siblings: SchemaTag[], options: SchemaFromParseItemOptions): SchemaDescriptionTag
function schemaFromParseItem(item: ParseFeatureTag, siblings: SchemaTag[], options: SchemaFromParseItemOptions): SchemaFeatureTag
function schemaFromParseItem(item: ParseLinkTag, siblings: SchemaTag[], options: SchemaFromParseItemOptions): SchemaLinkTag
function schemaFromParseItem(item: ParseConditionTag, siblings: SchemaTag[], options: SchemaFromParseItemOptions): SchemaConditionTag
function schemaFromParseItem(item: ParseActionTag, siblings: SchemaTag[], options: SchemaFromParseItemOptions): SchemaActionTag
function schemaFromParseItem(item: ParseComputedTag, siblings: SchemaTag[], options: SchemaFromParseItemOptions): SchemaComputedTag
function schemaFromParseItem(item: ParseImageTag, siblings: SchemaTag[], options: SchemaFromParseItemOptions): SchemaImageTag
function schemaFromParseItem(item: ParseVariableTag, siblings: SchemaTag[], options: SchemaFromParseItemOptions): SchemaVariableTag
function schemaFromParseItem(item: ParsePronounsTag, siblings: SchemaTag[], options: SchemaFromParseItemOptions): SchemaPronounsTag
function schemaFromParseItem(item: ParseFirstImpressionTag, siblings: SchemaTag[], options: SchemaFromParseItemOptions): SchemaFirstImpressionTag
function schemaFromParseItem(item: ParseOneCoolThingTag, siblings: SchemaTag[], options: SchemaFromParseItemOptions): SchemaOneCoolThingTag
function schemaFromParseItem(item: ParseOutfitTag, siblings: SchemaTag[], options: SchemaFromParseItemOptions): SchemaOutfitTag
function schemaFromParseItem(item: ParseCharacterTag, siblings: SchemaTag[], options: SchemaFromParseItemOptions): SchemaCharacterTag
function schemaFromParseItem(item: ParseTag, siblings: SchemaTag[], options: SchemaFromParseItemOptions): SchemaTag
function schemaFromParseItem(item: ParseTag, siblings: SchemaTag[], options: SchemaFromParseItemOptions): SchemaTag {
    let schemaContents: SchemaTag[] = []
    const { setFailedConditions } = options
    let failedConditions = options.failedConditions
    if (isParseTagNesting(item)) {
        let nestedFailedConditions: SchemaConditionMixin["conditions"] = []
        const setNestedFailedConditions = (conditions: SchemaConditionMixin["conditions"]): void => { nestedFailedConditions = conditions }
        schemaContents = (item.contents as any).reduce((previous, item) => ([
            ...previous,
            schemaFromParseItem(item, previous, { failedConditions: nestedFailedConditions, setFailedConditions: setNestedFailedConditions })
        ]), [] as SchemaTag[])
    }
    if (!(['If', 'Whitespace', 'Else', 'ElseIf'].includes(item.tag))) {
        setFailedConditions([])
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
            return schemaConvert.schemaConvert(item, siblings, schemaContents)
        case 'Room':
            return schemaFromRoom(item, schemaContents as SchemaRoomLegalContents[])
        case 'String':
            return schemaFromString(item)
        case 'Name':
            return schemaFromName(item, schemaContents as SchemaLiteralLegalContents[])
        case 'Description':
            return schemaFromDescription(item, schemaContents as SchemaTaggedMessageLegalContents[])
        case 'Bookmark':
            return schemaFromBookmark(item, schemaContents as SchemaTaggedMessageLegalContents[])
        case 'Feature':
            return schemaFromFeature(item, schemaContents as SchemaFeatureLegalContents[])
        case 'Link':
            return schemaFromLink(item, schemaContents as SchemaStringTag[])
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
    let failedConditions: SchemaConditionMixin["conditions"] = []
    const setFailedConditions = (conditions: SchemaConditionMixin["conditions"]): void => { failedConditions = conditions }
    return firstPass.map((item) => (schemaFromParseItem(item, [], { failedConditions, setFailedConditions })))
}