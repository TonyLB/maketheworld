import { escapeWMLCharacters } from "../../lib/escapeWMLCharacters"
import { SchemaAfterTag, SchemaBeforeTag, SchemaLineBreakTag, SchemaLinkTag, SchemaReplaceTag, SchemaSpacerTag, SchemaStringTag, SchemaTag, SchemaTaggedMessageLegalContents, SchemaWhitespaceTag, isSchemaAfter, isSchemaBefore, isSchemaLink, isSchemaReplace, isSchemaString, isSchemaTaggedMessageLegalContents } from "../baseClasses"
import { ParsePropertyTypes } from "../../simpleParser/baseClasses"
import { compressWhitespace } from "../utils"
import { ConverterMapEntry, PrintMapEntry, PrintMapEntryArguments } from "./baseClasses"
import { tagRender } from "./tagRender"
import { validateProperties } from "./utils"
import { GenericTree, GenericTreeNodeFiltered } from "../../sequence/tree/baseClasses"

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
        typeCheckContents: isSchemaTaggedMessageLegalContents,
        finalize: (initialTag: SchemaAfterTag, children: GenericTree<SchemaTag> ): GenericTreeNodeFiltered<SchemaAfterTag, SchemaTag> => ({
            data: initialTag,
            children: compressWhitespace(children)
        })
    },
    Before: {
        initialize: ({ parseOpen }): SchemaBeforeTag => ({
            tag: 'Before',
            ...validateProperties(taggedMessageTemplates.Before)(parseOpen)
        }),
        typeCheckContents: isSchemaTaggedMessageLegalContents,
        finalize: (initialTag: SchemaBeforeTag, children: GenericTree<SchemaTag> ): GenericTreeNodeFiltered<SchemaBeforeTag, SchemaTag> => ({
            data: initialTag,
            children: compressWhitespace(children)
        })
    },
    Replace: {
        initialize: ({ parseOpen }): SchemaReplaceTag => ({
            tag: 'Replace',
            ...validateProperties(taggedMessageTemplates.Replace)(parseOpen)
        }),
        typeCheckContents: isSchemaTaggedMessageLegalContents,
        finalize: (initialTag: SchemaReplaceTag, children: GenericTree<SchemaTag> ): GenericTreeNodeFiltered<SchemaReplaceTag, SchemaTag> => ({
            data: initialTag,
            children: compressWhitespace(children)
        })
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
        finalize: (initialTag: SchemaLinkTag, children: GenericTree<SchemaTag> ): GenericTreeNodeFiltered<SchemaLinkTag, SchemaTag> => ({
            data: {
                ...initialTag,
                text: children.map(({ data }) => (data)).filter(isSchemaString).map(({ value }) => (value)).join('')
            },
            children: compressWhitespace(children)
        })
    }
}

export const taggedMessagePrintMap: Record<string, PrintMapEntry> = {
    Before: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments & { tag: SchemaBeforeTag }) => (
        isSchemaBefore(tag)
            ? tagRender({
                ...args,
                tag: 'Before',
                properties: [],
                contents: children,
            })
            : ''
    ),
    After: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments & { tag: SchemaAfterTag }) => (
        isSchemaAfter(tag)
            ? tagRender({
                ...args,
                tag: 'After',
                properties: [],
                contents: children,
            })
            : ''
    ),
    Replace: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments & { tag: SchemaReplaceTag }) => (
        isSchemaReplace(tag)
            ? tagRender({
                ...args,
                tag: 'Replace',
                properties: [],
                contents: children,
            })
            : ''
    ),
    String: ({ tag: { data: tag } }: PrintMapEntryArguments & { tag: SchemaStringTag }) => (
        isSchemaString(tag) ? escapeWMLCharacters(tag.value) : ''
    ),
    Link: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments & { tag: SchemaLinkTag }) => (
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
