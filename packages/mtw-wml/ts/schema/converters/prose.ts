import { compressWhitespace } from "../utils/schemaOutput/compressWhitespace"
import { ParsePropertyTypes } from "../../simpleParser/baseClasses"
import { ConverterMapEntry, PrintMapEntry, PrintMapEntryArguments } from "./baseClasses"
import { tagRender } from "./tagRender"
import { validateProperties } from "./utils"
import { GenericTree, GenericTreeNodeFiltered } from "@tonylb/mtw-base/ts/genericTree"
import { isSchemaDescription, isSchemaSummary, isSchemaDisplayName, SchemaDescriptionTag, SchemaDisplayNameTag, SchemaSummaryTag } from "@tonylb/mtw-base/ts/schema/prose"
import { isSchemaTaggedMessageLegalContents, SchemaTag } from "@tonylb/mtw-base/ts/schema"

const proseTemplates = {
    Description: {},
    Summary: {},
    DisplayName: {},
} as const

export const proseConverters: Record<string, ConverterMapEntry> = {
    Description: {
        initialize: ({ parseOpen }): SchemaDescriptionTag => ({
            tag: 'Description',
            ...validateProperties(proseTemplates.Description)(parseOpen)
        }),
        typeCheckContents: isSchemaTaggedMessageLegalContents,
        finalize: (initialTag: SchemaTag, children: GenericTree<SchemaTag> ): GenericTreeNodeFiltered<SchemaDescriptionTag, SchemaTag> => {
            if (!isSchemaDescription(initialTag)) {
                throw new Error('Type mismatch on schema finalize')
            }
            return {
                data: initialTag,
                children: compressWhitespace(children)
            }
        }
    },
    Summary: {
        initialize: ({ parseOpen }): SchemaSummaryTag => ({
            tag: 'Summary',
            ...validateProperties(proseTemplates.Summary)(parseOpen)
        }),
        typeCheckContents: isSchemaTaggedMessageLegalContents,
        finalize: (initialTag: SchemaTag, children: GenericTree<SchemaTag> ): GenericTreeNodeFiltered<SchemaSummaryTag, SchemaTag> => {
            if (!isSchemaSummary(initialTag)) {
                throw new Error('Type mismatch on schema finalize')
            }
            return {
                data: initialTag,
                children: compressWhitespace(children)
            }
        }
    },
    DisplayName: {
        initialize: ({ parseOpen }): SchemaDisplayNameTag => ({
            tag: 'DisplayName',
            ...validateProperties(proseTemplates.DisplayName)(parseOpen)
        }),
        typeCheckContents: isSchemaTaggedMessageLegalContents,
        finalize: (initialTag: SchemaTag, children: GenericTree<SchemaTag> ): GenericTreeNodeFiltered<SchemaDisplayNameTag, SchemaTag> => {
            if (!isSchemaDisplayName(initialTag)) {
                throw new Error('Type mismatch on schema finalize')
            }
            return {
                data: initialTag,
                children: compressWhitespace(children)
            }
        }
    }
}

export const prosePrintMap: Record<string, PrintMapEntry> = {
    Description: ({ tag: { data, children }, ...args }: PrintMapEntryArguments) => (
        tagRender({
            ...args,
            tag: 'Description',
            properties: [],
            node: { data, children }
        })
    ),
    Summary: ({ tag: { data, children }, ...args }: PrintMapEntryArguments) => (
        tagRender({
            ...args,
            tag: 'Summary',
            properties: [],
            node: { data, children }
        })
    ),
    DisplayName: ({ tag: { data, children }, ...args }: PrintMapEntryArguments) => (
        tagRender({
            ...args,
            tag: 'DisplayName',
            properties: [],
            node: { data, children }
        })
    )
}
