import { GenericTree } from "../../tree/baseClasses"
import { isSchemaReplace, isSchemaReplaceMatch, isSchemaReplacePayload, SchemaRemoveTag, SchemaReplaceMatchTag, SchemaReplacePayloadTag, SchemaReplaceTag, SchemaTag } from "../baseClasses"
import { ConverterMapEntry, PrintMapEntry, PrintMapEntryArguments, PrintMapResult, PrintMode } from "./baseClasses"
import { wrapperCombine } from "./quantumRender/combine"
import { tagRender } from "./tagRender"
import { validateProperties } from "./utils"

const editTemplates = {
    Remove: {},
    Replace: {},
    With: {}
} as const

export const editConverters: Record<string, ConverterMapEntry> = {
    Remove: {
        initialize: ({ parseOpen }): SchemaRemoveTag => {
            return {
                tag: 'Remove',
                ...validateProperties(editTemplates.Remove)(parseOpen)
            }
        }
    },
    Replace: {
        initialize: ({ parseOpen }): SchemaReplaceMatchTag => {
            return {
                tag: 'ReplaceMatch',
                ...validateProperties(editTemplates.Replace)(parseOpen)
            }
        },
        wrapper: 'Replace'
    },
    ReplaceMatch: {
        initialize: ({ parseOpen }): SchemaReplaceMatchTag => {
            return {
                tag: 'ReplaceMatch',
                ...validateProperties(editTemplates.Replace)(parseOpen)
            }
        },
        aggregate: (previous, node) => {
            const nearestSibling = previous.children.length ? previous.children.slice(-1)[0].data : undefined
            // if (nearestSibling && isSchemaConditionFallthrough(nearestSibling)) {
            //     throw new Error(`Replace must precede With`)
            // }
            return {
                ...previous,
                children: [...previous.children, node]
            }
        }
    },
    With: {
        initialize: ({ parseOpen }): SchemaReplacePayloadTag => {
            return {
                tag: 'ReplacePayload',
                ...validateProperties(editTemplates.With)(parseOpen)
            }
        },
        wrapper: 'Replace',
        aggregate: (previous, node) => {
            if (previous.children.length === 0) {
                throw new Error(`With must be part of a "Replace" grouping`)
            }
            const nearestSibling = previous.children.length ? previous.children.slice(-1)[0].data : undefined
            if (nearestSibling && !isSchemaReplaceMatch(nearestSibling)) {
                throw new Error(`With must follow Replace`)
            }
            return {
                ...previous,
                children: [...previous.children, node]
            }
        }
    },
    ReplacePayload: {
        initialize: ({ parseOpen }): SchemaReplacePayloadTag => {
            return {
                tag: 'ReplacePayload',
                ...validateProperties(editTemplates.With)(parseOpen)
            }
        },
        aggregate: (previous, node) => {
            if (previous.children.length === 0) {
                throw new Error(`With must be part of a "Replace" grouping`)
            }
            const nearestSibling = previous.children.length ? previous.children.slice(-1)[0].data : undefined
            if (nearestSibling && !isSchemaReplaceMatch(nearestSibling)) {
                throw new Error(`With must follow Replace`)
            }
            return {
                ...previous,
                children: [...previous.children, node]
            }
        }
    }
}

export const editPrintMap: Record<string, PrintMapEntry> = {
    Remove: ({ tag: { data, children }, ...args }: PrintMapEntryArguments) => (
        tagRender({
            ...args,
            tag: 'Remove',
            properties: [],
            node: { data, children }
        })
    ),
    ReplaceMatch: ({ tag: { data, children }, ...args }: PrintMapEntryArguments) => (
        tagRender({
            ...args,
            tag: 'Replace',
            properties: [],
            node: { data, children }
        })
    ),
    ReplacePayload: ({ tag: { data, children }, ...args }: PrintMapEntryArguments) => (
        tagRender({
            ...args,
            tag: 'With',
            properties: [],
            node: { data, children }
        })
    ),
    Replace: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments) => {
        if (!isSchemaReplace(tag)) {
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
