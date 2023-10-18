import { escapeWMLCharacters } from "../../lib/escapeWMLCharacters"
import { SchemaAfterTag, SchemaBeforeTag, SchemaLineBreakTag, SchemaLinkTag, SchemaReplaceTag, SchemaSpacerTag, SchemaStringTag, SchemaTaggedMessageLegalContents, SchemaWhitespaceTag, isSchemaString, isSchemaTaggedMessageLegalContents } from "../baseClasses"
import { ParsePropertyTypes } from "../../simpleParser/baseClasses"
import { compressWhitespace } from "../utils"
import { ConverterMapEntry, PrintMapEntry, PrintMapEntryArguments } from "./baseClasses"
import { tagRender } from "./tagRender"
import { validateProperties } from "./utils"

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
            contents: [],
            ...validateProperties(taggedMessageTemplates.After)(parseOpen)
        }),
        legalContents: isSchemaTaggedMessageLegalContents,
        finalize: (initialTag: SchemaAfterTag, contents: SchemaTaggedMessageLegalContents[] ): SchemaAfterTag => ({
            ...initialTag,
            contents: compressWhitespace(contents)
        })
    },
    Before: {
        initialize: ({ parseOpen }): SchemaBeforeTag => ({
            tag: 'Before',
            contents: [],
            ...validateProperties(taggedMessageTemplates.Before)(parseOpen)
        }),
        legalContents: isSchemaTaggedMessageLegalContents,
        finalize: (initialTag: SchemaBeforeTag, contents: SchemaTaggedMessageLegalContents[] ): SchemaBeforeTag => ({
            ...initialTag,
            contents: compressWhitespace(contents)
        })
    },
    Replace: {
        initialize: ({ parseOpen }): SchemaReplaceTag => ({
            tag: 'Replace',
            contents: [],
            ...validateProperties(taggedMessageTemplates.Replace)(parseOpen)
        }),
        legalContents: isSchemaTaggedMessageLegalContents,
        finalize: (initialTag: SchemaReplaceTag, contents: SchemaTaggedMessageLegalContents[] ): SchemaReplaceTag => ({
            ...initialTag,
            contents: compressWhitespace(contents)
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
        legalContents: isSchemaString,
        finalize: (initialTag: SchemaLinkTag, contents: SchemaStringTag[]) => ({
            ...initialTag,
            text: contents.map(({ value }) => (value)).join('')
        })
    }
}

export const taggedMessagePrintMap: Record<string, PrintMapEntry> = {
    Before: ({ tag, ...args }: PrintMapEntryArguments & { tag: SchemaBeforeTag }) => (
        tagRender({
            ...args,
            tag: 'Before',
            properties: [],
            contents: tag.contents,
        })
    ),
    After: ({ tag, ...args }: PrintMapEntryArguments & { tag: SchemaAfterTag }) => (
        tagRender({
            ...args,
            tag: 'After',
            properties: [],
            contents: tag.contents,
        })
    ),
    Replace: ({ tag, ...args }: PrintMapEntryArguments & { tag: SchemaReplaceTag }) => (
        tagRender({
            ...args,
            tag: 'Replace',
            properties: [],
            contents: tag.contents,
        })
    ),
    String: ({ tag }: PrintMapEntryArguments & { tag: SchemaStringTag }) => (
        escapeWMLCharacters(tag.value)
    ),
    Link: ({ tag, ...args }: PrintMapEntryArguments & { tag: SchemaLinkTag }) => (
        tagRender({
            ...args,
            tag: 'Link',
            properties: [{ key: 'to', type: 'key', value: tag.to }],
            contents: [tag.text],
        })
    ),
    br: () => ('<br />'),
    Space: () => ('<Space />'),
    Whitespace: () => (' ')
}
