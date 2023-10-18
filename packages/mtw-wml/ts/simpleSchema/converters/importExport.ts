import { SchemaImageTag, SchemaImportTag, SchemaUseTag, isSchemaUse } from "../baseClasses"
import { ParsePropertyTypes } from "../../simpleParser/baseClasses"
import { ConverterMapEntry, PrintMapEntry, PrintMapEntryArguments } from "./baseClasses"
import { tagRender } from "./tagRender"
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

export const importExportPrintMap: Record<string, PrintMapEntry> = {
    Import: ({ tag, ...args }: PrintMapEntryArguments & { tag: SchemaImportTag }) => (
        tagRender({
            ...args,
            tag: 'Import',
            properties: [
                { key: 'from', type: 'key', value: tag.from },
            ],
            contents: Object.entries(tag.mapping).map(([as, { key, type }]): SchemaUseTag => ({
                tag: 'Use',
                as: (as !== key) ? as : undefined,
                key,
                type
            })),
        })
    ),
    Use: ({ tag, ...args }: PrintMapEntryArguments & { tag: SchemaUseTag }) => (
        tagRender({
            ...args,
            tag: 'Use',
            properties: [
                { key: 'key', type: 'key', value: tag.key },
                { key: 'as', type: 'key', value: tag.as },
                { key: 'type', type: 'literal', value: tag.type }
            ],
            contents: [],
        })
    ),
    Image: ({ tag, ...args }: PrintMapEntryArguments & { tag: SchemaImageTag }) => (
        tagRender({
            ...args,
            tag: 'Image',
            properties: [
                { key: 'key', type: 'key', value: tag.key },
            ],
            contents: [],
        })
    ),
}
