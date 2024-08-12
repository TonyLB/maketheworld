import { GenericTree } from "../../tree/baseClasses"
import { isSchemaReplace, isSchemaReplaceMatch, SchemaReplaceMatchTag, SchemaReplaceTag, SchemaTag } from "../baseClasses"
import { ConverterMapEntry, PrintMapEntry, PrintMapEntryArguments, PrintMapResult, PrintMode } from "./baseClasses"
import { wrapperCombine } from "./quantumRender/combine"
import { tagRender } from "./tagRender"
import { validateProperties } from "./utils"

const editTemplates = {
    Replace: {},
    ReplaceMatch: {}
} as const

export const editConverters: Record<string, ConverterMapEntry> = {
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
                ...validateProperties(editTemplates.ReplaceMatch)(parseOpen)
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
    }
}

export const editPrintMap: Record<string, PrintMapEntry> = {
    ReplaceMatch: ({ tag: { data, children }, ...args }: PrintMapEntryArguments) => (
        tagRender({
            ...args,
            tag: 'Replace',
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
