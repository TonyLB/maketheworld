import { escapeWMLCharacters } from "../../lib/escapeWMLCharacters"
import { SchemaAfterTag, SchemaBeforeTag, SchemaLineBreakTag, SchemaLinkTag, SchemaReplaceTag, SchemaSpacerTag, SchemaStringTag, SchemaTag, isSchemaAfter, isSchemaBefore, isSchemaLink, isSchemaOutputTag, isSchemaReplace, isSchemaString } from "../baseClasses"
import { ParsePropertyTypes } from "../../simpleParser/baseClasses"
import { compressWhitespace } from "../utils/schemaOutput/compressWhitespace"
import { ConverterMapEntry, PrintMapEntry, PrintMapEntryArguments } from "./baseClasses"
import { tagRender } from "./tagRender"
import { validateProperties } from "./utils"
import { GenericTree, GenericTreeNodeFiltered } from "../../tree/baseClasses"

const taggedMessageTemplates = {
    After: {},
    Before: {},
    Replace: {},
    br: {},
    Space: {},
    Link: {
        to: { required: true, type: ParsePropertyTypes.Key }
    }
} as const

export const taggedMessageConverters: Record<string, ConverterMapEntry> = {
    After: {
        initialize: ({ parseOpen }): SchemaAfterTag => ({
            tag: 'After',
            ...validateProperties(taggedMessageTemplates.After)(parseOpen)
        }),
        typeCheckContents: isSchemaOutputTag,
        finalize: (initialTag: SchemaTag, children: GenericTree<SchemaTag> ): GenericTreeNodeFiltered<SchemaAfterTag, SchemaTag> => {
            if (!isSchemaAfter(initialTag)) {
                throw new Error('Type mismatch on schema finalize')
            }
            return {
                data: initialTag,
                children: compressWhitespace(children)
            }
        }
    },
    Before: {
        initialize: ({ parseOpen }): SchemaBeforeTag => ({
            tag: 'Before',
            ...validateProperties(taggedMessageTemplates.Before)(parseOpen)
        }),
        typeCheckContents: isSchemaOutputTag,
        finalize: (initialTag: SchemaTag, children: GenericTree<SchemaTag> ): GenericTreeNodeFiltered<SchemaBeforeTag, SchemaTag> => {
            if (!isSchemaBefore(initialTag)) {
                throw new Error('Type mismatch on schema finalize')
            }
            return {
                data: initialTag,
                children: compressWhitespace(children)
            }
        }
    },
    Replace: {
        initialize: ({ parseOpen }): SchemaReplaceTag => ({
            tag: 'Replace',
            ...validateProperties(taggedMessageTemplates.Replace)(parseOpen)
        }),
        typeCheckContents: isSchemaOutputTag,
        finalize: (initialTag: SchemaTag, children: GenericTree<SchemaTag> ): GenericTreeNodeFiltered<SchemaReplaceTag, SchemaTag> => {
            if (!isSchemaReplace(initialTag)) {
                throw new Error('Type mismatch on schema finalize')
            }
            return {
                data: initialTag,
                children: compressWhitespace(children)
            }
        }
    },
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
    Before: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments) => (
        isSchemaBefore(tag)
            ? tagRender({
                ...args,
                tag: 'Before',
                properties: [],
                contents: children,
            })
            : ''
    ),
    After: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments) => (
        isSchemaAfter(tag)
            ? tagRender({
                ...args,
                tag: 'After',
                properties: [],
                contents: children,
            })
            : ''
    ),
    Replace: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments) => (
        isSchemaReplace(tag)
            ? tagRender({
                ...args,
                tag: 'Replace',
                properties: [],
                contents: children,
            })
            : ''
    ),
    String: ({ tag: { data: tag } }: PrintMapEntryArguments) => (
        isSchemaString(tag) ? escapeWMLCharacters(tag.value) : ''
    ),
    Link: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments) => (
        isSchemaLink(tag)
            ? tagRender({
                ...args,
                tag: 'Link',
                properties: [{ key: 'to', type: 'key', value: tag.to }],
                contents: children,
            })
            : ''
    ),
    br: () => ('<br />'),
    Space: () => ('<Space />'),
    Whitespace: () => (' ')
}
