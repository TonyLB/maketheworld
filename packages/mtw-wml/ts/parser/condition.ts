import { ArrayContents } from "../types"
import { ParseTagFactory, ParseConditionTag, ParseConditionTypeFromContextTag, ParseStackTagEntry, parseDifferentiatingTags } from "./baseClasses"
import { validateProperties, ExtractProperties, validateContents, extractDependenciesFromJS } from "./utils"

export const parseConditionFactory = <T extends ParseConditionTag["contextTag"]>(contextTag: T): ParseTagFactory<ParseConditionTypeFromContextTag<'If', T>> => ({ open, contents, endTagToken }) => {
    const validate = validateProperties<ExtractProperties<ParseConditionTag, 'dependencies'>>({
        open,
        endTagToken,
        required: {
            if: ['expression']
        }
    })
    type ValidationType = ArrayContents<ParseConditionTypeFromContextTag<'If', T>["contents"]>
    const parsedContents = validateContents<ValidationType>({
        contents,
        legalTags: parseDifferentiatingTags[contextTag] as ValidationType["tag"][],
        ignoreTags: ['Comment', ...(('Whitespace' in parseDifferentiatingTags[contextTag]) ? [] : ['Whitespace'] as 'Whitespace'[])]
    }) as ParseConditionTypeFromContextTag<'If', T>["contents"]
    return {
        type: 'Tag',
        tag: {
            ...validate,
            tag: 'If',
            contextTag,
            startTagToken: open.startTagToken,
            endTagToken,
            contents: parsedContents,
            dependencies: extractDependenciesFromJS(validate.if)
        }
    } as ParseStackTagEntry<ParseConditionTypeFromContextTag<'If', T>>
}

export default parseConditionFactory
