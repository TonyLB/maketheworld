import { isSchemaMessage, isSchemaMoment, SchemaMessageTag, SchemaMomentTag } from "@tonylb/mtw-base/ts/schema/components"
import { ParsePropertyTypes } from "../../simpleParser/baseClasses"
import { compressWhitespace } from "../utils/schemaOutput/compressWhitespace"
import { ConverterMapEntry, PrintMapEntry, PrintMapEntryArguments } from "./baseClasses"
import { tagRender } from "./tagRender"
import { validateProperties } from "./utils"
import { GenericTree, GenericTreeNodeFiltered } from "@tonylb/mtw-base/ts/genericTree"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaRemove } from "@tonylb/mtw-base/ts/schema/edit"
import { PrintMode } from "@tonylb/mtw-base/ts/schema/printMap"
import { enforceTypedKey, stripTypedKey } from "@tonylb/mtw-utilities/ts/types"

const messagingTemplates = {
    Message: {
        uuid: { type: ParsePropertyTypes.Key },
        key: { type: ParsePropertyTypes.Key },
        from: { type: ParsePropertyTypes.Asset },
        as: { type: ParsePropertyTypes.Key },
        origin: { type: ParsePropertyTypes.AssetList }
    },
    Moment: {
        uuid: { type: ParsePropertyTypes.Key },
        key: { type: ParsePropertyTypes.Key },
        from: { type: ParsePropertyTypes.Asset },
        as: { type: ParsePropertyTypes.Key },
        origin: { type: ParsePropertyTypes.AssetList }
    },
} as const

export const messagingConverters: Record<string, ConverterMapEntry> = {
    Message: {
        initialize: ({ parseOpen }): SchemaMessageTag => {
            const { uuid, ...rest } = validateProperties(messagingTemplates.Message)(parseOpen)
            return {
                tag: 'Message',
                uuid: uuid ? enforceTypedKey('MESSAGE')(uuid) : undefined,
                ...rest
            }
        },
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
        initialize: ({ parseOpen }): SchemaMomentTag => {
            const { uuid, ...rest } = validateProperties(messagingTemplates.Moment)(parseOpen)
            return {
                tag: 'Moment',
                uuid: uuid ? enforceTypedKey('MOMENT')(uuid) : undefined,
                ...rest
            }
        },
        typeCheckContents: (node) => (isSchemaMessage(node) || isSchemaRemove(node))
    },
}

export const messagingPrintMap: Record<string, PrintMapEntry> = {
    Message: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments) => (
        isSchemaMessage(tag)
            ? tagRender({
                ...args,
                tag: 'Message',
                properties: [
                    { key: 'uuid', type: 'key', value: tag.uuid ? stripTypedKey('MESSAGE')(tag.uuid) : '' },
                    { key: 'key', type: 'key', value: tag.key ?? '' },
                    { key: 'from', type: 'key', value: tag.from ?? '' },
                    { key: 'as', type: 'key', value: tag.as ?? '' },
                    ...(tag.origin && tag.origin.length ? [{ key: 'origin', type: 'assetList' as const, value: tag.origin }] : [])
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
                    { key: 'uuid', type: 'key', value: tag.uuid ? stripTypedKey('MOMENT')(tag.uuid) : '' },
                    { key: 'key', type: 'key', value: tag.key ?? '' },
                    { key: 'from', type: 'key', value: tag.from ?? '' },
                    { key: 'as', type: 'key', value: tag.as ?? '' },
                    ...(tag.origin && tag.origin.length ? [{ key: 'origin', type: 'assetList' as const, value: tag.origin }] : [])
                ],
                node: { data: tag, children }
            })
            : [{ printMode: PrintMode.naive, output: '' }]
    )
}
