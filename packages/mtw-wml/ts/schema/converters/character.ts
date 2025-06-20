import { isSchemaPronouns, SchemaCharacterTag, SchemaPronounsTag } from "@tonylb/mtw-base/ts/schema/character"
import { ParsePropertyTypes } from "../../simpleParser/baseClasses"
import { ConverterMapEntry, PrintMapEntry, PrintMapEntryArguments } from "./baseClasses"
import { tagRender } from "./tagRender"
import { validateProperties } from "./utils"
import { GenericTree, GenericTreeNodeFiltered } from "@tonylb/mtw-base/ts/genericTree"
import { isSchemaCharacter, isSchemaCharacterContents, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { literalTagFactory } from "@tonylb/mtw-base/ts/schema/literalTagFactory"
import { PrintMode } from "@tonylb/mtw-base/ts/schema/printMap"
import { enforceTypedKey, stripTypedKey } from "@tonylb/mtw-utilities/ts/types"

const characterTemplates = {
    Pronouns: {},
    Character: {
        key: { type: ParsePropertyTypes.Key },
        uuid: { type: ParsePropertyTypes.Key },
        from: { type: ParsePropertyTypes.Asset },
        update: { type: ParsePropertyTypes.Boolean }
    }
} as const

const { converter: pronounsConverter, printMap: pronounsPrintMap } = literalTagFactory('Pronouns')

export const characterConverters: Record<string, ConverterMapEntry> = {
    Pronouns: pronounsConverter,
    Character: {
        initialize: ({ parseOpen }): SchemaCharacterTag => {
            const { uuid, ...rest } = validateProperties(characterTemplates.Character)(parseOpen)
            return {
                tag: 'Character',
                uuid: uuid ? enforceTypedKey('CHARACTER')(uuid) : undefined,
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
                    { key: 'update', type: 'boolean', value: tag.update ?? false }
                ],
                node: { data: tag, children }
            })
            : [{ printMode: PrintMode.naive, output: '' }]
    ),
    Pronouns: pronounsPrintMap
}