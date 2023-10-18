import { SchemaMessageLegalContents, SchemaMessageTag, SchemaMomentTag, isSchemaMessage, isSchemaMessageContents, isSchemaRoom, isSchemaTaggedMessageLegalContents } from "../baseClasses"
import { ParsePropertyTypes } from "../../simpleParser/baseClasses"
import { compressWhitespace } from "../utils"
import { ConverterMapEntry, PrintMapEntry, PrintMapEntryArguments } from "./baseClasses"
import { tagRender } from "./tagRender"
import { validateProperties } from "./utils"

const messagingTemplates = {
    Message: {
        key: { required: true, type: ParsePropertyTypes.Key },
    },
    Moment: {
        key: { required: true, type: ParsePropertyTypes.Key },
    },
} as const

export const messagingConverters: Record<string, ConverterMapEntry> = {
    Message: {
        initialize: ({ parseOpen }): SchemaMessageTag => ({
            tag: 'Message',
            contents: [],
            render: [],
            rooms: [],
            ...validateProperties(messagingTemplates.Message)(parseOpen)
        }),
        legalContents: isSchemaMessageContents,
        finalize: (initialTag: SchemaMessageTag, contents: SchemaMessageLegalContents[] ): SchemaMessageTag => ({
            ...initialTag,
            render: compressWhitespace(contents.filter(isSchemaTaggedMessageLegalContents)),
            contents: contents.filter(isSchemaRoom),
            rooms: contents.reduce((previous, room) => (
                isSchemaRoom(room)
                    ? [
                        ...previous,
                        { key: room.key }
                    ]
                    : previous
            ), [])
        })
    },
    Moment: {
        initialize: ({ parseOpen }): SchemaMomentTag => ({
            tag: 'Moment',
            contents: [],
            ...validateProperties(messagingTemplates.Moment)(parseOpen)
        }),
        legalContents: isSchemaMessage,
        finalize: (initialTag: SchemaMomentTag, contents: SchemaMessageTag[] ): SchemaMomentTag => ({
            ...initialTag,
            contents
        })
    },
}

export const messagingPrintMap: Record<string, PrintMapEntry> = {
    Message: ({ tag, ...args }: PrintMapEntryArguments & { tag: SchemaMessageTag }) => (
        tagRender({
            ...args,
            tag: 'Message',
            properties: [
                { key: 'key', type: 'key', value: tag.key }
            ],
            contents: [
                ...tag.render,
                ...(tag.rooms.map(({ key }) => ({ tag: 'Room' as 'Room', key, name: [], render: [], contents: [] })))
            ],
        })
    ),
    Moment: ({ tag, ...args }: PrintMapEntryArguments & { tag: SchemaMomentTag }) => (
        tagRender({
            ...args,
            tag: 'Moment',
            properties: [
                { key: 'key', type: 'key', value: tag.key },
            ],
            contents: tag.contents,
        })
    )
}
