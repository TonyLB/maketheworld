import WMLConverter from "../convert"
import {
    isParseComment,
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
import {
    SchemaActionTag,
    SchemaAssetTag,
    SchemaCharacterTag,
    SchemaComputedTag,
    SchemaConditionTag,
    SchemaDescriptionTag,
    SchemaException,
    SchemaExitTag,
    SchemaFeatureTag,
    SchemaFirstImpressionTag,
    SchemaImageTag,
    SchemaImportTag,
    SchemaLinkTag,
    SchemaMapTag,
    SchemaNameTag,
    SchemaOneCoolThingTag,
    SchemaOutfitTag,
    SchemaPronounsTag,
    SchemaRoomTag,
    SchemaStoryTag,
    SchemaStringTag,
    SchemaTag,
    SchemaUseTag,
    SchemaVariableTag,
} from "./baseClasses"
import { transformWithContext, TransformWithContextCallback } from "./utils"

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
    return schemaConvert.schemaConvert(
        item,
        siblings,
        isParseTagNesting(item)
            ? (item.contents as any).reduce((previous, item) => ([
                ...previous,
                schemaFromParseItem(item, previous)
            ]), [] as SchemaTag[])
            : []
    )
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