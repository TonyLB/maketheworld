import {
    SchemaConditionFallthroughTag,
    SchemaConditionStatementTag,
    SchemaTag,
    isSchemaCondition,
    isSchemaConditionFallthrough,
    isSchemaConditionStatement
} from "../baseClasses"
import { ParsePropertyTypes } from "../../simpleParser/baseClasses"
import { ConverterMapEntry, PrintMapEntry, PrintMapEntryArguments, PrintMapResult, PrintMode } from "./baseClasses"
import { extractConditionContextTag, tagRender, tagRenderContents } from "./tagRender"
import { validateProperties } from "./utils"
import { GenericTree } from "../../tree/baseClasses"
import { wrapperCombine } from "./quantumRender/combine"

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
        initialize: ({ parseOpen }): SchemaConditionStatementTag => {
            const validatedProperties = validateProperties(conditionalTemplates.If)(parseOpen)
            return {
                tag: 'Statement',
                if: validatedProperties.DEFAULT
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
        initialize: (): SchemaConditionFallthroughTag => {
            return { tag: 'Fallthrough' }
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
        initialize: (): SchemaConditionFallthroughTag => {
            return { tag: 'Fallthrough' }
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

export const conditionalPrintMap: Record<string, PrintMapEntry> = {
    Statement: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments) => {
        if (!isSchemaConditionStatement(tag)) {
            return [{ printMode: PrintMode.naive, output: '' }]
        }
        const siblings = args.options.siblings ?? []
        if (siblings.length === 0) {
            return tagRender({
                ...args,
                tag: 'If',
                properties: [{ type: 'expression', value: tag.if }],
                node: { data: tag, children }
            })    
        }
        else {
            return tagRender({
                ...args,
                tag: 'ElseIf',
                properties: [{ type: 'expression', value: tag.if }],
                node: { data: tag, children }
            })    
        }
    },
    Fallthrough: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments) => {
        if (!isSchemaConditionFallthrough(tag)) {
            return [{ printMode: PrintMode.naive, output: '' }]
        }
        return tagRender({
            ...args,
            tag: 'Else',
            properties: [],
            node: { data: tag, children }
        })    
    },
    If: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments) => {
        if (!isSchemaCondition(tag)) {
            return [{ printMode: PrintMode.naive, output: '' }]
        }
        const outputs: PrintMapResult[][] = children
            .reduce<{ returnValue: PrintMapResult[][]; siblings: GenericTree<SchemaTag> }>((previous, node) => {
                const newOptions = { ...args.options, siblings: previous.siblings, context: [...args.options.context, node.data] }
                const newOutput = args.schemaToWML({ tag: node, ...args, options: newOptions })
                return {
                    returnValue: [...previous.returnValue, newOutput],
                    siblings: [...previous.siblings, node]
                }
            }, { returnValue: [], siblings: [] }).returnValue
        return wrapperCombine(...outputs)
    }
}