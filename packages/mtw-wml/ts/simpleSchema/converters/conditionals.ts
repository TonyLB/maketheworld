import { deepEqual } from "../../lib/objects"
import { NormalConditionStatement } from "../../normalize/baseClasses"
import { isLegalParseConditionContextTag } from "../../parser/baseClasses"
import {
    SchemaConditionTag,
    SchemaTag,
    SchemaTaggedMessageIncomingContents,
    isSchemaAssetContents,
    isSchemaCondition,
    isSchemaFeatureIncomingContents,
    isSchemaKnowledgeIncomingContents,
    isSchemaMapContents,
    isSchemaRoomIncomingContents,
    isSchemaString,
    isSchemaTaggedMessageLegalContents
} from "../../schema/baseClasses"
import { translateTaggedMessageContents } from "../../schema/taggedMessage"
import { ParsePropertyTypes } from "../../simpleParser/baseClasses"
import { SchemaContextItem } from "../baseClasses"
import { ConverterMapEntry, PrintMapEntry, PrintMapEntryArguments, SchemaToWMLOptions } from "./baseClasses"
import { tagRender } from "./tagRender"
import { validateProperties, extractDependenciesFromJS } from "./utils"

export const conditionalSiblingsConditions = (contextStack: SchemaContextItem[], label: string) => {
    if (contextStack.length === 0) {
        throw new Error(`${label} cannot be a top-level component`)
    }
    const siblings = contextStack.slice(-1)[0].contents.filter((tag) => (!(isSchemaString(tag) && (!tag.value.trim()))))
    if (siblings.length === 0) {
        throw new Error(`${label} must follow an If or ElseIf tag`)
    }
    const nearestSibling = siblings.slice(-1)[0]
    if (isSchemaCondition(nearestSibling)) {
        if (nearestSibling.conditions.slice(-1)[0].not) {
            throw new Error(`${label} must follow an If or ElseIf tag`)
        }
    }
    else {
        console.log(`siblings: ${JSON.stringify(siblings, null, 4)}`)
        throw new Error(`${label} must follow an If or ElseIf tag`)
    }
    return nearestSibling.conditions
}

export const conditionLegalContents = (item, contextStack) => {
    const legalContextStack = contextStack.map(({ tag }) => (tag.tag)).filter(isLegalParseConditionContextTag)
    if (legalContextStack.length === 0) {
        throw new Error('Conditional items cannot be top-level')
    }
    const nearestLegalContext = legalContextStack.slice(-1)[0]
    switch(nearestLegalContext) {
        case 'Asset': return isSchemaAssetContents(item)
        case 'Bookmark':
        case 'Description': return isSchemaTaggedMessageLegalContents(item)
        case 'Feature': return isSchemaFeatureIncomingContents(item)
        case 'Knowledge': return isSchemaKnowledgeIncomingContents(item)
        case 'Map': return isSchemaMapContents(item)
        case 'Room': return isSchemaRoomIncomingContents(item)
        default: return false
    }
}

export const conditionFinalize = (initialTag: SchemaConditionTag, contents: SchemaTag[], contextStack: SchemaContextItem[]): SchemaConditionTag => {
    const legalContextStack = contextStack.map(({ tag }) => (tag.tag)).filter(isLegalParseConditionContextTag)
    if (legalContextStack.length === 0) {
        throw new Error('Conditional items cannot be top-level')
    }
    const nearestLegalContext = legalContextStack.slice(-1)[0]
    return {
        ...initialTag,
        contextTag: nearestLegalContext === 'Bookmark' ? 'Description' : nearestLegalContext,
        contents: (['Bookmark', 'Description'].includes(nearestLegalContext))
            ? translateTaggedMessageContents(contents as SchemaTaggedMessageIncomingContents[])
            : contents as any
    }
}

const conditionalTemplates = {
    If: {
        DEFAULT: { required: true, type: ParsePropertyTypes.Expression },
    },
    ElseIf: {
        DEFAULT: { required: true, type: ParsePropertyTypes.Expression },
    },
    Else: {}
} as const

export const conditionalConverters: Record<string, ConverterMapEntry> = {
    If: {
        initialize: ({ parseOpen }): SchemaConditionTag => {
            const validatedProperties = validateProperties(conditionalTemplates.If)(parseOpen)
            return {
                tag: 'If',
                contextTag: 'Asset',
                contents: [],
                conditions: [{ if: validatedProperties.DEFAULT, dependencies: extractDependenciesFromJS(validatedProperties.DEFAULT) }]
            }
        },
        legalContents: conditionLegalContents,
        finalize: conditionFinalize
    },
    ElseIf: {
        initialize: ({ parseOpen, contextStack }): SchemaConditionTag => {
            const siblingConditions = conditionalSiblingsConditions(contextStack, 'ElseIf')
            const validatedProperties = validateProperties(conditionalTemplates.ElseIf)(parseOpen)
            return {
                tag: 'If',
                contextTag: 'Asset',
                contents: [],
                conditions: [...(siblingConditions.map((condition) => ({ ...condition, not: true }))), { if: validatedProperties.DEFAULT, dependencies: extractDependenciesFromJS(validatedProperties.DEFAULT) }],
            }
        },
        legalContents: conditionLegalContents,
        finalize: conditionFinalize
    },
    Else: {
        initialize: ({ parseOpen, contextStack }): SchemaConditionTag => {
            const siblingConditions = conditionalSiblingsConditions(contextStack, 'Else')
            validateProperties(conditionalTemplates.Else)(parseOpen)
            return {
                tag: 'If',
                contextTag: 'Asset',
                contents: [],
                conditions: siblingConditions.map((condition) => ({ ...condition, not: true }))
            }
        },
        legalContents: conditionLegalContents,
        finalize: conditionFinalize
    },
}

export const conditionalPrintMap: Record<string, PrintMapEntry> = {
    If: ({ tag, ...args }: PrintMapEntryArguments & { tag: SchemaConditionTag }) => {

        const { siblings = [] } = args.options
        const closestSibling: SchemaTag | undefined = siblings.length ? siblings.slice(-1)[0] : undefined
        const conditionsToSrc = (conditions: NormalConditionStatement[]): string => {
            if (!conditions.length) { return '' }
            if (conditions.length > 1) {
                return conditions.map((condition) => (condition.not ? `!(${condition.if})` : `(${condition.if})`)).join(' && ')
            }
            else {
                const condition = conditions[0]
                return condition.not ? `!(${condition.if})` : condition.if
            }
        }
        //
        // Evaluate whether closestSibling is a SchemaConditionTag, all of whose conditions
        // are replicated (with not flags) in the value we're currently examining, and if so
        // parse out whether it should be an ElseIf tag or an Else tag.
        //
        if (closestSibling &&
            isSchemaCondition(closestSibling) &&
            (tag.conditions.length >= closestSibling.conditions.length) &&
            deepEqual(closestSibling.conditions.map((condition) => ({ ...condition, not: true })), tag.conditions.slice(0, closestSibling.conditions.length))
        ) {
            //
            // In this sub-branch, the condition being considered is an extension of its closestSibling
            //
            const remainingConditions = tag.conditions.slice(closestSibling.conditions.length)
            if (remainingConditions.length) {
                //
                // In this sub-branch, there are additional conditions beyond those of its closestSibling,
                // which conditions indicate that it is an ElseIf clause
                //
                return tagRender({
                    ...args,
                    tag: 'ElseIf',
                    properties: [
                        { type: 'expression', value: conditionsToSrc(remainingConditions) }
                    ],
                    contents: tag.contents,
                })
            }
            else {
                //
                // In this sub-branch, there are no additional conditions, so it is an Else clause
                //
                return tagRender({
                    ...args,
                    tag: 'Else',
                    properties: [],
                    contents: tag.contents,
                })
            }
        }
        //
        // Since there is no match to the closestSibling, this is a new If clause (even if it follows a
        // differently-specified If clause).
        //
        return tagRender({
            ...args,
            tag: 'If',
            properties: [
                { type: 'expression', value: conditionsToSrc(tag.conditions) }
            ],
            contents: tag.contents,
        })
    }
}