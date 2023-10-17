import { extractDependenciesFromJS } from "../../convert/utils"
import { SchemaActionTag, SchemaComputedTag, SchemaVariableTag } from "../../schema/baseClasses"
import { ParsePropertyTypes } from "../../simpleParser/baseClasses"
import { ConverterMapEntry } from "./baseClasses"
import { validateProperties } from "./utils"

const computationTemplates = {
    Variable: {
        key: { required: true, type: ParsePropertyTypes.Key },
        default: { type: ParsePropertyTypes.Expression }
    },
    Computed: {
        key: { required: true, type: ParsePropertyTypes.Key },
        src: { required: true, type: ParsePropertyTypes.Expression }
    },
    Action: {
        key: { required: true, type: ParsePropertyTypes.Key },
        src: { required: true, type: ParsePropertyTypes.Expression }
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
