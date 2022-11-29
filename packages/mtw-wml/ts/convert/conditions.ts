import {
    isLegalParseConditionContextTag,
    isParseCondition,
    isParseConditionTagDescriptionContext,
    isParseElse,
    isParseElseIf,
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
import { isSchemaCondition, isSchemaWhitespace, SchemaConditionTag, SchemaException, SchemaTag, SchemaTaggedMessageIncomingContents } from "../schema/baseClasses"
import { SchemaConditionTagFromParse } from "../schema/condition"
import { translateTaggedMessageContents } from "../schema/taggedMessage"
import { ArrayContents } from "../types"
import { BaseConverter, Constructor, isTypedParseTagOpen, MixinInheritedParseParameters, MixinInheritedParseReturn, MixinInheritedSchemaContents, MixinInheritedSchemaParameters, MixinInheritedSchemaReturn } from "./functionMixins"
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
        override parseConvert(value: ParseTagFactoryPropsLimited<'If'>): ParseStackTagEntry<ParseConditionTag>
        override parseConvert(value: ParseTagFactoryPropsLimited<'ElseIf'>): ParseStackTagEntry<ParseElseIfTag>
        override parseConvert(value: ParseTagFactoryPropsLimited<'Else'>): ParseStackTagEntry<ParseElseTag>
        override parseConvert(value: MixinInheritedParseParameters<C>
            | ParseTagFactoryPropsLimited<'If'>
            | ParseTagFactoryPropsLimited<'ElseIf'>
            | ParseTagFactoryPropsLimited<'Else'>
            ): MixinInheritedParseReturn<C>
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
                const returnValue = (super.parseConvert as any)(value)
                if (!Boolean(returnValue)) {
                    throw new Error('Invalid parameter')
                }
                return returnValue as MixinInheritedParseReturn<C>
            }
        }

        override schemaConvert(value: ParseConditionTag | ParseElseIfTag | ParseElseTag, siblings: SchemaTag[], contents: SchemaTag[]): SchemaConditionTag
        override schemaConvert(
                value: MixinInheritedSchemaParameters<C> | ParseConditionTag | ParseElseIfTag | ParseElseTag,
                siblings: SchemaTag[],
                contents: MixinInheritedSchemaContents<C> | SchemaTag[]
            ): MixinInheritedSchemaReturn<C> | SchemaConditionTag {
            if (isParseCondition(value)) {
                return {
                    tag: 'If',
                    contextTag: value.contextTag,
                    conditions: [{
                        if: value.if,
                        dependencies: value.dependencies,    
                    }],
                    contents: (isParseConditionTagDescriptionContext(value))
                        ? translateTaggedMessageContents(contents as SchemaTaggedMessageIncomingContents[])
                        : contents,
                    parse: value
                } as unknown as SchemaConditionTagFromParse<typeof value>
            }
            else if (isParseElseIf(value) || isParseElse(value)) {
                const closestConditional = siblings.reduceRight<SchemaConditionTag | undefined>((previous, sibling) => {
                    if (previous) {
                        return previous
                    }
                    if (isSchemaWhitespace(sibling)) {
                        return previous
                    }
                    if (isSchemaCondition(sibling)) {
                        return sibling
                    }
                    throw new SchemaException('Else and ElseIf tags must follow conditional', value)
                }, undefined)
                const closestConditions = closestConditional.conditions.map((condition) => ({ ...condition, not: true }))
                if (isParseElseIf(value)) {
                    return {
                        tag: 'If',
                        contextTag: value.contextTag,
                        conditions: [
                            ...closestConditions,
                            {
                                if: value.if,
                                dependencies: value.dependencies
                            }
                        ],
                        contents: (isParseConditionTagDescriptionContext({ ...value, tag: 'If', if: '', dependencies: [] }))
                            ? translateTaggedMessageContents(contents as SchemaTaggedMessageIncomingContents[])
                            : contents,
                        parse: value
                    } as unknown as SchemaConditionTagFromParse<Omit<typeof value, 'tag'> & { tag: 'If' }>
                }
                else {
                    return {
                        tag: 'If',
                        contextTag: value.contextTag,
                        conditions: closestConditions,
                        contents: (isParseConditionTagDescriptionContext({ ...value, tag: 'If', if: '', dependencies: [] }))
                            ? translateTaggedMessageContents(contents as SchemaTaggedMessageIncomingContents[])
                            : contents,
                        parse: value
                    } as unknown as SchemaConditionTagFromParse<Omit<typeof value, 'tag'> & { tag: 'If'; if: string; dependencies: string[] }>
                }
            }
            else {
                const returnValue = (super.schemaConvert as any)(value, siblings, contents)
                if (!Boolean(returnValue)) {
                    throw new Error('Invalid parameter')
                }
                return returnValue as MixinInheritedSchemaReturn<C>
            }
        }
    }
}

export default ParseConditionsMixin
