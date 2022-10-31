import { ArrayContents } from "../types"
import { ParseTagFactory, ParseConditionTag, isParseTagDependency, ParseConditionTypeFromContextTag, ParseStackTagEntry, parseDifferentiatingTags } from "./baseClasses"
import { validateProperties, ExtractProperties, validateContents } from "./utils"

//
// TODO: Figure out how to sub-type different conditions to have different legal contents
//
export const parseConditionFactory = <T extends ParseConditionTag["contextTag"]>(contextTag: T): ParseTagFactory<ParseConditionTypeFromContextTag<T>> => ({ open, contents, endTagToken }) => {
    const validate = validateProperties<ExtractProperties<ParseConditionTag, 'dependencies'>>({
        open,
        endTagToken,
        required: {
            if: ['expression']
        }
    })
    const dependencies = contents.filter(isParseTagDependency)
    const nonDependencyContents = contents.filter((value) => (!isParseTagDependency(value)))
    type ValidationType = ArrayContents<ParseConditionTypeFromContextTag<T>["contents"]>
    console.log(`If legal tags(${contextTag}): ${JSON.stringify(parseDifferentiatingTags[contextTag], null, 4)}`)
    const parsedContents = validateContents<ValidationType>({
        contents: nonDependencyContents,
        legalTags: parseDifferentiatingTags[contextTag] as ValidationType["tag"][],
        ignoreTags: ['Comment', ...(('Whitespace' in parseDifferentiatingTags[contextTag]) ? [] : ['Whitespace'] as 'Whitespace'[])]
    }) as ParseConditionTypeFromContextTag<T>["contents"]
    return {
        type: 'Tag',
        tag: {
            ...validate,
            tag: 'If',
            contextTag,
            startTagToken: open.startTagToken,
            endTagToken,
            contents: parsedContents,
            dependencies
        }
    } as ParseStackTagEntry<ParseConditionTypeFromContextTag<T>>
}

export default parseConditionFactory
