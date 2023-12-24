import { SchemaExportTag, SchemaImageTag, SchemaImportTag, SchemaTag, isImportable, isSchemaExport, isSchemaImage, isSchemaImport } from "../baseClasses"
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
            children: contents
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
    Import: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments & { tag: SchemaImportTag }) => (
        isSchemaImport(tag)
            ? tagRender({
                ...args,
                tag: 'Import',
                properties: [
                    { key: 'from', type: 'key', value: tag.from },
                ],
                contents: children
            })
            : ''
    ),
    Export: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments & { tag: SchemaExportTag }) => (
        isSchemaExport(tag)
            ? tagRender({
                ...args,
                tag: 'Export',
                properties: [],
                contents: children
            })
            : ''
    ),
    Image: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments & { tag: SchemaImageTag }) => (
        isSchemaImage(tag)
            ? tagRender({
                ...args,
                tag: 'Image',
                properties: [
                    { key: 'key', type: 'key', value: tag.key },
                ],
                contents: [],
            })
            : ''
    ),
}
