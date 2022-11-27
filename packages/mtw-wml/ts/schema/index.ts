import { stringify } from "uuid"
import { composeConvertersHelper } from "../convert/functionMixins"
import {
    isParseExit,
    isParseRoom,
    isParseTagNesting,
    ParseActionTag,
    ParseAssetTag,
    ParseCharacterTag,
    ParseCommentTag,
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

type SchemaFromParseItemOptions = {
    failedConditions: SchemaConditionMixin["conditions"];
    setFailedConditions: (value: SchemaConditionMixin["conditions"]) => void;
}

// const schemaFromParseItem = composeConvertersHelper(
//     (props) => ({
//         tag: 'String',
//         value: '',
//         parse: props as ParseCommentTag
//     } as SchemaStringTag),
//     {
//         typeGuard: isTypedParseTagOpen('Character' as 'Character'),
//         convert: parseCharacterFactory
//     },
//     {
//         typeGuard: isTypedParseTagOpen('Pronouns' as 'Pronouns'),
//         convert: parsePronounsFactory
//     },
//     {
//         typeGuard: isTypedParseTagOpen('Outfit' as 'Outfit'),
//         convert: parseOutfitFactory
//     },
//     {
//         typeGuard: isTypedParseTagOpen('OneCoolThing' as 'OneCoolThing'),
//         convert: parseOneCoolThingFactory
//     },
//     {
//         typeGuard: isTypedParseTagOpen('Image' as 'Image'),
//         convert: parseImageFactory
//     },
//     {
//         typeGuard: isTypedParseTagOpen('Asset' as 'Asset'),
//         convert: parseAssetFactory
//     },
//     {
//         typeGuard: isTypedParseTagOpen('Story' as 'Story'),
//         convert: parseStoryFactory
//     },
//     {
//         typeGuard: isTypedParseTagOpen('Room' as 'Room'),
//         convert: parseRoomFactory
//     },
//     {
//         typeGuard: isTypedParseTagOpen('Feature' as 'Feature'),
//         convert: parseFeatureFactory
//     },
//     {
//         typeGuard: isTypedParseTagOpen('If' as 'If'),
//         convert: wrapConditionalContext
//     },
//     {
//         typeGuard: isTypedParseTagOpen('ElseIf' as 'ElseIf'),
//         convert: wrapConditionalContext
//     },
//     {
//         typeGuard: isTypedParseTagOpen('Else' as 'Else'),
//         convert: wrapConditionalContext
//     },
//     {
//         typeGuard: isTypedParseTagOpen('Link' as 'Link'),
//         convert: parseLinkFactory
//     },
//     {
//         typeGuard: isTypedParseTagOpen('Bookmark' as 'Bookmark'),
//         convert: parseBookmarkFactory
//     },
//     {
//         typeGuard: isTypedParseTagOpen('br' as 'br'),
//         convert: parseLineBreakFactory
//     },
//     {
//         typeGuard: isTypedParseTagOpen('Space' as 'Space'),
//         convert: parseSpacerFactory
//     },
//     {
//         typeGuard: isTypedParseTagOpen('Description' as 'Description'),
//         convert: parseDescriptionFactory
//     },
//     {
//         typeGuard: isTypedParseTagOpen('Exit' as 'Exit'),
//         convert: parseExitFactory
//     },
//     {
//         typeGuard: isTypedParseTagOpen('Map' as 'Map'),
//         convert: parseMapFactory
//     },
//     {
//         typeGuard: isTypedParseTagOpen('Use' as 'Use'),
//         convert: parseUseFactory
//     },
//     {
//         typeGuard: isTypedParseTagOpen('Import' as 'Import'),
//         convert: parseImportFactory
//     },
//     {
//         typeGuard: isTypedParseTagOpen('Variable' as 'Variable'),
//         convert: parseVariableFactory
//     },
//     {
//         typeGuard: isTypedParseTagOpen('Computed' as 'Computed'),
//         convert: parseComputedFactory
//     },
//     {
//         typeGuard: isTypedParseTagOpen('Action' as 'Action'),
//         convert: parseActionFactory
//     },
//     {
//         typeGuard: isTypedParseTagOpen('Name' as 'Name'),
//         convert: parseNameFactory
//     },
// )

function schemaFromParseItem(item: ParseAssetTag, options: SchemaFromParseItemOptions): SchemaAssetTag
function schemaFromParseItem(item: ParseStoryTag, options: SchemaFromParseItemOptions): SchemaStoryTag
function schemaFromParseItem(item: ParseMapTag, options: SchemaFromParseItemOptions): SchemaMapTag
function schemaFromParseItem(item: ParseImportTag, options: SchemaFromParseItemOptions): SchemaImportTag
function schemaFromParseItem(item: ParseUseTag, options: SchemaFromParseItemOptions): SchemaUseTag
function schemaFromParseItem(item: ParseExitTag, options: SchemaFromParseItemOptions): SchemaExitTag
function schemaFromParseItem(item: ParseRoomTag, options: SchemaFromParseItemOptions): SchemaRoomTag
function schemaFromParseItem(item: ParseNameTag, options: SchemaFromParseItemOptions): SchemaNameTag
function schemaFromParseItem(item: ParseStringTag, options: SchemaFromParseItemOptions): SchemaStringTag
function schemaFromParseItem(item: ParseDescriptionTag, options: SchemaFromParseItemOptions): SchemaDescriptionTag
function schemaFromParseItem(item: ParseFeatureTag, options: SchemaFromParseItemOptions): SchemaFeatureTag
function schemaFromParseItem(item: ParseLinkTag, options: SchemaFromParseItemOptions): SchemaLinkTag
function schemaFromParseItem(item: ParseConditionTag, options: SchemaFromParseItemOptions): SchemaConditionTag
function schemaFromParseItem(item: ParseActionTag, options: SchemaFromParseItemOptions): SchemaActionTag
function schemaFromParseItem(item: ParseComputedTag, options: SchemaFromParseItemOptions): SchemaComputedTag
function schemaFromParseItem(item: ParseImageTag, options: SchemaFromParseItemOptions): SchemaImageTag
function schemaFromParseItem(item: ParseVariableTag, options: SchemaFromParseItemOptions): SchemaVariableTag
function schemaFromParseItem(item: ParsePronounsTag, options: SchemaFromParseItemOptions): SchemaPronounsTag
function schemaFromParseItem(item: ParseFirstImpressionTag, options: SchemaFromParseItemOptions): SchemaFirstImpressionTag
function schemaFromParseItem(item: ParseOneCoolThingTag, options: SchemaFromParseItemOptions): SchemaOneCoolThingTag
function schemaFromParseItem(item: ParseOutfitTag, options: SchemaFromParseItemOptions): SchemaOutfitTag
function schemaFromParseItem(item: ParseCharacterTag, options: SchemaFromParseItemOptions): SchemaCharacterTag
function schemaFromParseItem(item: ParseTag, options: SchemaFromParseItemOptions): SchemaTag
function schemaFromParseItem(item: ParseTag, options: SchemaFromParseItemOptions): SchemaTag {
    let schemaContents: SchemaTag[] = []
    const { setFailedConditions } = options
    let failedConditions = options.failedConditions
    if (isParseTagNesting(item)) {
        let nestedFailedConditions: SchemaConditionMixin["conditions"] = []
        const setNestedFailedConditions = (conditions: SchemaConditionMixin["conditions"]): void => { nestedFailedConditions = conditions }
        schemaContents = (item.contents as any).map((item) => (schemaFromParseItem(item, { failedConditions: nestedFailedConditions, setFailedConditions: setNestedFailedConditions })))
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
            return schemaFromExit(item, schemaContents as SchemaLiteralLegalContents[])
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
            setFailedConditions([{
                if: item.if,
                dependencies: item.dependencies
            }])
            return schemaFromCondition(item, schemaContents as SchemaConditionTagFromParse<typeof item>["contents"])
        case 'Else':
            if (!failedConditions.length) {
                throw new SchemaException('Else must follow a conditional', item)
            }
            const elseConditions = failedConditions.map((condition) => ({ ...condition, not: true }))
            return schemaFromElse(item, elseConditions, schemaContents as SchemaConditionTagFromParse<Omit<typeof item, 'tag'> & { tag: 'If'; if: string; dependencies: string[] }>["contents"])
        case 'ElseIf':
            if (!failedConditions.length) {
                throw new SchemaException('ElseIf must follow a conditional', item)
            }
            const elseIfConditions = failedConditions.map((condition) => ({ ...condition, not: true }))
            setFailedConditions([
                ...failedConditions,
                {
                    if: item.if,
                    dependencies: item.dependencies
                }
            ])
            return schemaFromElseIf(item, elseIfConditions, schemaContents as SchemaConditionTagFromParse<Omit<typeof item, 'tag'> & { tag: 'If'; if: string; dependencies: string[] }>["contents"])
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
    let failedConditions: SchemaConditionMixin["conditions"] = []
    const setFailedConditions = (conditions: SchemaConditionMixin["conditions"]): void => { failedConditions = conditions }
    return firstPass.map((item) => (schemaFromParseItem(item, { failedConditions, setFailedConditions })))
}