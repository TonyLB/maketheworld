import { ArrayContents } from "../types"
import { ParseTagFactory, ParseConditionTag, ParseConditionTypeFromContextTag, ParseStackTagEntry, parseDifferentiatingTags } from "./baseClasses"
import { validateProperties, ExtractProperties, validateContents, extractDependenciesFromJS } from "./utils"

export const parseElseFactory = <T extends ParseConditionTag["contextTag"]>(contextTag: T): ParseTagFactory<ParseConditionTypeFromContextTag<'Else', T>> => ({ open, contents, endTagToken }) => {
    const validate = validateProperties<ExtractProperties<ParseConditionTag, 'dependencies'>>({
        open,
        endTagToken,
        required: {}
    })
    type ValidationType = ArrayContents<ParseConditionTypeFromContextTag<'Else', T>["contents"]>
    const parsedContents = validateContents<ValidationType>({
        contents,
        legalTags: parseDifferentiatingTags[contextTag] as ValidationType["tag"][],
        ignoreTags: ['Comment', ...(('Whitespace' in parseDifferentiatingTags[contextTag]) ? [] : ['Whitespace'] as 'Whitespace'[])]
    }) as ParseConditionTypeFromContextTag<'Else', T>["contents"]
    return {
        type: 'Tag',
        tag: {
            ...validate,
            tag: 'Else',
            contextTag,
            startTagToken: open.startTagToken,
            endTagToken,
            contents: parsedContents
        }
    } as ParseStackTagEntry<ParseConditionTypeFromContextTag<'Else', T>>
}

export default parseElseFactory
