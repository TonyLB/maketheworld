import { compressWhitespace } from "../utils/schemaOutput/compressWhitespace"
import { ParsePropertyTypes } from "../../simpleParser/baseClasses"
import { ConverterMapEntry, PrintMapEntry, PrintMapEntryArguments } from "./baseClasses"
import { tagRender } from "./tagRender"
import { validateProperties, validateExpressionAsNonNegativeInteger } from "./utils"
import { GenericTree, GenericTreeNodeFiltered } from "@tonylb/mtw-base/ts/genericTree"
import { isSchemaExit, isSchemaFeature, isSchemaKnowledge, isSchemaMap, isSchemaPosition, isSchemaRoom, isSchemaShortName, isSchemaParent, SchemaExitTag, SchemaFeatureTag, SchemaKnowledgeTag, SchemaMapTag, SchemaPositionTag, SchemaRoomTag, SchemaShortNameTag, SchemaParentTag } from "@tonylb/mtw-base/ts/schema/components"
import { isSchemaString, SchemaStringTag } from "@tonylb/mtw-base/ts/schema/renderTree"
import { isSchemaMapContents, SchemaTag, isSchemaComponent, isSchemaComponentUUID } from "@tonylb/mtw-base/ts/schema"
import { isSchemaName } from "@tonylb/mtw-base/ts/schema/example"
import { PrintMode, PrintMapResult } from "@tonylb/mtw-base/ts/schema/printMap"
import { literalTagFactory } from "@tonylb/mtw-base/ts/schema/literalTagFactory"
import { enforceTypedKey, stripTypedKey } from "@tonylb/mtw-utilities/ts/types"
import { isLegalKey } from "../../standardize/utils"

const componentTemplates = {
    Exit: {
        to: { type: ParsePropertyTypes.Key }
    },
    Description: {},
    Summary: {},
    Name: {},
    ShortName: {},
    Parent: {},
    Room: {
        uuid: { type: ParsePropertyTypes.Key },
        key: { type: ParsePropertyTypes.Key },
        display: { type: ParsePropertyTypes.Literal },
        from: { type: ParsePropertyTypes.Asset },
        origin: { type: ParsePropertyTypes.AssetList },
        ref: { type: ParsePropertyTypes.Expression }
    },
    Feature: {
        uuid: { type: ParsePropertyTypes.Key },
        key: { type: ParsePropertyTypes.Key },
        from: { type: ParsePropertyTypes.Asset },
        origin: { type: ParsePropertyTypes.AssetList },
        ref: { type: ParsePropertyTypes.Expression }
    },
    Knowledge: {
        uuid: { type: ParsePropertyTypes.Key },
        key: { type: ParsePropertyTypes.Key },
        from: { type: ParsePropertyTypes.Asset },
        origin: { type: ParsePropertyTypes.AssetList },
        ref: { type: ParsePropertyTypes.Expression }
    },
    Position: {
        x: { required: true, type: ParsePropertyTypes.Literal },
        y: { required: true, type: ParsePropertyTypes.Literal },
    },
    Map: {
        uuid: { type: ParsePropertyTypes.Key },
        key: { type: ParsePropertyTypes.Key },
        from: { type: ParsePropertyTypes.Asset },
        origin: { type: ParsePropertyTypes.AssetList },
        ref: { type: ParsePropertyTypes.Expression }
    }
} as const

const { converter: shortNameConverter, printMap: shortNamePrintMap } = literalTagFactory('ShortName')

// Parent tag converter - similar to Literal but constrained to ComponentUUID content
// and can only be placed inside ComponentUUID tags
const parentTagRenderLiteral = ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments): PrintMapResult[] => {
    if (!isSchemaParent(tag)) {
        return [{ printMode: PrintMode.naive, output: '' }]
    }
    // Handle empty Parent tags (self-closing)
    if (children.length === 0) {
        return [{ printMode: PrintMode.naive, output: `<${tag.tag} />` }]
    }
    const textValue = children.map(({ data }) => (data)).filter(isSchemaString).map(({ value }) => (value)).join('') as string
    const naive = `<${tag.tag}>${textValue}</${tag.tag}>`
    if (naive.length + Math.min(10, args.options.indent * 4) > 80) {
        return [
            { printMode: PrintMode.nested, output: `<${tag.tag}>` },
            { printMode: PrintMode.nested, output: `    ${textValue}` },
            { printMode: PrintMode.nested, output: `</${tag.tag}>` }
        ]
    }
    else {
        return [{ printMode: PrintMode.naive, output: `<${tag.tag}>${textValue}</${tag.tag}>` }]
    }
}

export const componentConverters: Record<string, ConverterMapEntry> = {
    Exit: {
        initialize: ({ parseOpen, contextStack }): SchemaExitTag => {
            const { to, ...rest } = validateProperties(componentTemplates.Exit)(parseOpen)
            return {
                tag: 'Exit',
                to: to ?? '',
                ...rest
            }
        },
        typeCheckContents: isSchemaString,
        finalize: (initialTag: SchemaTag, children: GenericTree<SchemaTag>): GenericTreeNodeFiltered<SchemaExitTag, SchemaTag> => {
            if (!isSchemaExit(initialTag)) {
                throw new Error('Type mismatch on schema finalize')
            }
            return {
                data: initialTag,
                children
            }
        }
    },
    ShortName: shortNameConverter,
    Parent: {
        initialize: ({ parseOpen, contextStack }): SchemaParentTag => {
            // Validate that Parent tag is inside a ComponentUUID
            const hasComponentContext = contextStack.some(({ data }) => isSchemaComponent(data))
            if (!hasComponentContext) {
                throw new Error(`Parent tag can only be used inside a ComponentUUID (Room, Feature, etc.)`)
            }
            // Validate properties using componentTemplates (Parent has no properties)
            validateProperties(componentTemplates.Parent)(parseOpen)
            return { tag: 'Parent' }
        },
        typeCheckContents: (item: SchemaTag): boolean => {
            // Parent can only contain String tags (ComponentUUID may be split across multiple strings)
            // The combined result will be validated in finalize
            return isSchemaString(item)
        },
        finalize: (initialTag: SchemaTag, children: GenericTree<SchemaTag>): GenericTreeNodeFiltered<SchemaParentTag, SchemaStringTag> => {
            if (!isSchemaParent(initialTag)) {
                throw new Error('Type mismatch on schema finalize')
            }
            // Allow empty Parent tags (to express "no parent")
            if (children.length === 0) {
                return {
                    data: { tag: 'Parent' },
                    children: []
                }
            }
            // If not empty, validate that the combined string content is a ComponentUUID or legalKey
            const textValue = children
                .map(({ data }) => data)
                .filter(isSchemaString)
                .map(({ value }) => value)
                .join('')
            if (!isSchemaComponentUUID(textValue) && !isLegalKey(textValue)) {
                throw new Error(`Parent tag content must be a ComponentUUID or legalKey, got: ${textValue}`)
            }
            return {
                data: { tag: 'Parent' },
                children: children.map(({ data }) => data).filter(isSchemaString).map(({ value }) => ({ data: { tag: 'String' as const, value }, children: [] }))
            }
        }
    },
    Room: {
        initialize: ({ parseOpen }): SchemaRoomTag => {
            const { uuid, ref, ...rest } = validateProperties(componentTemplates.Room)(parseOpen)
            const refValue = ref ? validateExpressionAsNonNegativeInteger(ref as string, 'ref', parseOpen.tag) : undefined
            return {
                tag: 'Room',
                uuid: uuid ? enforceTypedKey('ROOM')(uuid) : undefined,
                ...(refValue !== undefined ? { ref: refValue } : {}),
                ...rest
            }
        }
    },
    Feature: {
        initialize: ({ parseOpen }): SchemaFeatureTag => {
            const { uuid, ref, ...rest } = validateProperties(componentTemplates.Feature)(parseOpen)
            const refValue = ref ? validateExpressionAsNonNegativeInteger(ref as string, 'ref', parseOpen.tag) : undefined
            return {
                tag: 'Feature',
                uuid: uuid ? enforceTypedKey('FEATURE')(uuid) : undefined,
                ...(refValue !== undefined ? { ref: refValue } : {}),
                ...rest
            }
        }
    },
    Knowledge: {
        initialize: ({ parseOpen }): SchemaKnowledgeTag => {
            const { uuid, ref, ...rest } = validateProperties(componentTemplates.Knowledge)(parseOpen)
            const refValue = ref ? validateExpressionAsNonNegativeInteger(ref as string, 'ref', parseOpen.tag) : undefined
            return {
                tag: 'Knowledge',
                uuid: uuid ? enforceTypedKey('KNOWLEDGE')(uuid) : undefined,
                ...(refValue !== undefined ? { ref: refValue } : {}),
                ...rest
            }
        }
    },
    Position: {
        initialize: ({ parseOpen }): SchemaPositionTag => {
            const { x, y } = validateProperties(componentTemplates.Position)(parseOpen)
            if (typeof x === 'undefined' || Number.isNaN(parseInt(x))) {
                throw new Error(`Property 'x' must be a number`)
            }
            if (typeof y === 'undefined' || Number.isNaN(parseInt(y))) {
                throw new Error(`Property 'x' must be a number`)
            }
            return {
                tag: 'Position', x: parseInt(x), y: parseInt(y)
            }
        }
    },
    Map: {
        initialize: ({ parseOpen }): SchemaMapTag => {
            const { uuid, ref, ...rest } = validateProperties(componentTemplates.Map)(parseOpen)
            const refValue = ref ? validateExpressionAsNonNegativeInteger(ref as string, 'ref', parseOpen.tag) : undefined
            return {
                tag: 'Map',
                uuid: uuid ? enforceTypedKey('MAP')(uuid) : undefined,
                ...(refValue !== undefined ? { ref: refValue } : {}),
                ...rest
            }
        },
        typeCheckContents: (item) => (isSchemaMapContents(item) || isSchemaName(item)),
        validateContents: {
            isValid: (tag) => (true),
            branchTags: ['Room'],
            leafTags: ['Position', 'Image']
        },
        finalize: (initialTag: SchemaTag, children: GenericTree<SchemaTag> ): GenericTreeNodeFiltered<SchemaMapTag, SchemaTag> => {
            if (!isSchemaMap(initialTag)) {
                throw new Error('Type mismatch on schema finalize')
            }
            return {
                data: initialTag,
                children: children.filter(({ data }) => (isSchemaMapContents(data))),
            }
        }
    }
}

export const componentPrintMap: Record<string, PrintMapEntry> = {
    Exit: ({ tag: { data: tag, children }, ...args }) => {

        const { context, persistentOnly } = args.options
        if (!isSchemaExit(tag) || (persistentOnly && !tag.to)) {
            return [{ printMode: PrintMode.naive, output: '' }]
        }
        const roomsContextList = context.filter(isSchemaRoom)
        const roomContext: SchemaTag | undefined = roomsContextList.length > 0 ? roomsContextList.slice(-1)[0] : undefined
        const roomContextTypecheck = (roomContext: SchemaTag | undefined): roomContext is SchemaRoomTag | undefined => (!roomContext || isSchemaRoom(roomContext))
        if (!roomContextTypecheck(roomContext)) {
            return [{ printMode: PrintMode.naive, output: '' }]
        }
        return tagRender({
            ...args,
            tag: 'Exit',
            //
            // Do not render to/from properties when they can be derived from the room context
            //
            properties: [
                { key: 'to', type: 'key' as 'key', value: tag.to },
            ],
            node: { data: tag, children }
        })
    },
    ShortName: shortNamePrintMap,
    Parent: parentTagRenderLiteral,
    Room: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments) => {
        //
        // Reassemble the contents out of name and description fields
        //
        if (!isSchemaRoom(tag)) {
            return [{ printMode: PrintMode.naive, output: '' }]
        }
        return tagRender({
            ...args,
            tag: 'Room',
            properties: [
                { key: 'uuid', type: 'key', value: tag.uuid ? stripTypedKey('ROOM')(tag.uuid) : '' },
                ...(tag.key ? [{ key: 'key', type: 'key' as const, value: tag.key }] : []),
                { key: 'from', type: 'key', value: tag.from ?? '' },
                ...(tag.origin && tag.origin.length ? [{ key: 'origin', type: 'assetList' as const, value: tag.origin }] : []),
                ...(tag.ref ? [{ key: 'ref', type: 'expression' as const, value: String(tag.ref) }] : [])
            ],
            node: { data: tag, children }
        })

    },
    Feature: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments) => {
        //
        // Reassemble the contents out of name and description fields
        //
        if (!isSchemaFeature(tag)) {
            return [{ printMode: PrintMode.naive, output: '' }]
        }
        return tagRender({
            ...args,
            tag: 'Feature',
            properties: [
                { key: 'uuid', type: 'key', value: tag.uuid ? stripTypedKey('FEATURE')(tag.uuid) : '' },
                ...(tag.key ? [{ key: 'key', type: 'key' as const, value: tag.key }] : []),
                { key: 'from', type: 'key', value: tag.from ?? '' },
                ...(tag.origin && tag.origin.length ? [{ key: 'origin', type: 'assetList' as const, value: tag.origin }] : []),
                ...(tag.ref ? [{ key: 'ref', type: 'expression' as const, value: String(tag.ref) }] : [])
            ],
            node: { data: tag, children }
        })
    },
    Knowledge: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments) => {
        //
        // Reassemble the contents out of name and description fields
        //
        if (!isSchemaKnowledge(tag)) {
            return [{ printMode: PrintMode.naive, output: '' }]
        }
        return tagRender({
            ...args,
            tag: 'Knowledge',
            properties: [
                { key: 'uuid', type: 'key', value: tag.uuid ? stripTypedKey('KNOWLEDGE')(tag.uuid) : '' },
                { key: 'key', type: 'key', value: tag.key ?? '' },
                { key: 'from', type: 'key', value: tag.from ?? '' },
                ...(tag.origin && tag.origin.length ? [{ key: 'origin', type: 'assetList' as const, value: tag.origin }] : []),
                ...(tag.ref ? [{ key: 'ref', type: 'expression' as const, value: String(tag.ref) }] : [])
            ],
            node: { data: tag, children }
        })
    },
    Position: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments) => {
        if (!isSchemaPosition(tag)) {
            return [{ printMode: PrintMode.naive, output: '' }]
        }
        return tagRender({
            ...args,
            tag: 'Position',
            properties: [
                //
                // Render x/y properties from integers into strings
                //
                { key: 'x', type: 'literal', value: `${tag.x}` },
                { key: 'y', type: 'literal', value: `${tag.y}` }
            ],
            node: { data: tag, children }
        })
    },
    Map: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments) => {
        if (!isSchemaMap(tag)) {
            return [{ printMode: PrintMode.naive, output: '' }]
        }
        return tagRender({
            ...args,
            tag: 'Map',
            properties: [
                { key: 'uuid', type: 'key', value: tag.uuid ? stripTypedKey('MAP')(tag.uuid) : '' },
                { key: 'key', type: 'key', value: tag.key ?? '' },
                { key: 'from', type: 'key', value: tag.from ?? '' },
                ...(tag.origin && tag.origin.length ? [{ key: 'origin', type: 'assetList' as const, value: tag.origin }] : []),
                ...(tag.ref ? [{ key: 'ref', type: 'expression' as const, value: String(tag.ref) }] : [])
            ],
            node: { data: tag, children }
        })
    }
}