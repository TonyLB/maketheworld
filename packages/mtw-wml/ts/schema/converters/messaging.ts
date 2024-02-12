import { SchemaMessageTag, SchemaMomentTag, SchemaTag, isSchemaMessage, isSchemaMoment } from "../baseClasses"
import { ParsePropertyTypes } from "../../simpleParser/baseClasses"
import { compressWhitespace } from "../utils/schemaOutput/compressWhitespace"
import { ConverterMapEntry, PrintMapEntry, PrintMapEntryArguments, PrintMode } from "./baseClasses"
import { tagRender } from "./tagRender"
import { validateProperties } from "./utils"
import { GenericTree, GenericTreeNodeFiltered } from "../../tree/baseClasses"

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
            ...validateProperties(messagingTemplates.Message)(parseOpen)
        }),
        finalize: (initialTag: SchemaTag, children: GenericTree<SchemaTag> ): GenericTreeNodeFiltered<SchemaMessageTag, SchemaTag> => {
            if (!isSchemaMessage(initialTag)) {
                throw new Error('Type mismatch on schema finalize')
            }
            return {
                data: initialTag,
                children: compressWhitespace(children, { messageParsing: true }),
            }
        }
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
    Message: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments) => (
        isSchemaMessage(tag)
            ? tagRender({
                ...args,
                tag: 'Message',
                properties: [
                    { key: 'key', type: 'key', value: tag.key },
                    { key: 'from', type: 'key', value: tag.from ?? '' },
                    { key: 'as', type: 'key', value: tag.as ?? '' }
                ],
                node: { data: tag, children }
            })
            : [{ printMode: PrintMode.naive, output: '' }]
    ),
    Moment: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments) => (
        isSchemaMoment(tag)
            ? tagRender({
                ...args,
                tag: 'Moment',
                properties: [
                    { key: 'key', type: 'key', value: tag.key },
                    { key: 'from', type: 'key', value: tag.from ?? '' },
                    { key: 'as', type: 'key', value: tag.as ?? '' }
                ],
                node: { data: tag, children }
            })
            : [{ printMode: PrintMode.naive, output: '' }]
    )
}
