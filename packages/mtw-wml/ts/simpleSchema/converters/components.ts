import {
    SchemaBookmarkTag,
    SchemaDescriptionTag,
    SchemaExitTag,
    SchemaFeatureTag,
    SchemaKnowledgeTag,
    SchemaMapTag,
    SchemaNameTag,
    SchemaRoomTag,
    SchemaStringTag,
    SchemaTag,
    SchemaTaggedMessageLegalContents,
    isSchemaBookmark,
    isSchemaExit,
    isSchemaFeature,
    isSchemaFeatureIncomingContents,
    isSchemaImage,
    isSchemaKnowledge,
    isSchemaKnowledgeIncomingContents,
    isSchemaMap,
    isSchemaMapContents,
    isSchemaName,
    isSchemaRoom,
    isSchemaString,
    isSchemaTaggedMessageLegalContents
} from "../baseClasses"
import { compressWhitespace, extractConditionedItemFromContents, extractNameFromContents } from "../utils"
import { ParsePropertyTypes } from "../../simpleParser/baseClasses"
import { ConverterMapEntry, PrintMapEntry, PrintMapEntryArguments } from "./baseClasses"
import { tagRender } from "./tagRender"
import { validateProperties } from "./utils"
import { GenericTree, GenericTreeFiltered, GenericTreeNodeFiltered } from "../../sequence/tree/baseClasses"

const componentTemplates = {
    Exit: {
        from: { type: ParsePropertyTypes.Key },
        to: { type: ParsePropertyTypes.Key }
    },
    Description: {},
    Bookmark: {
        key: { required: true, type: ParsePropertyTypes.Key },
        display: { type: ParsePropertyTypes.Literal },
        from: { type: ParsePropertyTypes.Key },
        as: { type: ParsePropertyTypes.Key }
    },
    Name: {},
    Room: {
        key: { required: true, type: ParsePropertyTypes.Key },
        display: { type: ParsePropertyTypes.Literal },
        x: { type: ParsePropertyTypes.Literal },
        y: { type: ParsePropertyTypes.Literal },
        from: { type: ParsePropertyTypes.Key },
        as: { type: ParsePropertyTypes.Key }
    },
    Feature: {
        key: { required: true, type: ParsePropertyTypes.Key },
        from: { type: ParsePropertyTypes.Key },
        as: { type: ParsePropertyTypes.Key }
    },
    Knowledge: {
        key: { required: true, type: ParsePropertyTypes.Key },
        from: { type: ParsePropertyTypes.Key },
        as: { type: ParsePropertyTypes.Key }
    },
    Map: {
        key: { required: true, type: ParsePropertyTypes.Key },
        from: { type: ParsePropertyTypes.Key },
        as: { type: ParsePropertyTypes.Key }
    },
} as const

export const componentConverters: Record<string, ConverterMapEntry> = {
    Exit: {
        initialize: ({ parseOpen, contextStack }): SchemaExitTag => {
            const roomContextList = contextStack.map(({ tag }) => (tag)).filter(isSchemaRoom)
            const roomContext = roomContextList.length > 0 ? roomContextList.slice(-1)[0] : undefined
            const { from, to, ...rest } = validateProperties(componentTemplates.Exit)(parseOpen)
            if (!roomContext && (!from || !to)) {
                throw new Error(`Exit must specify both 'from' and 'to' properties if not in a room item`)
            }
            if (!(from || to)) {
                throw new Error(`Exit must specify at least one of 'from' and 'to' properties`)
            }
            return {
                tag: 'Exit',
                name: '',
                key: `${from || roomContext.key}#${to || roomContext.key}`,
                from: from || roomContext.key,
                to: to || roomContext.key,
                ...rest
            }
        },
        typeCheckContents: isSchemaString,
        finalize: (initialTag: SchemaExitTag, children: GenericTreeFiltered<SchemaStringTag, SchemaTag>): GenericTreeNodeFiltered<SchemaExitTag, SchemaTag> => ({
            data: {
                ...initialTag,
                name: children.map(({ data: { value } }) => (value)).join('')
            },
            children: children
        })
    },
    Description: {
        initialize: ({ parseOpen }): SchemaDescriptionTag => ({
            tag: 'Description',
            ...validateProperties(componentTemplates.Description)(parseOpen)
        }),
        typeCheckContents: isSchemaTaggedMessageLegalContents,
        finalize: (initialTag: SchemaDescriptionTag, children: GenericTreeFiltered<SchemaTaggedMessageLegalContents, SchemaTag> ): GenericTreeNodeFiltered<SchemaDescriptionTag, SchemaTag> => ({
            data: initialTag,
            children: compressWhitespace(children)
        })
    },
    Bookmark: {
        initialize: ({ parseOpen }): SchemaBookmarkTag => {
            const { display, ...rest } = validateProperties(componentTemplates.Bookmark)(parseOpen)
            if (display && !(display === 'before' || display === 'after' || display === 'replace')) {
                throw new Error(`Display property must be one of 'before', 'after', 'replace'`)
            }
            return {
                tag: 'Bookmark',
                display: display as 'before' | 'after' | 'replace',
                ...rest
            }
        },
        typeCheckContents: isSchemaTaggedMessageLegalContents,
        finalize: (initialTag: SchemaBookmarkTag, children: GenericTreeFiltered<SchemaTaggedMessageLegalContents, SchemaTag> ): GenericTreeNodeFiltered<SchemaBookmarkTag, SchemaTag> => ({
            data: initialTag,
            children: compressWhitespace(children)
        })
    },
    Name: {
        initialize: ({ parseOpen }): SchemaNameTag => ({
            tag: 'Name',
            ...validateProperties(componentTemplates.Name)(parseOpen)
        }),
        typeCheckContents: isSchemaTaggedMessageLegalContents,
        finalize: (initialTag: SchemaNameTag, children: GenericTreeFiltered<SchemaTaggedMessageLegalContents, SchemaTag> ): GenericTreeNodeFiltered<SchemaNameTag, SchemaTag> => ({
            data: initialTag,
            children: compressWhitespace(children)
        })
    },
    Room: {
        initialize: ({ parseOpen }): SchemaRoomTag => {
            const { x, y, ...rest } = validateProperties(componentTemplates.Room)(parseOpen)
            if (typeof x !== 'undefined' && Number.isNaN(parseInt(x))) {
                throw new Error(`Property 'x' must be a number`)
            }
            if (typeof y !== 'undefined' && Number.isNaN(parseInt(y))) {
                throw new Error(`Property 'x' must be a number`)
            }
            return {
                tag: 'Room',
                x: typeof x !== 'undefined' ? parseInt(x) : undefined,
                y: typeof y !== 'undefined' ? parseInt(y) : undefined,
                ...rest
            }
        }
    },
    Feature: {
        initialize: ({ parseOpen }): SchemaFeatureTag => ({
            tag: 'Feature',
            ...validateProperties(componentTemplates.Feature)(parseOpen)
        }),
        typeCheckContents: isSchemaFeatureIncomingContents
    },
    Knowledge: {
        initialize: ({ parseOpen }): SchemaKnowledgeTag => ({
            tag: 'Knowledge',
            ...validateProperties(componentTemplates.Knowledge)(parseOpen)
        }),
        typeCheckContents: isSchemaKnowledgeIncomingContents
    },
    Map: {
        initialize: ({ parseOpen }): SchemaMapTag => ({
            tag: 'Map',
            name: [],
            rooms: [],
            images: [],
            ...validateProperties(componentTemplates.Map)(parseOpen)
        }),
        typeCheckContents: (item) => (isSchemaMapContents(item) || isSchemaName(item)),
        validateContents: {
            isValid: (tag) => {
                if (isSchemaRoom(tag) && !(typeof tag.x !== 'undefined' && typeof tag.y !== 'undefined')) {
                    throw new Error('Room in Map context must specify x and y values')
                }
                return true
            },
            branchTags: ['If'],
            leafTags: ['Room']
        },
        finalize: (initialTag: SchemaMapTag, children: GenericTree<SchemaTag> ): GenericTreeNodeFiltered<SchemaMapTag, SchemaTag> => ({
            data: {
                ...initialTag,
                name: compressWhitespace(extractNameFromContents(children)).map(({ data }) => (data)),
                rooms: extractConditionedItemFromContents({
                    children: children,
                    typeGuard: isSchemaRoom,
                    transform: ({ key, x, y }) => ({ conditions: [], key, x, y })
                }),
                images: children.map(({ data }) => (data)).filter(isSchemaImage).map(({ key }) => (key))
            },
            children: children.filter(({ data }) => (isSchemaMapContents(data))),
        })
    }
}

export const componentPrintMap: Record<string, PrintMapEntry> = {
    Exit: ({ tag: { data: tag }, ...args }) => {

        const { context } = args.options
        if (!isSchemaExit(tag)) {
            return ''
        }
        const roomsContextList = context.filter(isSchemaRoom)
        const roomContext: SchemaTag | undefined = roomsContextList.length > 0 ? roomsContextList.slice(-1)[0] : undefined
        const roomContextTypecheck = (roomContext: SchemaTag | undefined): roomContext is SchemaRoomTag | undefined => (!roomContext || isSchemaRoom(roomContext))
        if (!roomContextTypecheck(roomContext)) {
            return ''
        }
        return tagRender({
            ...args,
            tag: 'Exit',
            //
            // Do not render to/from properties when they can be derived from the room context
            //
            properties: [
                ...((!tag.from || (roomContext && roomContext.key === tag.from)) ? [] : [{ key: 'from', type: 'key' as 'key', value: tag.from }]),
                ...((!tag.to || (roomContext && roomContext.key === tag.to)) ? [] : [{ key: 'to', type: 'key' as 'key', value: tag.to }]),
            ],
            contents: tag.name ? [{ data: { tag: 'String', value: tag.name }, children: [] }] : [],
        })
    },
    Description: ({ tag: { children }, ...args }: PrintMapEntryArguments & { tag: SchemaDescriptionTag }) => (
        tagRender({
            ...args,
            tag: 'Description',
            properties: [],
            contents: children,
        })
    ),
    Name: ({ tag: { children }, ...args }: PrintMapEntryArguments & { tag: SchemaNameTag }) => (
        tagRender({
            ...args,
            tag: 'Name',
            properties: [],
            contents: children,
        })
    ),
    Room: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments & { tag: SchemaRoomTag }) => {
        //
        // Reassemble the contents out of name and description fields
        //
        if (!isSchemaRoom(tag)) {
            return ''
        }
        return tagRender({
            ...args,
            tag: 'Room',
            properties: [
                { key: 'key', type: 'key', value: tag.key },
                //
                // Render x/y properties from integers into strings
                //
                { key: 'x', type: 'literal', value: typeof tag.x !== 'undefined' ? `${tag.x}` : '' },
                { key: 'y', type: 'literal', value: typeof tag.y !== 'undefined' ? `${tag.y}` : '' },
                { key: 'from', type: 'key', value: tag.from },
                { key: 'as', type: 'key', value: tag.as }
            ],
            contents: children,
        })

    },
    Feature: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments & { tag: SchemaFeatureTag }) => {
        //
        // Reassemble the contents out of name and description fields
        //
        if (!isSchemaFeature(tag)) {
            return ''
        }
        return tagRender({
            ...args,
            tag: 'Feature',
            properties: [
                { key: 'key', type: 'key', value: tag.key },
                { key: 'from', type: 'key', value: tag.from },
                { key: 'as', type: 'key', value: tag.as }
            ],
            contents: children,
        })
    },
    Knowledge: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments & { tag: SchemaKnowledgeTag }) => {
        //
        // Reassemble the contents out of name and description fields
        //
        if (!isSchemaKnowledge(tag)) {
            return ''
        }
        return tagRender({
            ...args,
            tag: 'Knowledge',
            properties: [
                { key: 'key', type: 'key', value: tag.key },
                { key: 'from', type: 'key', value: tag.from },
                { key: 'as', type: 'key', value: tag.as }
            ],
            contents: children,
        })
    },
    Bookmark: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments & { tag: SchemaBookmarkTag }) => (
        isSchemaBookmark(tag)
            ? tagRender({
                ...args,
                tag: 'Bookmark',
                properties: [
                    { key: 'key', type: 'key', value: tag.key },
                ],
                contents: children,
            })
            : ''
    ),
    Map: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments & { tag: SchemaMapTag }) => {
        if (!isSchemaMap(tag)) {
            return ''
        }
        return tagRender({
            ...args,
            tag: 'Map',
            properties: [
                { key: 'key', type: 'key', value: tag.key },
                { key: 'from', type: 'key', value: tag.from },
                { key: 'as', type: 'key', value: tag.as }
            ],
            contents: children,
        })
    }
}