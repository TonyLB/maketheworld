import { SchemaMessageLegalContents, SchemaMessageTag, SchemaMomentTag, isSchemaMessage, isSchemaMessageContents, isSchemaRoom, isSchemaTaggedMessageLegalContents } from "../../schema/baseClasses"
import { ParsePropertyTypes } from "../../simpleParser/baseClasses"
import { ConverterMapEntry } from "./baseClasses"
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
            render: contents.filter(isSchemaTaggedMessageLegalContents),
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
