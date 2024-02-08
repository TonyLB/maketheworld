import {
    SchemaConditionFallthroughTag,
    SchemaConditionStatementTag,
    SchemaTag,
    isSchemaCondition,
    isSchemaConditionFallthrough,
    isSchemaConditionStatement
} from "../baseClasses"
import { ParsePropertyTypes } from "../../simpleParser/baseClasses"
import { ConverterMapEntry, PrintMapEntry, PrintMapEntryArguments } from "./baseClasses"
import { tagRender } from "./tagRender"
import { validateProperties } from "./utils"
import { GenericTree } from "../../tree/baseClasses"

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
}

export const conditionalPrintMap: Record<string, PrintMapEntry> = {
    Statement: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments) => {
        if (!isSchemaConditionStatement(tag)) {
            return ''
        }
        const siblings = args.options.siblings ?? []
        if (siblings.length === 0) {
            return tagRender({
                ...args,
                tag: 'If',
                properties: [{ type: 'expression', value: tag.if }],
                contents: children
            })    
        }
        else {
            return tagRender({
                ...args,
                tag: 'ElseIf',
                properties: [{ type: 'expression', value: tag.if }],
                contents: children
            })    
        }
    },
    Fallthrough: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments) => {
        if (!isSchemaConditionFallthrough(tag)) {
            return ''
        }
        return tagRender({
            ...args,
            tag: 'Else',
            properties: [],
            contents: children
        })    
    },
    If: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments) => {

        if (!isSchemaCondition(tag)) {
            return ''
        }
        //
        // TODO: Figure out how to join lines together with proper amount of indent
        //
        const { returnValue } = children.reduce<{ returnValue: string[]; siblings: GenericTree<SchemaTag> }>((previous, tag) => {
            return {
                returnValue: [
                    ...previous.returnValue,
                    args.schemaToWML({
                        ...args,
                        options: {
                            ...args.options,
                            siblings: previous.siblings,
                            context: [...args.options.context, { tag: 'If' }]
                        },
                        tag
                    })
                ],
                siblings: [
                    ...previous.siblings,
                    tag
                ]
            }
        }, { returnValue: [], siblings: [] })
        return returnValue.join('\n')
    }
}