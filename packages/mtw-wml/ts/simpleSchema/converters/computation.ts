import { SchemaActionTag, SchemaComputedTag, SchemaVariableTag } from "../baseClasses"
import { ParsePropertyTypes } from "../../simpleParser/baseClasses"
import { ConverterMapEntry, PrintMapEntry, PrintMapEntryArguments } from "./baseClasses"
import { tagRender } from "./tagRender"
import { validateProperties, extractDependenciesFromJS } from "./utils"

const computationTemplates = {
    Variable: {
        key: { required: true, type: ParsePropertyTypes.Key },
        default: { type: ParsePropertyTypes.Expression },
        from: { type: ParsePropertyTypes.Key }
    },
    Computed: {
        key: { required: true, type: ParsePropertyTypes.Key },
        src: { required: true, type: ParsePropertyTypes.Expression },
        from: { type: ParsePropertyTypes.Key }
    },
    Action: {
        key: { required: true, type: ParsePropertyTypes.Key },
        src: { required: true, type: ParsePropertyTypes.Expression },
        from: { type: ParsePropertyTypes.Key }
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
                dependencies: extractDependenciesFromJS(validatedProperties.src),
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
    Variable: ({ tag, ...args }: PrintMapEntryArguments & { tag: SchemaVariableTag }) => (
        tagRender({
            ...args,
            tag: 'Variable',
            properties: [
                { key: 'key', type: 'key', value: tag.key },
                { key: 'default', type: 'expression', value: tag.default },
                { key: 'from', type: 'key', value: tag.from }
            ],
            contents: [],
        })
    ),
    Computed: ({ tag, ...args }: PrintMapEntryArguments & { tag: SchemaComputedTag }) => (
        tagRender({
            ...args,
            tag: 'Computed',
            properties: [
                { key: 'key', type: 'key', value: tag.key },
                { key: 'src', type: 'expression', value: tag.src },
                { key: 'from', type: 'key', value: tag.from }
            ],
            contents: [],
        })
    ),
    Action: ({ tag, ...args }: PrintMapEntryArguments & { tag: SchemaActionTag }) => (
        tagRender({
            ...args,
            tag: 'Action',
            properties: [
                { key: 'key', type: 'key', value: tag.key },
                { key: 'src', type: 'expression', value: tag.src },
                { key: 'from', type: 'key', value: tag.from }
            ],
            contents: [],
        })
    )
}