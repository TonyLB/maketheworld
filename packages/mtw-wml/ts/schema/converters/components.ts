import { compressWhitespace } from "../utils/schemaOutput/compressWhitespace"
import { ParsePropertyTypes } from "../../simpleParser/baseClasses"
import { ConverterMapEntry, PrintMapEntry, PrintMapEntryArguments } from "./baseClasses"
import { tagRender } from "./tagRender"
import { validateProperties } from "./utils"
import { GenericTree, GenericTreeNodeFiltered } from "@tonylb/mtw-base/ts/genericTree"
import { isSchemaExit, isSchemaFeature, isSchemaKnowledge, isSchemaMap, isSchemaPosition, isSchemaRoom, isSchemaShortName, SchemaExitTag, SchemaFeatureTag, SchemaKnowledgeTag, SchemaMapTag, SchemaPositionTag, SchemaRoomTag, SchemaShortNameTag } from "@tonylb/mtw-base/ts/schema/components"
import { isSchemaString } from "@tonylb/mtw-base/ts/schema/renderTree"
import { isSchemaMapContents, isSchemaTaggedMessageLegalContents, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaName } from "@tonylb/mtw-base/ts/schema/example"
import { PrintMode } from "@tonylb/mtw-base/ts/schema/printMap"
import { literalTagFactory } from "@tonylb/mtw-base/ts/schema/literalTagFactory"
import { enforceTypedKey, stripTypedKey } from "@tonylb/mtw-utilities/ts/types"

const componentTemplates = {
    Exit: {
        to: { type: ParsePropertyTypes.Key }
    },
    Description: {},
    Summary: {},
    Name: {},
    ShortName: {},
    Room: {
        uuid: { type: ParsePropertyTypes.Key },
        key: { type: ParsePropertyTypes.Key },
        display: { type: ParsePropertyTypes.Literal },
        from: { type: ParsePropertyTypes.Asset },
        as: { type: ParsePropertyTypes.Key },
        origin: { type: ParsePropertyTypes.AssetList }
    },
    Feature: {
        uuid: { type: ParsePropertyTypes.Key },
        key: { type: ParsePropertyTypes.Key },
        from: { type: ParsePropertyTypes.Asset },
        as: { type: ParsePropertyTypes.Key },
        origin: { type: ParsePropertyTypes.AssetList }
    },
    Knowledge: {
        uuid: { type: ParsePropertyTypes.Key },
        key: { type: ParsePropertyTypes.Key },
        from: { type: ParsePropertyTypes.Asset },
        as: { type: ParsePropertyTypes.Key },
        origin: { type: ParsePropertyTypes.AssetList }
    },
    Position: {
        x: { required: true, type: ParsePropertyTypes.Literal },
        y: { required: true, type: ParsePropertyTypes.Literal },
    },
    Map: {
        uuid: { type: ParsePropertyTypes.Key },
        key: { type: ParsePropertyTypes.Key },
        from: { type: ParsePropertyTypes.Asset },
        as: { type: ParsePropertyTypes.Key },
        origin: { type: ParsePropertyTypes.AssetList }
    }
} as const

const { converter: shortNameConverter, printMap: shortNamePrintMap } = literalTagFactory('ShortName')

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
    Room: {
        initialize: ({ parseOpen }): SchemaRoomTag => {
            const { uuid, ...rest } = validateProperties(componentTemplates.Room)(parseOpen)   
            return {
                tag: 'Room',
                uuid: uuid ? enforceTypedKey('ROOM')(uuid) : undefined,
                ...rest
            }
        }
    },
    Feature: {
        initialize: ({ parseOpen }): SchemaFeatureTag => {
            const { uuid, ...rest } = validateProperties(componentTemplates.Feature)(parseOpen)
            return {
                tag: 'Feature',
                uuid: uuid ? enforceTypedKey('FEATURE')(uuid) : undefined,
                ...rest
            }
        }
    },
    Knowledge: {
        initialize: ({ parseOpen }): SchemaKnowledgeTag => {
            const { uuid, ...rest } = validateProperties(componentTemplates.Knowledge)(parseOpen)
            return {
                tag: 'Knowledge',
                uuid: uuid ? enforceTypedKey('KNOWLEDGE')(uuid) : undefined,
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
            const { uuid, ...rest } = validateProperties(componentTemplates.Map)(parseOpen)
            return {
                tag: 'Map',
                uuid: uuid ? enforceTypedKey('MAP')(uuid) : undefined,
                ...rest
            }
        },
        typeCheckContents: (item) => (isSchemaMapContents(item) || isSchemaName(item)),
        validateContents: {
            isValid: (tag) => (true),
            branchTags: ['If', 'Room'],
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
                { key: 'as', type: 'key', value: tag.as ?? '' },
                ...(tag.origin && tag.origin.length ? [{ key: 'origin', type: 'assetList' as const, value: tag.origin }] : [])
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
                { key: 'as', type: 'key', value: tag.as ?? '' },
                ...(tag.origin && tag.origin.length ? [{ key: 'origin', type: 'assetList' as const, value: tag.origin }] : [])
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
                { key: 'as', type: 'key', value: tag.as ?? '' },
                ...(tag.origin && tag.origin.length ? [{ key: 'origin', type: 'assetList' as const, value: tag.origin }] : [])
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
                { key: 'as', type: 'key', value: tag.as ?? '' },
                ...(tag.origin && tag.origin.length ? [{ key: 'origin', type: 'assetList' as const, value: tag.origin }] : [])
            ],
            node: { data: tag, children }
        })
    }
}