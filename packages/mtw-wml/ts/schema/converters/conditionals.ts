import { ParsePropertyTypes } from "../../simpleParser/baseClasses"
import { ConverterMapEntry } from "./baseClasses"
import { validateProperties } from "./utils"
import { GenericTree } from "@tonylb/mtw-base/ts/genericTree"
import { isSchemaCondition, isSchemaConditionFallthrough, isSchemaConditionStatement, SchemaConditionFallthroughTag, SchemaConditionStatementTag } from "@tonylb/mtw-base/ts/schema/condition"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"

const conditionalTemplates = {
    If: {
        DEFAULT: { required: true, type: ParsePropertyTypes.Expression },
        selected: { required: false, type: ParsePropertyTypes.Boolean }
    },
    ElseIf: {
        DEFAULT: { required: true, type: ParsePropertyTypes.Expression },
        selected: { required: false, type: ParsePropertyTypes.Boolean }
    },
    Else: {
        selected: { required: false, type: ParsePropertyTypes.Boolean }
    }
} as const

export const conditionalConverters: Record<string, ConverterMapEntry> = {
    If: {
        initialize: ({ parseOpen }): SchemaConditionStatementTag => {
            const validatedProperties = validateProperties(conditionalTemplates.If)(parseOpen)
            return {
                tag: 'Statement',
                if: validatedProperties.DEFAULT,
                ...(validatedProperties.selected ? { selected: true } : {} )
            }
        },
        wrapper: 'If'
    },
    Statement: {
        initialize: ({ parseOpen }): SchemaConditionStatementTag => {
            const validatedProperties = validateProperties(conditionalTemplates.ElseIf)(parseOpen)
            return {
                tag: 'Statement',
                if: validatedProperties.DEFAULT,
                ...(validatedProperties.selected ? { selected: true } : {} )
            }
        },
        wrapper: 'If',
        aggregate: (previous, node) => {
            const nearestSibling = previous.children.length ? previous.children.slice(-1)[0].data : undefined
            if (nearestSibling && isSchemaConditionFallthrough(nearestSibling)) {
                throw new Error(`Elsif must follow an If or Elsif`)
            }
            return {
                ...previous,
                children: [...previous.children, node]
            }
        }
    },
    ElseIf: {
        initialize: ({ parseOpen }): SchemaConditionStatementTag => {
            const validatedProperties = validateProperties(conditionalTemplates.ElseIf)(parseOpen)
            return {
                tag: 'Statement',
                if: validatedProperties.DEFAULT,
                ...(validatedProperties.selected ? { selected: true } : {} )
            }
        },
        wrapper: 'If',
        aggregate: (previous, node) => {
            const nearestSibling = previous.children.length ? previous.children.slice(-1)[0].data : undefined
            if (nearestSibling && isSchemaConditionFallthrough(nearestSibling)) {
                throw new Error(`Elsif must follow an If or Elsif`)
            }
            return {
                ...previous,
                children: [...previous.children, node]
            }
        }
    },
    Else: {
        initialize: ({ parseOpen }): SchemaConditionFallthroughTag => {
            const validatedProperties = validateProperties(conditionalTemplates.Else)(parseOpen)
            return {
                tag: 'Fallthrough',
                ...(validatedProperties.selected ? { selected: true } : {} )
            }
        },
        wrapper: 'If',
        aggregate: (previous, node) => {
            if (previous.children.length === 0) {
                throw new Error(`Else must be part of a "If" grouping`)
            }
            const nearestSibling = previous.children.slice(-1)[0].data
            if (isSchemaConditionFallthrough(nearestSibling)) {
                throw new Error(`Else must follow an If or Elsif`)
            }
            return {
                ...previous,
                children: [...previous.children, node]
            }
        }
    },
    Fallthrough: {
        initialize: ({ parseOpen }): SchemaConditionFallthroughTag => {
            const validatedProperties = validateProperties(conditionalTemplates.Else)(parseOpen)
            return {
                tag: 'Fallthrough',
                ...(validatedProperties.selected ? { selected: true } : {} )
            }
        },
        wrapper: 'If',
        aggregate: (previous, node) => {
            if (previous.children.length === 0) {
                throw new Error(`Else must be part of a "If" grouping`)
            }
            const nearestSibling = previous.children.slice(-1)[0].data
            if (isSchemaConditionFallthrough(nearestSibling)) {
                throw new Error(`Else must follow an If or Elsif`)
            }
            return {
                ...previous,
                children: [...previous.children, node]
            }
        }
    }
}