import { isSchemaPronouns, SchemaCharacterTag, SchemaPronounsTag } from "@tonylb/mtw-base/ts/schema/character"
import { ParsePropertyTypes } from "../../simpleParser/baseClasses"
import { ConverterMapEntry, PrintMapEntry, PrintMapEntryArguments } from "./baseClasses"
import { tagRender } from "./tagRender"
import { validateProperties } from "./utils"
import { GenericTree, GenericTreeNodeFiltered } from "@tonylb/mtw-base/ts/genericTree"
import { isSchemaCharacter, isSchemaCharacterContents, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { literalTagFactory } from "@tonylb/mtw-base/ts/schema/literalTagFactory"
import { PrintMode } from "@tonylb/mtw-base/ts/schema/printMap"

const characterTemplates = {
    Pronouns: {},
    Character: {
        key: { required: true, type: ParsePropertyTypes.Key },
        update: { type: ParsePropertyTypes.Boolean }
    }
} as const

const { converter: pronounsConverter, printMap: pronounsPrintMap } = literalTagFactory('Pronouns')

export const characterConverters: Record<string, ConverterMapEntry> = {
    Pronouns: pronounsConverter,
    Character: {
        initialize: ({ parseOpen }): SchemaCharacterTag => {
            const properties = validateProperties(characterTemplates.Character)(parseOpen)
            return {
                tag: 'Character',
                ...properties
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
                    { key: 'key', type: 'key', value: tag.key },
                    { key: 'update', type: 'boolean', value: tag.update ?? false }
                ],
                node: { data: tag, children }
            })
            : [{ printMode: PrintMode.naive, output: '' }]
    ),
    Pronouns: pronounsPrintMap
}