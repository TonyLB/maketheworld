import { SchemaActionTag, SchemaComputedTag, SchemaVariableTag, isSchemaAction, isSchemaComputed, isSchemaVariable } from "../baseClasses"
import { ParsePropertyTypes } from "../../simpleParser/baseClasses"
import { ConverterMapEntry, PrintMapEntry, PrintMapEntryArguments } from "./baseClasses"
import { tagRender } from "./tagRender"
import { validateProperties } from "./utils"

const computationTemplates = {
    Variable: {
        key: { required: true, type: ParsePropertyTypes.Key },
        default: { type: ParsePropertyTypes.Expression },
        from: { type: ParsePropertyTypes.Key },
        as: { type: ParsePropertyTypes.Key }
    },
    Computed: {
        key: { required: true, type: ParsePropertyTypes.Key },
        src: { required: true, type: ParsePropertyTypes.Expression },
        from: { type: ParsePropertyTypes.Key },
        as: { type: ParsePropertyTypes.Key }
    },
    Action: {
        key: { required: true, type: ParsePropertyTypes.Key },
        src: { required: true, type: ParsePropertyTypes.Expression },
        from: { type: ParsePropertyTypes.Key },
        as: { type: ParsePropertyTypes.Key }
    },
} as const

export const computationConverters: Record<string, ConverterMapEntry> = {
    Variable: {
        initialize: ({ parseOpen }): SchemaVariableTag => ({
            tag: 'Variable',
            ...validateProperties(computationTemplates.Variable)(parseOpen)
        })
    },
    Computed: {
        initialize: ({ parseOpen }): SchemaComputedTag => {
            const validatedProperties = validateProperties(computationTemplates.Computed)(parseOpen)
            return {
                tag: 'Computed',
                ...validatedProperties
            }
        }
    },
    Action: {
        initialize: ({ parseOpen }): SchemaActionTag => ({
            tag: 'Action',
            ...validateProperties(computationTemplates.Action)(parseOpen)
        })
    },
}

export const computationPrintMap: Record<string, PrintMapEntry> = {
    Variable: ({ tag: { data: tag }, ...args }: PrintMapEntryArguments) => (
        isSchemaVariable(tag)
            ? tagRender({
                ...args,
                tag: 'Variable',
                properties: [
                    { key: 'key', type: 'key', value: tag.key },
                    { key: 'default', type: 'expression', value: tag.default ?? '' },
                    { key: 'from', type: 'key', value: tag.from ?? '' },
                    { key: 'as', type: 'key', value: tag.as ?? '' }
                ],
                contents: [],
            })
            : ''
    ),
    Computed: ({ tag: { data: tag }, ...args }: PrintMapEntryArguments) => (
        isSchemaComputed(tag)
            ? tagRender({
                ...args,
                tag: 'Computed',
                properties: [
                    { key: 'key', type: 'key', value: tag.key },
                    { key: 'src', type: 'expression', value: tag.src },
                    { key: 'from', type: 'key', value: tag.from ?? '' },
                    { key: 'as', type: 'key', value: tag.as ?? '' }
                ],
                contents: [],
            })
            : ''
    ),
    Action: ({ tag: { data: tag }, ...args }: PrintMapEntryArguments) => (
        isSchemaAction(tag)
            ? tagRender({
                ...args,
                tag: 'Action',
                properties: [
                    { key: 'key', type: 'key', value: tag.key },
                    { key: 'src', type: 'expression', value: tag.src },
                    { key: 'from', type: 'key', value: tag.from ?? '' },
                    { key: 'as', type: 'key', value: tag.as ?? '' }
                ],
                contents: [],
            })
            : ''
    )
}