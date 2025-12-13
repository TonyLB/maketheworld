import { isSchemaImport, isSchemaMeta, SchemaImportTag, SchemaMetaTag } from "@tonylb/mtw-base/ts/schema/metaData"
import { ParsePropertyTypes } from "../../simpleParser/baseClasses"
import { ConverterMapEntry, PrintMapEntry, PrintMapEntryArguments } from "./baseClasses"
import { tagRender } from "./tagRender"
import { validateProperties, validateExpressionAsPositiveInteger } from "./utils"
import { GenericTree, GenericTreeNodeFiltered } from "@tonylb/mtw-base/ts/genericTree"
import { isImportable, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaRemove, isSchemaReplace } from "@tonylb/mtw-base/ts/schema/edit"
import { isSchemaImage, SchemaImageTag } from "@tonylb/mtw-base/ts/schema/image"
import { PrintMode } from "@tonylb/mtw-base/ts/schema/printMap"

const importExportTemplates = {
    Import: {
        from: { required: true, type: ParsePropertyTypes.Key },
    },
    Meta: {
        key: { required: true, type: ParsePropertyTypes.Key },
        time: { required: true, type: ParsePropertyTypes.Literal }
    },
    Image: {
        key: { required: true, type: ParsePropertyTypes.Key },
        origin: { type: ParsePropertyTypes.AssetList },
        apply: { type: ParsePropertyTypes.Expression }
    },
    Selected: {}
} as const

export const importExportConverters: Record<string, ConverterMapEntry> = {
    Import: {
        initialize: ({ parseOpen }): SchemaImportTag => ({
            tag: 'Import',
            mapping: {},
            ...validateProperties(importExportTemplates.Import)(parseOpen)
        }),
        typeCheckContents: (data) => (isImportable(data) || isSchemaRemove(data) || isSchemaReplace(data)),
        finalize: (initialTag: SchemaTag, children: GenericTree<SchemaTag> ): GenericTreeNodeFiltered<SchemaImportTag, SchemaTag> => {
            if (!isSchemaImport(initialTag)) {
                throw new Error('Type mismatch on schema finalize')
            }
            return {
                data: {
                    ...initialTag,
                    mapping: children.map(({ data }) => (data)).filter(isImportable).reduce((previous, { key, tag }) => ({
                        ...previous,
                        [key ?? '']: { key, type: tag }
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
    Image: {
        initialize: ({ parseOpen }): SchemaImageTag => {
            const { apply, ...rest } = validateProperties(importExportTemplates.Image)(parseOpen)
            const applyValue = apply ? validateExpressionAsPositiveInteger(apply as string, 'apply', parseOpen.tag) : undefined
            return {
                tag: 'Image',
                ...(applyValue !== undefined ? { apply: applyValue } : {}),
                ...rest
            }
        }
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
    Image: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments) => (
        isSchemaImage(tag)
            ? tagRender({
                ...args,
                tag: 'Image',
                properties: [
                    { key: 'key', type: 'key', value: tag.key },
                    ...(tag.origin && tag.origin.length ? [{ key: 'origin', type: 'assetList' as const, value: tag.origin }] : []),
                    ...(tag.apply ? [{ key: 'apply', type: 'expression' as const, value: String(tag.apply) }] : [])
                ],
                node: { data: tag, children }
            })
            : [{ printMode: PrintMode.naive, output: '' }]
    )
}
