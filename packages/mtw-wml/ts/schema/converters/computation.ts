import { isSchemaAction, isSchemaComputed, isSchemaVariable, SchemaActionTag, SchemaComputedTag, SchemaVariableTag } from "@tonylb/mtw-base/ts/schema/computation"
import { ParsePropertyTypes } from "../../simpleParser/baseClasses"
import { ConverterMapEntry } from "./baseClasses"
import { validateProperties } from "./utils"
import { enforceTypedKey } from "@tonylb/mtw-utilities/ts/types"

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