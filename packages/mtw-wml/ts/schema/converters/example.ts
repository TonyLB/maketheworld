import { compressWhitespace } from "../utils/schemaOutput/compressWhitespace"
import { ParsePropertyTypes } from "../../simpleParser/baseClasses"
import { ConverterMapEntry, PrintMapEntry, PrintMapEntryArguments } from "./baseClasses"
import { tagRender } from "./tagRender"
import { validateProperties, validateExpressionAsNonNegativeInteger } from "./utils"
import { GenericTree, GenericTreeNodeFiltered } from "@tonylb/mtw-base/ts/genericTree"
import { isSchemaDescription, isSchemaExample, isSchemaName, isSchemaSummary, SchemaDescriptionTag, SchemaExampleTag, SchemaNameTag, SchemaSummaryTag } from "@tonylb/mtw-base/ts/schema/example"
import { isSchemaTaggedMessageLegalContents, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { PrintMode } from "@tonylb/mtw-base/ts/schema/printMap"
import { enforceTypedKey, stripTypedKey } from "@tonylb/mtw-utilities/ts/types"

const exampleTemplates = {
    Description: {},
    Summary: {},
    Name: {},
    Example: {
        uuid: { type: ParsePropertyTypes.Key },
        key: { type: ParsePropertyTypes.Key },
        from: { type: ParsePropertyTypes.Asset },
        origin: { type: ParsePropertyTypes.AssetList },
        ref: { type: ParsePropertyTypes.Expression }
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
        initialize: ({ parseOpen }): SchemaExampleTag => {
            const { uuid, ref, ...rest } = validateProperties(exampleTemplates.Example)(parseOpen)
            const refValue = ref ? validateExpressionAsNonNegativeInteger(ref as string, 'ref', parseOpen.tag) : undefined
            return {
                tag: 'Example',
                uuid: uuid ? enforceTypedKey('EXAMPLE')(uuid) : undefined,
                ...(refValue !== undefined ? { ref: refValue } : {}),
                ...rest
            }
        }
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
                { key: 'uuid', type: 'key', value: tag.uuid ? stripTypedKey('EXAMPLE')(tag.uuid) : '' },
                { key: 'key', type: 'key', value: tag.key ?? '' },
                { key: 'from', type: 'key', value: tag.from ?? '' },
                ...(tag.origin && tag.origin.length ? [{ key: 'origin', type: 'assetList' as const, value: tag.origin }] : []),
                ...(tag.ref ? [{ key: 'ref', type: 'expression' as const, value: String(tag.ref) }] : [])
            ],
            node: { data: tag, children }
        })
    }
}