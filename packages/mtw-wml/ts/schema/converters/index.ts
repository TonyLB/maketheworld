import { ParsePropertyTypes } from "../../simpleParser/baseClasses"
import { ConverterMapEntry, PrintMapEntry, PrintMapEntryArguments } from "./baseClasses"
import { validateProperties } from "./utils"
import { characterConverters, characterPrintMap } from "./character"
import { componentConverters, componentPrintMap } from "./components"

import { editConverters, editPrintMap } from './edit'
import { authorizationConverters, authorizationPrintMap } from "./authorization"
import { importExportConverters, importExportPrintMap } from "./importExport"
import { messagingConverters, messagingPrintMap } from "./messaging"
import { taggedMessageConverters, taggedMessagePrintMap } from "./taggedMessages"
import { tagRender } from "./tagRender"
import { proseConverters, prosePrintMap } from "./prose"
import { worldStateConverters, worldStatePrintMap } from "./worldState"
import { SchemaAssetTag } from "@tonylb/mtw-base/ts/schema/asset"
import { isSchemaAsset } from "@tonylb/mtw-base/ts/schema"
import { enforceTypedKey, stripTypedKey } from "@tonylb/mtw-utilities/ts/types"

const validationTemplates = {
    Asset: {
        uuid: { required: true, type: ParsePropertyTypes.Key },
        update: { type: ParsePropertyTypes.Boolean }
        // NOTE: 'key' property is intentionally excluded - Asset uses only universalKey (uuid)
        // since there is no context for an Asset-level key to be "local" to
    }
} as const

export const converterMap: Record<string, ConverterMapEntry> = {
    Asset: {
        initialize: ({ parseOpen }): SchemaAssetTag => {
            const { uuid, ...rest } = validateProperties(validationTemplates.Asset)(parseOpen)
            return {
                tag: 'Asset',
                Story: undefined,
                uuid: enforceTypedKey('ASSET')(uuid),
                ...rest
            }
        }
    },
    ...proseConverters,
    ...characterConverters,
    ...componentConverters,
    ...editConverters,
    ...importExportConverters,
    ...messagingConverters,
    ...taggedMessageConverters,
    ...authorizationConverters,
    ...worldStateConverters,
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
                { key: 'uuid', type: 'key', value: stripTypedKey('ASSET')(tag.uuid) },
                { key: 'Story', type: 'boolean', value: tag.Story ?? false },
                { key: 'update', type: 'boolean', value: tag.update ?? false }
            ],
            node: { data: tag, children }
        })
    },
    ...prosePrintMap,
    ...characterPrintMap,
    ...componentPrintMap,
    ...editPrintMap,
    ...importExportPrintMap,
    ...messagingPrintMap,
    ...taggedMessagePrintMap,
    ...authorizationPrintMap,
    ...worldStatePrintMap
}

export default converterMap
