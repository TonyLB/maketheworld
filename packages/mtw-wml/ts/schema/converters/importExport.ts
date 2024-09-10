import { SchemaExportTag, SchemaImageTag, SchemaImportTag, SchemaInheritedTag, SchemaMetaTag, SchemaSelectedTag, SchemaTag, isImportable, isSchemaExport, isSchemaImage, isSchemaImport, isSchemaInherited, isSchemaMeta, isSchemaSelected } from "../baseClasses"
import { ParsePropertyTypes } from "../../simpleParser/baseClasses"
import { ConverterMapEntry, PrintMapEntry, PrintMapEntryArguments, PrintMode } from "./baseClasses"
import { tagRender } from "./tagRender"
import { validateProperties } from "./utils"
import { GenericTree, GenericTreeNodeFiltered } from "../../tree/baseClasses"

const importExportTemplates = {
    Import: {
        from: { required: true, type: ParsePropertyTypes.Key },
    },
    Export: {},
    Meta: {
        key: { required: true, type: ParsePropertyTypes.Key },
        time: { required: true, type: ParsePropertyTypes.Literal }
    },
    Image: {
        key: { required: true, type: ParsePropertyTypes.Key }
    },
    Inherited: {},
    Selected: {}
} as const

export const importExportConverters: Record<string, ConverterMapEntry> = {
    Import: {
        initialize: ({ parseOpen }): SchemaImportTag => ({
            tag: 'Import',
            mapping: {},
            ...validateProperties(importExportTemplates.Import)(parseOpen)
        }),
        typeCheckContents: isImportable,
        finalize: (initialTag: SchemaTag, children: GenericTree<SchemaTag> ): GenericTreeNodeFiltered<SchemaImportTag, SchemaTag> => {
            if (!isSchemaImport(initialTag)) {
                throw new Error('Type mismatch on schema finalize')
            }
            return {
                data: {
                    ...initialTag,
                    mapping: children.map(({ data }) => (data)).filter(isImportable).reduce((previous, { key, from, tag }) => ({
                        ...previous,
                        [key]: { key: from || key, type: tag }
                    }), {})
                },
                children
            }
        }
    },
    Meta: {
        initialize: ({ parseOpen }): SchemaMetaTag => {
            const { time, ...rest } = validateProperties(importExportTemplates.Meta)(parseOpen)
            if (typeof time === 'undefined' || Number.isNaN(parseInt(time))) {
                throw new Error(`Property 'time' must be a number`)
            }
            return {
                tag: 'Meta',
                ...rest,
                time: parseInt(time)
            }
        }
    },
    Export: {
        initialize: ({ parseOpen }): SchemaExportTag => ({
            tag: 'Export',
            mapping: {},
            ...validateProperties(importExportTemplates.Export)(parseOpen)
        }),
        typeCheckContents: isImportable,
        finalize: (initialTag: SchemaTag, children: GenericTree<SchemaTag> ): GenericTreeNodeFiltered<SchemaExportTag, SchemaTag> => {
            if (!isSchemaExport(initialTag)) {
                throw new Error('Type mismatch on schema finalize')
            }
            return {
                data: {
                    ...initialTag,
                    mapping: children.map(({ data }) => (data)).filter(isImportable).reduce((previous, { key, as, tag }) => ({
                        ...previous,
                        [as || key]: { key, type: tag }
                    }), {})
                },
                children
            }
        }
    },
    Image: {
        initialize: ({ parseOpen }): SchemaImageTag => ({
            tag: 'Image',
            ...validateProperties(importExportTemplates.Image)(parseOpen)
        })
    },
    Inherited: {
        initialize: ({ parseOpen }): SchemaInheritedTag => ({
            tag: 'Inherited',
            ...validateProperties(importExportTemplates.Inherited)(parseOpen)
        })
    },
    Selected: {
        initialize: ({ parseOpen }): SchemaSelectedTag => ({
            tag: 'Selected',
            ...validateProperties(importExportTemplates.Selected)(parseOpen)
        })
    }    
}

export const importExportPrintMap: Record<string, PrintMapEntry> = {
    Import: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments) => (
        isSchemaImport(tag)
            ? tagRender({
                ...args,
                tag: 'Import',
                properties: [
                    { key: 'from', type: 'key', value: tag.from },
                ],
                node: { data: tag, children }
            })
            : [{ printMode: PrintMode.naive, output: '' }]
    ),
    Meta: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments) => (
        isSchemaMeta(tag)
            ? tagRender({
                ...args,
                tag: 'Meta',
                properties: [
                    { key: 'key', type: 'key', value: tag.key },
                    { key: 'time', type: 'literal', value: `${tag.time}` }
                ],
                node: { data: tag, children }
            })
            : [{ printMode: PrintMode.naive, output: '' }]
    ),
    Export: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments) => (
        isSchemaExport(tag)
            ? tagRender({
                ...args,
                tag: 'Export',
                properties: [],
                node: { data: tag, children }
            })
            : [{ printMode: PrintMode.naive, output: '' }]
    ),
    Image: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments) => (
        isSchemaImage(tag)
            ? tagRender({
                ...args,
                tag: 'Image',
                properties: [
                    { key: 'key', type: 'key', value: tag.key },
                ],
                node: { data: tag, children }
            })
            : [{ printMode: PrintMode.naive, output: '' }]
    ),
    Inherited: ({ tag: { data: tag, children }, ...args}: PrintMapEntryArguments) => (
        isSchemaInherited(tag)
            ? tagRender({
                ...args,
                tag: 'Inherited',
                properties: [],
                node: { data: tag, children }
            })
            : [{ printMode: PrintMode.naive, output: '' }]
    ),
    Selected: ({ tag: { data: tag, children }, ...args}: PrintMapEntryArguments) => (
        isSchemaSelected(tag)
            ? tagRender({
                ...args,
                tag: 'Selected',
                properties: [],
                node: { data: tag, children }
            })
            : [{ printMode: PrintMode.naive, output: '' }]
    )
}
