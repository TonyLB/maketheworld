import { isSchemaPronouns, SchemaCharacterTag, SchemaPronounsTag } from "@tonylb/mtw-base/ts/schema/character"
import { ParsePropertyTypes } from "../../simpleParser/baseClasses"
import { ConverterMapEntry, PrintMapEntry, PrintMapEntryArguments } from "./baseClasses"
import { tagRender } from "./tagRender"
import { validateProperties, validateExpressionAsNonNegativeInteger } from "./utils"
import { GenericTree, GenericTreeNode, GenericTreeNodeFiltered } from "@tonylb/mtw-base/ts/genericTree"
import { isSchemaCharacter, isSchemaCharacterContents, SchemaTag, AssetUUID } from "@tonylb/mtw-base/ts/schema"
import { literalTagFactory } from "@tonylb/mtw-base/ts/schema/literalTagFactory"
import { PrintMode } from "@tonylb/mtw-base/ts/schema/printMap"
import { enforceTypedKey, stripTypedKey } from "@tonylb/mtw-utilities/ts/types"

const characterTemplates = {
    Pronouns: {},
    Character: {
        uuid: { type: ParsePropertyTypes.Key },
        key: { type: ParsePropertyTypes.Key },
        from: { type: ParsePropertyTypes.Asset },
        update: { type: ParsePropertyTypes.Boolean },
        origin: { type: ParsePropertyTypes.AssetList },
        ref: { type: ParsePropertyTypes.Expression }
    }
} as const

const { converter: pronounsConverter, printMap: pronounsPrintMap } = literalTagFactory('Pronouns')

export const characterConverters: Record<string, ConverterMapEntry> = {
    Pronouns: pronounsConverter,
    Character: {
        initialize: ({ parseOpen }): SchemaCharacterTag => {
            const { uuid, ref, ...rest } = validateProperties(characterTemplates.Character)(parseOpen)
            const refValue = ref ? validateExpressionAsNonNegativeInteger(ref as string, 'ref', parseOpen.tag) : undefined
            return {
                tag: 'Character',
                uuid: uuid ? enforceTypedKey('CHARACTER')(uuid) : undefined,
                ...(refValue !== undefined ? { ref: refValue } : {}),
                ...rest
            }
        },
        typeCheckContents: isSchemaCharacterContents,
    }
}

export const characterPrintMap: Record<string, PrintMapEntry> = {
    Character: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments) => (
        isSchemaCharacter(tag)
            ? tagRender({
                ...args,
                tag: 'Character',
                properties: [
                    { key: 'uuid', type: 'key', value: tag.uuid ? stripTypedKey('CHARACTER')(tag.uuid) : '' },
                    { key: 'key', type: 'key', value: tag.key ?? '' },
                    { key: 'from', type: 'key', value: tag.from ?? '' },
                    { key: 'update', type: 'boolean', value: tag.update ?? false },
                    ...(tag.origin && tag.origin.length ? [{ key: 'origin', type: 'assetList' as const, value: tag.origin }] : []),
                    ...(tag.ref ? [{ key: 'ref', type: 'expression' as const, value: String(tag.ref) }] : [])
                ],
                node: { data: tag, children }
            })
            : [{ printMode: PrintMode.naive, output: '' }]
    ),
    Pronouns: pronounsPrintMap
}