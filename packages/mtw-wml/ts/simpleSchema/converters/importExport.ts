import { SchemaExportTag, SchemaImageTag, SchemaImportTag, SchemaTag, isImportable } from "../baseClasses"
import { ParsePropertyTypes } from "../../simpleParser/baseClasses"
import { ConverterMapEntry, PrintMapEntry, PrintMapEntryArguments } from "./baseClasses"
import { tagRender } from "./tagRender"
import { validateProperties } from "./utils"
import { GenericTree, GenericTreeNodeFiltered } from "../../sequence/tree/baseClasses"

const importExportTemplates = {
    Import: {
        from: { required: true, type: ParsePropertyTypes.Key },
    },
    Export: {},
    Image: {
        key: { required: true, type: ParsePropertyTypes.Key }
    }
} as const

export const importExportConverters: Record<string, ConverterMapEntry> = {
    Import: {
        initialize: ({ parseOpen }): SchemaImportTag => ({
            tag: 'Import',
            mapping: {},
            ...validateProperties(importExportTemplates.Import)(parseOpen)
        }),
        typeCheckContents: isImportable,
        finalize: (initialTag: SchemaImportTag, contents: GenericTree<SchemaTag> ): GenericTreeNodeFiltered<SchemaImportTag, SchemaTag> => ({
            data: {
                ...initialTag,
                mapping: contents.map(({ data }) => (data)).filter(isImportable).reduce((previous, { key, from, tag }) => ({
                    ...previous,
                    [key]: { key: from || key, type: tag }
                }), {})
            },
            children: contents
        })
    },
    Export: {
        initialize: ({ parseOpen }): SchemaExportTag => ({
            tag: 'Export',
            mapping: {},
            ...validateProperties(importExportTemplates.Export)(parseOpen)
        }),
        typeCheckContents: isImportable,
        finalize: (initialTag: SchemaExportTag, contents: GenericTree<SchemaTag> ): GenericTreeNodeFiltered<SchemaExportTag, SchemaTag> => ({
            data: {
                ...initialTag,
                mapping: contents.map(({ data }) => (data)).filter(isImportable).reduce((previous, { key, as, tag }) => ({
                    ...previous,
                    [as || key]: { key, type: tag }
                }), {})
            },
            children: []
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
    Export: ({ tag, ...args }: PrintMapEntryArguments & { tag: SchemaExportTag }) => (
        tagRender({
            ...args,
            tag: 'Export',
            properties: [],
            contents: Object.entries(tag.mapping).map(([as, { key, type }]): SchemaTag => {
                const commonProps = {
                    as: (as !== key) ? as : undefined,
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
