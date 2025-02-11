import { compressWhitespace } from "../utils/schemaOutput/compressWhitespace"
import { ParsePropertyTypes } from "../../simpleParser/baseClasses"
import { ConverterMapEntry, PrintMapEntry, PrintMapEntryArguments, PrintMode } from "./baseClasses"
import { tagRender } from "./tagRender"
import { validateProperties } from "./utils"
import { GenericTree, GenericTreeNodeFiltered } from "@tonylb/mtw-base/ts/genericTree"
import { isSchemaDescription, isSchemaExample, isSchemaName, isSchemaSummary, SchemaDescriptionTag, SchemaExampleTag, SchemaNameTag, SchemaSummaryTag } from "@tonylb/mtw-base/ts/schema/example"
import { SchemaGrantTag, isSchemaGrant } from "@tonylb/mtw-base/ts/schema/authorization"
import { isSchemaTaggedMessageLegalContents, SchemaTag } from "@tonylb/mtw-base/ts/schema"

const authorizationTemplates = {
    Grant: {
        player: { required: true, type: ParsePropertyTypes.Key },
        action: { required: true, type: ParsePropertyTypes.Literal },
    }
} as const

export const authorizationConverters: Record<string, ConverterMapEntry> = {
    Grant: {
        initialize: ({ parseOpen }): SchemaGrantTag => {
            const { player, action } = validateProperties(authorizationTemplates.Grant)(parseOpen)
            return {
                tag: 'Grant',
                player,
                actions: action.split(',').map((action: string) => action.trim())
            }
        },
        finalize: (initialTag: SchemaTag, children: GenericTree<SchemaTag> ): GenericTreeNodeFiltered<SchemaGrantTag, SchemaTag> => {
            if (!isSchemaGrant(initialTag)) {
                throw new Error('Type mismatch on schema finalize')
            }
            return {
                data: initialTag,
                children: []
            }
        }
    }
}

export const authorizationPrintMap: Record<string, PrintMapEntry> = {
    Grant: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments) => {
        if (!isSchemaGrant(tag)) {
            return [{ printMode: PrintMode.naive, output: '' }]
        }
        return tagRender({
            ...args,
            tag: 'Grant',
            properties: [
                { key: 'player', type: 'key', value: tag.player },
                { key: 'action', type: 'literal', value: tag.actions.join(', ') }
            ],
            node: { data: tag, children }
        })
    }
}