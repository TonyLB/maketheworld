import { SchemaImageTag, SchemaImportTag, SchemaUseTag, isSchemaUse } from "../../schema/baseClasses"
import { ParsePropertyTypes } from "../../simpleParser/baseClasses"
import { ConverterMapEntry } from "./baseClasses"
import { validateProperties } from "./utils"

const importExportTemplates = {
    Use: {
        key: { required: true, type: ParsePropertyTypes.Key },
        as: { type: ParsePropertyTypes.Key },
        type: { type: ParsePropertyTypes.Literal }
    },
    Import: {
        from: { required: true, type: ParsePropertyTypes.Key },
    },
    Image: {
        key: { required: true, type: ParsePropertyTypes.Key }
    }
} as const

export const importExportConverters: Record<string, ConverterMapEntry> = {
    Use: {
        initialize: ({ parseOpen }): SchemaUseTag => ({
            tag: 'Use',
            ...validateProperties(importExportTemplates.Use)(parseOpen)
        })
    },
    Import: {
        initialize: ({ parseOpen }): SchemaImportTag => ({
            tag: 'Import',
            mapping: {},
            ...validateProperties(importExportTemplates.Import)(parseOpen)
        }),
        legalContents: isSchemaUse,
        finalize: (initialTag: SchemaImportTag, contents: SchemaUseTag[] ): SchemaImportTag => ({
            ...initialTag,
            mapping: contents.reduce((previous, { key, as, type }) => ({
                ...previous,
                [as || key]: { key, type }
            }), {})
        })
    },
    Image: {
        initialize: ({ parseOpen }): SchemaImageTag => ({
            tag: 'Image',
            ...validateProperties(importExportTemplates.Image)(parseOpen)
        })
    }
}
