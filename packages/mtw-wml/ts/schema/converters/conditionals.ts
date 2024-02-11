import {
    SchemaConditionFallthroughTag,
    SchemaConditionStatementTag,
    SchemaTag,
    isSchemaCondition,
    isSchemaConditionFallthrough,
    isSchemaConditionStatement
} from "../baseClasses"
import { ParsePropertyTypes } from "../../simpleParser/baseClasses"
import { ConverterMapEntry, PrintMapEntry, PrintMapEntryArguments, PrintMapOptionsChange, PrintMode } from "./baseClasses"
import { extractConditionContextTag, tagRender, tagRenderContents } from "./tagRender"
import { maxIndicesByNestingLevel, minIndicesByNestingLevel, provisionalPrintFactory } from "./printUtils"
import { indentSpacing, lineLengthAfterIndent } from "./printUtils"
import { validateProperties } from "./utils"

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
            return ['']
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
            return ['']
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
            return ['']
        }
        //
        // TODO: Abstract this functionality to prevent repeating similar functionality in tagRender
        //
        const descriptionContext = ["Description", "Name", "FirstImpression", "OneCoolThing", "Outfit"].includes(extractConditionContextTag(args.options.context) || '')
        const mappedContents = tagRenderContents({ descriptionContext, schemaToWML: args.schemaToWML, ...args.options })(children)
        const minIndices = minIndicesByNestingLevel(mappedContents)
        const maxIndices = maxIndicesByNestingLevel(mappedContents)
        const crossProduct = (outputs: string[][], nestingLevel: PrintMode, transform: (contents: string[]) => string) => (
            (Array.apply(null, Array(maxIndices[nestingLevel])))
                .map((_, indexInLevel) => (provisionalPrintFactory({ outputs, nestingLevel, indexInLevel })))
                .map(transform)
        )
        const naiveCrossProduct = minIndices[PrintMode.naive] === 0
            ? []
            : crossProduct(mappedContents, PrintMode.naive, (contents) => (contents.join('')))
        const nestedTransform = (contents) => (contents.join(`\n${indentSpacing(args.options.indent + 1)}`))
        const nestedCrossProduct = [
            ...crossProduct(mappedContents, PrintMode.naive, nestedTransform),
            ...crossProduct(mappedContents, PrintMode.nested, nestedTransform),
            ...crossProduct(mappedContents, PrintMode.propertyNested, nestedTransform)
        ]
        return [...naiveCrossProduct, ...nestedCrossProduct]
    }
}