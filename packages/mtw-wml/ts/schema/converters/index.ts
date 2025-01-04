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
import { exampleConverters, examplePrintMap } from "./example"
import { SchemaAssetTag } from "@tonylb/mtw-base/ts/schema/asset"
import { isSchemaAsset, isSchemaAssetContents } from "@tonylb/mtw-base/ts/schema"

const validationTemplates = {
    Asset: {
        key: { required: true, type: ParsePropertyTypes.Key },
        update: { type: ParsePropertyTypes.Boolean }
    }
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
    ...exampleConverters,
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
    ...examplePrintMap,
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
