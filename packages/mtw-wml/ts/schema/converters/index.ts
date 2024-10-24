import {
    SchemaAssetTag,
    SchemaStoryTag,
    isSchemaAsset,
    isSchemaAssetContents,
} from "../baseClasses"
import { ParsePropertyTypes } from "../../simpleParser/baseClasses"
import { ConverterMapEntry, PrintMapEntry, PrintMapEntryArguments } from "./baseClasses"
import { validateProperties } from "./utils"
import { characterConverters, characterPrintMap } from "./character"
import { componentConverters, componentPrintMap } from "./components"
import { computationConverters, computationPrintMap } from "./computation"
import { conditionalConverters, conditionalPrintMap } from "./conditionals"
import { editConverters, editPrintMap } from './edit'
import { importExportConverters, importExportPrintMap } from "./importExport"
import { messagingConverters, messagingPrintMap } from "./messaging"
import { taggedMessageConverters, taggedMessagePrintMap } from "./taggedMessages"
import { tagRender } from "./tagRender"

const validationTemplates = {
    Asset: {
        key: { required: true, type: ParsePropertyTypes.Key },
        update: { type: ParsePropertyTypes.Boolean }
    },
    Story: {
        key: { required: true, type: ParsePropertyTypes.Key },
        instance: { required: true, type: ParsePropertyTypes.Boolean }
    },
} as const

export const converterMap: Record<string, ConverterMapEntry> = {
    Asset: {
        initialize: ({ parseOpen }): SchemaAssetTag => ({
            tag: 'Asset',
            Story: undefined,
            ...validateProperties(validationTemplates.Asset)(parseOpen)
        }),
        typeCheckContents: isSchemaAssetContents
    },
    Story: {
        initialize: ({ parseOpen }): SchemaStoryTag => ({
            tag: 'Story',
            Story: true,
            ...validateProperties(validationTemplates.Story)(parseOpen)
        }),
        typeCheckContents: isSchemaAssetContents,
    },
    ...characterConverters,
    ...componentConverters,
    ...computationConverters,
    ...conditionalConverters,
    ...editConverters,
    ...importExportConverters,
    ...messagingConverters,
    ...taggedMessageConverters,
}

export const printMap: Record<string, PrintMapEntry> = {
    Asset: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments) => {
        if (!isSchemaAsset(tag)) {
            throw new Error('Tag mismatch in schema printMap')
        }
        return tagRender({
            ...args,
            tag: 'Asset',
            properties: [
                { key: 'key', type: 'key', value: tag.key },
                { key: 'Story', type: 'boolean', value: tag.Story ?? false },
                { key: 'update', type: 'boolean', value: tag.update ?? false }
            ],
            node: { data: tag, children }
        })
    },
    ...characterPrintMap,
    ...componentPrintMap,
    ...computationPrintMap,
    ...conditionalPrintMap,
    ...editPrintMap,
    ...importExportPrintMap,
    ...messagingPrintMap,
    ...taggedMessagePrintMap,
}

export default converterMap
