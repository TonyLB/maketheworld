import { ArrayContents } from "../types"
import { ParseTagFactory, ParseConditionTag, ParseConditionTypeFromContextTag, ParseStackTagEntry, parseDifferentiatingTags } from "./baseClasses"
import { validateProperties, ExtractProperties, validateContents, extractDependenciesFromJS } from "./utils"

export const parseElseIfFactory = <T extends ParseConditionTag["contextTag"]>(contextTag: T): ParseTagFactory<ParseConditionTypeFromContextTag<'ElseIf', T>> => ({ open, contents, endTagToken }) => {
    const validate = validateProperties<ExtractProperties<ParseConditionTag, 'dependencies'>>({
        open,
        endTagToken,
        required: {
            if: ['expression']
        }
    })
    type ValidationType = ArrayContents<ParseConditionTypeFromContextTag<'ElseIf', T>["contents"]>
    const parsedContents = validateContents<ValidationType>({
        contents,
        legalTags: parseDifferentiatingTags[contextTag] as ValidationType["tag"][],
        ignoreTags: ['Comment', ...(('Whitespace' in parseDifferentiatingTags[contextTag]) ? [] : ['Whitespace'] as 'Whitespace'[])]
    }) as ParseConditionTypeFromContextTag<'ElseIf', T>["contents"]
    return {
        type: 'Tag',
        tag: {
            ...validate,
            tag: 'ElseIf',
            contextTag,
            startTagToken: open.startTagToken,
            endTagToken,
            contents: parsedContents,
            dependencies: extractDependenciesFromJS(validate.if)
        }
    } as ParseStackTagEntry<ParseConditionTypeFromContextTag<'ElseIf', T>>
}

export default parseElseIfFactory
