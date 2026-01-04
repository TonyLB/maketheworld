import { ParsePropertyTypes } from "../../simpleParser/baseClasses"
import { ConverterMapEntry, PrintMapEntry, PrintMapEntryArguments } from "./baseClasses"
import { tagRender } from "./tagRender"
import { validateProperties, validateExpressionAsNonNegativeInteger } from "./utils"
import { isSchemaMark, SchemaMarkTag } from "@tonylb/mtw-base/ts/schema/worldState"
import { PrintMode } from "@tonylb/mtw-base/ts/schema/printMap"
import { literalTagFactory } from "@tonylb/mtw-base/ts/schema/literalTagFactory"
import { enforceTypedKey, stripTypedKey } from "@tonylb/mtw-utilities/ts/types"

const worldStateTemplates = {
    Match: {},
    Mark: {
        uuid: { type: ParsePropertyTypes.Key },
        key: { type: ParsePropertyTypes.Key },
        from: { type: ParsePropertyTypes.Asset },
        origin: { type: ParsePropertyTypes.AssetList },
        ref: { type: ParsePropertyTypes.Expression }
    }
} as const

const { converter: matchConverter, printMap: matchPrintMap } = literalTagFactory('Match')

export const worldStateConverters: Record<string, ConverterMapEntry> = {
    Match: matchConverter,
    Mark: {
        initialize: ({ parseOpen }): SchemaMarkTag => {
            const { uuid, ref, ...rest } = validateProperties(worldStateTemplates.Mark)(parseOpen)
            const refValue = ref ? validateExpressionAsNonNegativeInteger(ref as string, 'ref', parseOpen.tag) : undefined
            return {
                tag: 'Mark',
                uuid: uuid ? enforceTypedKey('MARK')(uuid) : undefined,
                ...(refValue !== undefined ? { ref: refValue } : {}),
                ...rest
            }
        }
    }
}

export const worldStatePrintMap: Record<string, PrintMapEntry> = {
    Match: matchPrintMap,
    Mark: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments) => {
        if (!isSchemaMark(tag)) {
            return [{ printMode: PrintMode.naive, output: '' }]
        }
        return tagRender({
            ...args,
            tag: 'Mark',
            properties: [
                { key: 'uuid', type: 'key', value: tag.uuid ? stripTypedKey('MARK')(tag.uuid) : '' },
                ...(tag.key ? [{ key: 'key', type: 'key' as const, value: tag.key }] : []),
                { key: 'from', type: 'key', value: tag.from ?? '' },
                ...(tag.origin && tag.origin.length ? [{ key: 'origin', type: 'assetList' as const, value: tag.origin }] : []),
                ...(tag.ref !== undefined ? [{ key: 'ref', type: 'expression' as const, value: String(tag.ref) }] : [])
            ],
            node: { data: tag, children }
        })
    }
}
