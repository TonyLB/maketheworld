import { SchemaMessageLegalContents, SchemaMessageTag, SchemaMomentTag, SchemaTag, isSchemaMessage, isSchemaMessageContents, isSchemaMoment, isSchemaRoom, isSchemaTaggedMessageLegalContents } from "../baseClasses"
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
            rooms: [],
            ...validateProperties(messagingTemplates.Message)(parseOpen)
        }),
        typeCheckContents: isSchemaMessageContents,
        finalize: (initialTag: SchemaMessageTag, children: GenericTree<SchemaTag> ): GenericTreeNodeFiltered<SchemaMessageTag, SchemaTag> => ({
            data: {
                ...initialTag,
                rooms: children.reduce((previous, { data: room }) => (
                    isSchemaRoom(room)
                        ? [
                            ...previous,
                            { key: room.key }
                        ]
                        : previous
                ), [])
            },
            children: compressWhitespace(children, { messageParsing: true }),
        })
    },
    Moment: {
        initialize: ({ parseOpen }): SchemaMomentTag => ({
            tag: 'Moment',
            ...validateProperties(messagingTemplates.Moment)(parseOpen)
        }),
        typeCheckContents: isSchemaMessage
    },
}

export const messagingPrintMap: Record<string, PrintMapEntry> = {
    Message: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments & { tag: SchemaMessageTag }) => (
        isSchemaMessage(tag)
            ? tagRender({
                ...args,
                tag: 'Message',
                properties: [
                    { key: 'key', type: 'key', value: tag.key },
                    { key: 'from', type: 'key', value: tag.from },
                    { key: 'as', type: 'key', value: tag.as }
                ],
                contents: children,
            })
            : ''
    ),
    Moment: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments & { tag: SchemaMomentTag }) => (
        isSchemaMoment(tag)
            ? tagRender({
                ...args,
                tag: 'Moment',
                properties: [
                    { key: 'key', type: 'key', value: tag.key },
                    { key: 'from', type: 'key', value: tag.from },
                    { key: 'as', type: 'key', value: tag.as }
                ],
                contents: children,
            })
            : ''
    )
}
