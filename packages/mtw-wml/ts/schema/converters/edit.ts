import { GenericTree } from "@tonylb/mtw-base/ts/genericTree"
import { ConverterMapEntry, PrintMapEntry, PrintMapEntryArguments } from "./baseClasses"
import { wrapperCombine } from "./quantumRender/combine"
import { tagRender } from "./tagRender"
import { validateProperties } from "./utils"
import { isSchemaReplace, isSchemaReplaceMatch, SchemaRemoveTag, SchemaReplaceMatchTag, SchemaReplacePayloadTag } from "@tonylb/mtw-base/ts/schema/edit"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { PrintMapResult, PrintMode } from "@tonylb/mtw-base/ts/schema/printMap"

const editTemplates = {
    Remove: {},
    Replace: {},
    With: {}
} as const

//
// Edit Tag Converters
//
// IMPORTANT: Replace/With Tag Transformation
// 
// In WML syntax, Replace and With are written as siblings:
//   <Replace>oldcontent</Replace><With>newcontent</With>
//
// During parsing, this is transformed into a schema tree structure where:
//   - <Replace> becomes a ReplaceMatch tag (with wrapper: 'Replace')
//   - <With> becomes a ReplacePayload tag (with wrapper: 'Replace')
//   - These are aggregated into a parent Replace node containing both as children
//
// So in the schema tree, you'll see:
//   { tag: 'Replace', children: [
//       { tag: 'ReplaceMatch', children: [old content] },
//       { tag: 'ReplacePayload', children: [new content] }
//   ]}
//
// When serializing back to WML, the print map converts this back to the sibling form.
//
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
