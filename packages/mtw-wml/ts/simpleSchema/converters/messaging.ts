import { SchemaMessageLegalContents, SchemaMessageTag, SchemaMomentTag, SchemaTag, isSchemaMessage, isSchemaMessageContents, isSchemaRoom, isSchemaTaggedMessageLegalContents } from "../baseClasses"
import { ParsePropertyTypes } from "../../simpleParser/baseClasses"
import { compressWhitespace } from "../utils"
import { ConverterMapEntry, PrintMapEntry, PrintMapEntryArguments } from "./baseClasses"
import { tagRender } from "./tagRender"
import { validateProperties } from "./utils"
import { GenericTree, GenericTreeNodeFiltered } from "../../sequence/tree/baseClasses"

const messagingTemplates = {
    Message: {
        key: { required: true, type: ParsePropertyTypes.Key },
        from: { type: ParsePropertyTypes.Key },
        as: { type: ParsePropertyTypes.Key }
    },
    Moment: {
        key: { required: true, type: ParsePropertyTypes.Key },
        from: { type: ParsePropertyTypes.Key },
        as: { type: ParsePropertyTypes.Key }
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
        typeCheckContents: isSchemaMessageContents,
        finalize: (initialTag: SchemaMessageTag, contents: GenericTree<SchemaTag> ): GenericTreeNodeFiltered<SchemaMessageTag, SchemaTag> => ({
            data: {
                ...initialTag,
                render: compressWhitespace(contents.filter(({ data }) => (isSchemaTaggedMessageLegalContents(data)))).map(({ data }) => (data)),
                rooms: contents.reduce((previous, { data: room }) => (
                    isSchemaRoom(room)
                        ? [
                            ...previous,
                            { key: room.key }
                        ]
                        : previous
                ), [])
            },
            children: contents,
        })
    },
    Moment: {
        initialize: ({ parseOpen }): SchemaMomentTag => ({
            tag: 'Moment',
            contents: [],
            ...validateProperties(messagingTemplates.Moment)(parseOpen)
        }),
        typeCheckContents: isSchemaMessage
    },
}

export const messagingPrintMap: Record<string, PrintMapEntry> = {
    Message: ({ tag, ...args }: PrintMapEntryArguments & { tag: SchemaMessageTag }) => (
        tagRender({
            ...args,
            tag: 'Message',
            properties: [
                { key: 'key', type: 'key', value: tag.key },
                { key: 'from', type: 'key', value: tag.from },
                { key: 'as', type: 'key', value: tag.as }
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
                { key: 'from', type: 'key', value: tag.from },
                { key: 'as', type: 'key', value: tag.as }
            ],
            contents: tag.contents,
        })
    )
}
