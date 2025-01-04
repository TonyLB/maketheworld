import { compressWhitespace } from "../utils/schemaOutput/compressWhitespace"
import { ParsePropertyTypes } from "../../simpleParser/baseClasses"
import { ConverterMapEntry, PrintMapEntry, PrintMapEntryArguments, PrintMode } from "./baseClasses"
import { tagRender } from "./tagRender"
import { validateProperties } from "./utils"
import { GenericTree, GenericTreeNodeFiltered } from "@tonylb/mtw-base/ts/genericTree"
import { isSchemaDescription, isSchemaExample, isSchemaName, isSchemaSummary, SchemaDescriptionTag, SchemaExampleTag, SchemaNameTag, SchemaSummaryTag } from "@tonylb/mtw-base/ts/schema/example"
import { isSchemaTaggedMessageLegalContents, SchemaTag } from "@tonylb/mtw-base/ts/schema"

const exampleTemplates = {
    Description: {},
    Summary: {},
    Name: {},
    Example: {
        key: { required: true, type: ParsePropertyTypes.Key }
    },
} as const

export const exampleConverters: Record<string, ConverterMapEntry> = {
    Description: {
        initialize: ({ parseOpen }): SchemaDescriptionTag => ({
            tag: 'Description',
            ...validateProperties(exampleTemplates.Description)(parseOpen)
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
            ...validateProperties(exampleTemplates.Summary)(parseOpen)
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
    Name: {
        initialize: ({ parseOpen }): SchemaNameTag => ({
            tag: 'Name',
            ...validateProperties(exampleTemplates.Name)(parseOpen)
        }),
        typeCheckContents: isSchemaTaggedMessageLegalContents,
        finalize: (initialTag: SchemaTag, children: GenericTree<SchemaTag> ): GenericTreeNodeFiltered<SchemaNameTag, SchemaTag> => {
            if (!isSchemaName(initialTag)) {
                throw new Error('Type mismatch on schema finalize')
            }
            return {
                data: initialTag,
                children: compressWhitespace(children)
            }
        }
    },
    Example: {
        initialize: ({ parseOpen }): SchemaExampleTag => ({
            tag: 'Example',
            ...validateProperties(exampleTemplates.Example)(parseOpen)
        }),
    }
}

export const examplePrintMap: Record<string, PrintMapEntry> = {
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
    Name: ({ tag: { data, children }, ...args }: PrintMapEntryArguments) => (
        tagRender({
            ...args,
            tag: 'Name',
            properties: [],
            node: { data, children }
        })
    ),
    Example: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments) => {
        //
        // Reassemble the contents out of name and description fields
        //
        if (!isSchemaExample(tag)) {
            return [{ printMode: PrintMode.naive, output: '' }]
        }
        return tagRender({
            ...args,
            tag: 'Example',
            properties: [
                { key: 'key', type: 'key', value: tag.key },
                { key: 'as', type: 'key', value: tag.as ?? '' }
            ],
            node: { data: tag, children }
        })
    }
}