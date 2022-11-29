import {
    isLegalParseConditionContextTag,
    ParseConditionLegalContextTag,
    ParseConditionTag,
    ParseConditionTypeFromContextTag,
    parseDifferentiatingTags,
    ParseElseIfTag,
    ParseElseTag,
    ParseStackTagEntry,
    ParseStackTagOpenEntry,
    ParseTagFactory,
    ParseTagFactoryPropsLimited
} from "../parser/baseClasses"
import { ArrayContents } from "../types"
import { BaseConverter, Constructor, isTypedParseTagOpen, MixinInheritedParameters, MixinInheritedReturn } from "./functionMixins"
import { extractDependenciesFromJS, ExtractProperties, validateContents, validateProperties } from "./utils"

const extractContextTag = (context: ParseStackTagOpenEntry[]): ParseConditionLegalContextTag => {
    const contextTagRaw = context.reduce<ParseConditionLegalContextTag>((previous, item) => {
        const tag = item.tag
        if (isLegalParseConditionContextTag(tag)) {
            return tag
        }
        return previous
    }, undefined)
    return contextTagRaw === 'Bookmark' ? 'Description' : contextTagRaw    
}

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

export const ParseConditionsMixin = <C extends Constructor<BaseConverter>>(Base: C) => {
    return class ParseConditionsMixin extends Base {
        override convert(value: ParseTagFactoryPropsLimited<'If'>): ParseStackTagEntry<ParseConditionTag>
        override convert(value: ParseTagFactoryPropsLimited<'ElseIf'>): ParseStackTagEntry<ParseElseIfTag>
        override convert(value: ParseTagFactoryPropsLimited<'Else'>): ParseStackTagEntry<ParseElseTag>
        override convert(value: MixinInheritedParameters<C>
            | ParseTagFactoryPropsLimited<'If'>
            | ParseTagFactoryPropsLimited<'ElseIf'>
            | ParseTagFactoryPropsLimited<'Else'>
            ): MixinInheritedReturn<C>
            | ParseStackTagEntry<ParseConditionTag>
            | ParseStackTagEntry<ParseElseIfTag>
            | ParseStackTagEntry<ParseElseTag>
            {
            //
            // Convert If tag-opens
            //
            if (isTypedParseTagOpen('If')(value)) {
                const contextTag = extractContextTag(value.context)
                return parseConditionFactory(contextTag)(value)
            }
            //
            // Convert ElseIf tag-opens
            //
            if (isTypedParseTagOpen('ElseIf')(value)) {
                const contextTag = extractContextTag(value.context)
                return parseElseIfFactory(contextTag)(value)
            }
            //
            // Convert Else tag-opens
            //
            if (isTypedParseTagOpen('Else')(value)) {
                const contextTag = extractContextTag(value.context)
                return parseElseFactory(contextTag)(value)
            }
            else {
                const returnValue = (super.convert as any)(value)
                if (!Boolean(returnValue)) {
                    throw new Error('Invalid parameter')
                }
                return returnValue as MixinInheritedReturn<C>
            }
        }
    }
}

export default ParseConditionsMixin
