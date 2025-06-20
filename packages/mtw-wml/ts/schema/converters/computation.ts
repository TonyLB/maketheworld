import { isSchemaAction, isSchemaComputed, isSchemaVariable, SchemaActionTag, SchemaComputedTag, SchemaVariableTag } from "@tonylb/mtw-base/ts/schema/computation"
import { ParsePropertyTypes } from "../../simpleParser/baseClasses"
import { ConverterMapEntry, PrintMapEntry, PrintMapEntryArguments } from "./baseClasses"
import { tagRender } from "./tagRender"
import { validateProperties } from "./utils"
import { PrintMode } from "@tonylb/mtw-base/ts/schema/printMap"
import { enforceTypedKey, stripTypedKey } from "@tonylb/mtw-utilities/ts/types"

const computationTemplates = {
    Variable: {
        uuid: { type: ParsePropertyTypes.Key },
        key: { required: true, type: ParsePropertyTypes.Key },
        default: { type: ParsePropertyTypes.Expression },
        from: { type: ParsePropertyTypes.Asset },
        as: { type: ParsePropertyTypes.Key }
    },
    Computed: {
        uuid: { type: ParsePropertyTypes.Key },
        key: { required: true, type: ParsePropertyTypes.Key },
        src: { required: true, type: ParsePropertyTypes.Expression },
        from: { type: ParsePropertyTypes.Asset },
        as: { type: ParsePropertyTypes.Key }
    },
    Action: {
        uuid: { type: ParsePropertyTypes.Key },
        key: { required: true, type: ParsePropertyTypes.Key },
        src: { required: true, type: ParsePropertyTypes.Expression },
        from: { type: ParsePropertyTypes.Asset },
        as: { type: ParsePropertyTypes.Key }
    },
} as const

export const computationConverters: Record<string, ConverterMapEntry> = {
    Variable: {
        initialize: ({ parseOpen }): SchemaVariableTag => {
            const { uuid, ...rest } = validateProperties(computationTemplates.Variable)(parseOpen)
            return {
                tag: 'Variable',
                uuid: uuid ? enforceTypedKey('VARIABLE')(uuid) : undefined,
                ...rest
            }
        },
    },
    Computed: {
        initialize: ({ parseOpen }): SchemaComputedTag => {
            const { uuid, ...rest } = validateProperties(computationTemplates.Computed)(parseOpen)
            return {
                tag: 'Computed',
                uuid: uuid ? enforceTypedKey('COMPUTED')(uuid) : undefined,
                ...rest
            }
        }
    },
    Action: {
        initialize: ({ parseOpen }): SchemaActionTag => {
            const { uuid, ...rest } = validateProperties(computationTemplates.Action)(parseOpen)
            return {
                tag: 'Action',
                uuid: uuid ? enforceTypedKey('ACTION')(uuid) : undefined,
                ...rest
            }
        }
    },
}

export const computationPrintMap: Record<string, PrintMapEntry> = {
    Variable: ({ tag: { data: tag }, ...args }: PrintMapEntryArguments) => (
        isSchemaVariable(tag)
            ? tagRender({
                ...args,
                tag: 'Variable',
                properties: [
                    { key: 'uuid', type: 'key', value: tag.uuid ? stripTypedKey('VARIABLE')(tag.uuid) : '' },
                    { key: 'key', type: 'key', value: tag.key ?? '' },
                    { key: 'default', type: 'expression', value: tag.default ?? '' },
                    { key: 'from', type: 'key', value: tag.from ?? '' },
                    { key: 'as', type: 'key', value: tag.as ?? '' }
                ],
                node: { data: tag, children: [] }
            })
            : [{ printMode: PrintMode.naive, output: '' }]
    ),
    Computed: ({ tag: { data: tag }, ...args }: PrintMapEntryArguments) => (
        isSchemaComputed(tag)
            ? tagRender({
                ...args,
                tag: 'Computed',
                properties: [
                    { key: 'uuid', type: 'key', value: tag.uuid ? stripTypedKey('COMPUTED')(tag.uuid) : '' },
                    { key: 'key', type: 'key', value: tag.key ?? '' },
                    { key: 'src', type: 'expression', value: tag.src },
                    { key: 'from', type: 'key', value: tag.from ?? '' },
                    { key: 'as', type: 'key', value: tag.as ?? '' }
                ],
                node: { data: tag, children: [] }
            })
            : [{ printMode: PrintMode.naive, output: '' }]
    ),
    Action: ({ tag: { data: tag }, ...args }: PrintMapEntryArguments) => (
        isSchemaAction(tag)
            ? tagRender({
                ...args,
                tag: 'Action',
                properties: [
                    { key: 'uuid', type: 'key', value: tag.uuid ? stripTypedKey('ACTION')(tag.uuid) : '' },
                    { key: 'key', type: 'key', value: tag.key ?? '' },
                    { key: 'src', type: 'expression', value: tag.src },
                    { key: 'from', type: 'key', value: tag.from ?? '' },
                    { key: 'as', type: 'key', value: tag.as ?? '' }
                ],
                node: { data: tag, children: [] }
            })
            : [{ printMode: PrintMode.naive, output: '' }]
    )
}