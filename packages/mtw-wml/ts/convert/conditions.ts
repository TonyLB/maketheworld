import { isLegalParseConditionContextTag, ParseConditionLegalContextTag, ParseConditionTag, ParseConditionTypeFromContextTag, parseDifferentiatingTags, ParseElseTag, ParseStackTagEntry, ParseStackTagOpenEntry, ParseTagFactory, ParseTagFactoryPropsLimited } from "../parser/baseClasses"
import { ArrayContents } from "../types"
import { BaseConverter, Constructor, ConverterMixinFactory, isTypedParseTagOpen, SimpleParseConverterMixinFactory } from "./functionMixins"
import { extractDependenciesFromJS, ExtractProperties, ForceStringType, validateContents, validateProperties } from "./utils"

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

const ParseIfMixin = ConverterMixinFactory({
    typeGuard: isTypedParseTagOpen('If'),
    convert: (props: ParseTagFactoryPropsLimited<'If'>) => {
        const contextTag = extractContextTag(props.context)
        return parseConditionFactory(contextTag)(props)
    }
})

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

const ParseElseIfMixin = ConverterMixinFactory({
    typeGuard: isTypedParseTagOpen('ElseIf'),
    convert: (props: ParseTagFactoryPropsLimited<'ElseIf'>) => {
        const contextTag = extractContextTag(props.context)
        return parseElseIfFactory(contextTag)(props)
    }
})

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

const ParseElseMixin = ConverterMixinFactory({
    typeGuard: isTypedParseTagOpen('Else'),
    convert: (props: ParseTagFactoryPropsLimited<'Else'>) => {
        const contextTag = extractContextTag(props.context)
        return parseElseFactory(contextTag)(props)
    }
})

export const ParseConditionsMixin = <C extends Constructor<BaseConverter>>(Base: C) => (
    ParseIfMixin(
    ParseElseIfMixin(
    ParseElseMixin(
        Base
    )))
)

export default ParseConditionsMixin
