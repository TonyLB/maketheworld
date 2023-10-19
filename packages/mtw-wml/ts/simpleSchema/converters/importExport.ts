import { SchemaImageTag, SchemaImportTag, SchemaTag, SchemaUseTag, isImportable, isSchemaUse } from "../baseClasses"
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
        typeCheckContents: isImportable,
        finalize: (initialTag: SchemaImportTag, contents: SchemaTag[] ): SchemaImportTag => ({
            ...initialTag,
            mapping: contents.filter(isImportable).reduce((previous, { key, from, tag }) => ({
                ...previous,
                [key]: { key: from || key, type: tag }
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
            contents: Object.entries(tag.mapping).map(([key, { key: from, type }]): SchemaTag => {
                const commonProps = {
                    from: (from !== key) ? from : undefined,
                    key
                }
                switch(type) {
                    case 'Action': return {
                        ...commonProps,
                        tag: 'Action',
                        src: ''
                    }
                    case 'Computed': return {
                        ...commonProps,
                        tag: 'Computed',
                        src: '',
                        dependencies: []
                    }
                    case 'Variable': return {
                        ...commonProps,
                        tag: 'Variable'
                    }
                    case 'Feature': 
                    case 'Knowledge':
                    case 'Room':
                        return {
                            ...commonProps,
                            tag: type,
                            name: [],
                            render: [],
                            contents: []
                        }
                    case 'Map': return {
                        ...commonProps,
                        tag: 'Map',
                        name: [],
                        contents: [],
                        rooms: [],
                        images: []
                    }
                }
            }),
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
