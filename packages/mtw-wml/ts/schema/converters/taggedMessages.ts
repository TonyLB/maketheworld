import { escapeWMLCharacters } from "../../lib/escapeWMLCharacters"
import { SchemaLineBreakTag, SchemaLinkTag, SchemaReplaceTag, SchemaSpacerTag, SchemaStringTag, SchemaTag, isSchemaLink, isSchemaOutputTag, isSchemaReplace, isSchemaString } from "../baseClasses"
import { ParsePropertyTypes } from "../../simpleParser/baseClasses"
import { compressWhitespace } from "../utils/schemaOutput/compressWhitespace"
import { ConverterMapEntry, PrintMapEntry, PrintMapEntryArguments, PrintMode } from "./baseClasses"
import { tagRender } from "./tagRender"
import { validateProperties } from "./utils"
import { GenericTree, GenericTreeNodeFiltered } from "../../tree/baseClasses"

const taggedMessageTemplates = {
    br: {},
    Space: {},
    Link: {
        to: { required: true, type: ParsePropertyTypes.Key }
    }
} as const

export const taggedMessageConverters: Record<string, ConverterMapEntry> = {
    br: {
        initialize: ({ parseOpen }): SchemaLineBreakTag => ({
            tag: 'br',
            ...validateProperties(taggedMessageTemplates.br)(parseOpen)
        })
    },
    Space: {
        initialize: ({ parseOpen }): SchemaSpacerTag => ({
            tag: 'Space',
            ...validateProperties(taggedMessageTemplates.Space)(parseOpen)
        })
    },
    Link: {
        initialize: ({ parseOpen }): SchemaLinkTag => ({
            tag: 'Link',
            text: '',
            ...validateProperties(taggedMessageTemplates.Link)(parseOpen)
        }),
        typeCheckContents: isSchemaString,
        finalize: (initialTag: SchemaTag, children: GenericTree<SchemaTag> ): GenericTreeNodeFiltered<SchemaLinkTag, SchemaTag> => {
            if (!isSchemaLink(initialTag)) {
                throw new Error('Type mismatch on schema finalize')
            }
            return {
                data: {
                    ...initialTag,
                    text: children.map(({ data }) => (data)).filter(isSchemaString).map(({ value }) => (value)).join('')
                },
                children: compressWhitespace(children)
            }
        }
    }
}

export const taggedMessagePrintMap: Record<string, PrintMapEntry> = {
    String: ({ tag: { data: tag } }: PrintMapEntryArguments) => (
        isSchemaString(tag)
            ? [{ printMode: PrintMode.naive, tag: 'String' as const, output: escapeWMLCharacters(tag.value) }]
            : [{ printMode: PrintMode.naive, tag: 'String' as const, output: '' }]
    ),
    Link: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments) => (
        isSchemaLink(tag)
            ? tagRender({
                ...args,
                tag: 'Link',
                properties: [{ key: 'to', type: 'key', value: tag.to }],
                node: { data: tag, children }
            })
            : [{ printMode: PrintMode.naive, output: '' }]
    ),
    br: () => ([{ printMode: PrintMode.naive, output: '<br />' }]),
    Space: () => ([{ printMode: PrintMode.naive, output: '<Space />' }]),
    Whitespace: () => ([{ printMode: PrintMode.naive, output: ' ' }])
}
