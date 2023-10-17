import { extractDependenciesFromJS } from "../../convert/utils"
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
    isSchemaTaggedMessageLegalContents
} from "../../schema/baseClasses"
import { translateTaggedMessageContents } from "../../schema/taggedMessage"
import { ParsePropertyTypes } from "../../simpleParser/baseClasses"
import { SchemaContextItem } from "../baseClasses"
import { ConverterMapEntry } from "./baseClasses"
import { validateProperties } from "./utils"

export const conditionalSiblingsConditions = (contextStack: SchemaContextItem[]) => {
    if (contextStack.length === 0) {
        throw new Error('ElseIf cannot be a top-level component')
    }
    const siblings = contextStack.slice(-1)[0].contents
    if (siblings.length === 0) {
        throw new Error('ElseIf must follow an If or ElseIf tag')
    }
    const nearestSibling = siblings.slice(-1)[0]
    if (isSchemaCondition(nearestSibling)) {
        if (nearestSibling.conditions.slice(-1)[0].not) {
            throw new Error('ElseIf must follow an If or ElseIf tag')
        }
    }
    else {
        throw new Error('ElseIf must follow an If or ElseIf tag')
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
            const siblingConditions = conditionalSiblingsConditions(contextStack)
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
            const siblingConditions = conditionalSiblingsConditions(contextStack)
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
