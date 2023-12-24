import { mergeOrderedConditionalTrees } from "../../lib/sequenceTools/orderedConditionalTree"
import {
    SchemaBookmarkTag,
    SchemaConditionTag,
    SchemaDescriptionTag,
    SchemaExitTag,
    SchemaFeatureTag,
    SchemaKnowledgeTag,
    SchemaMapTag,
    SchemaMessageLegalContents,
    SchemaNameTag,
    SchemaRoomTag,
    SchemaStringTag,
    SchemaTag,
    SchemaTaggedMessageLegalContents,
    isSchemaDescription,
    isSchemaFeatureContents,
    isSchemaFeatureIncomingContents,
    isSchemaImage,
    isSchemaKnowledgeIncomingContents,
    isSchemaMapContents,
    isSchemaName,
    isSchemaRoom,
    isSchemaRoomContents,
    isSchemaRoomIncomingContents,
    isSchemaString,
    isSchemaTaggedMessageLegalContents
} from "../baseClasses"
import { compressWhitespace, extractConditionedItemFromContents, extractDescriptionFromContents, extractNameFromContents, legacyContentStructure } from "../utils"
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
                contents: [],
                key: `${from || roomContext.key}#${to || roomContext.key}`,
                from: from || roomContext.key,
                to: to || roomContext.key,
                ...rest
            }
        },
        typeCheckContents: isSchemaString,
        finalize: (initialTag: SchemaExitTag, contents: GenericTreeFiltered<SchemaStringTag, SchemaTag>): GenericTreeNodeFiltered<SchemaExitTag, SchemaTag> => ({
            data: {
                ...initialTag,
                name: contents.map(({ data: { value } }) => (value)).join('')
            },
            children: contents
        })
    },
    Description: {
        initialize: ({ parseOpen }): SchemaDescriptionTag => ({
            tag: 'Description',
            contents: [],
            ...validateProperties(componentTemplates.Description)(parseOpen)
        }),
        typeCheckContents: isSchemaTaggedMessageLegalContents,
        finalize: (initialTag: SchemaDescriptionTag, contents: GenericTreeFiltered<SchemaTaggedMessageLegalContents, SchemaTag> ): GenericTreeNodeFiltered<SchemaDescriptionTag, SchemaTag> => ({
            data: initialTag,
            children: compressWhitespace(contents)
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
                contents: [],
                display: display as 'before' | 'after' | 'replace',
                ...rest
            }
        },
        typeCheckContents: isSchemaTaggedMessageLegalContents,
        finalize: (initialTag: SchemaBookmarkTag, contents: GenericTreeFiltered<SchemaTaggedMessageLegalContents, SchemaTag> ): GenericTreeNodeFiltered<SchemaBookmarkTag, SchemaTag> => ({
            data: initialTag,
            children: compressWhitespace(contents)
        })
    },
    Name: {
        initialize: ({ parseOpen }): SchemaNameTag => ({
            tag: 'Name',
            contents: [],
            ...validateProperties(componentTemplates.Name)(parseOpen)
        }),
        typeCheckContents: isSchemaTaggedMessageLegalContents,
        finalize: (initialTag: SchemaNameTag, contents: GenericTreeFiltered<SchemaTaggedMessageLegalContents, SchemaTag> ): GenericTreeNodeFiltered<SchemaNameTag, SchemaTag> => ({
            data: initialTag,
            children: compressWhitespace(contents)
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
                contents: [],
                render: [],
                name: [],
                x: typeof x !== 'undefined' ? parseInt(x) : undefined,
                y: typeof y !== 'undefined' ? parseInt(y) : undefined,
                ...rest
            }
        },
        typeCheckContents: isSchemaRoomIncomingContents,
        finalize: (initialTag: SchemaRoomTag, contents: GenericTree<SchemaTag> ): GenericTreeNodeFiltered<SchemaRoomTag, SchemaTag> => {
            const returnValue = {
                data: {
                    ...initialTag,
                    name: legacyContentStructure(compressWhitespace(extractNameFromContents(contents))) as SchemaTaggedMessageLegalContents[],
                    render: legacyContentStructure(compressWhitespace(extractDescriptionFromContents(contents))) as SchemaTaggedMessageLegalContents[],
                },
                children: contents,
            }
            return returnValue
        }
    },
    Feature: {
        initialize: ({ parseOpen }): SchemaFeatureTag => ({
            tag: 'Feature',
            contents: [],
            render: [],
            name: [],
            ...validateProperties(componentTemplates.Feature)(parseOpen)
        }),
        typeCheckContents: isSchemaFeatureIncomingContents,
        finalize: (initialTag: SchemaFeatureTag, contents: GenericTree<SchemaTag> ): GenericTreeNodeFiltered<SchemaFeatureTag, SchemaTag> => ({
            data: {
                ...initialTag,
                name: legacyContentStructure(compressWhitespace(extractNameFromContents(contents))) as SchemaTaggedMessageLegalContents[],
                render: legacyContentStructure(compressWhitespace(extractDescriptionFromContents(contents))) as SchemaTaggedMessageLegalContents[],
        },
            children: contents,
        })
    },
    Knowledge: {
        initialize: ({ parseOpen }): SchemaKnowledgeTag => ({
            tag: 'Knowledge',
            contents: [],
            render: [],
            name: [],
            ...validateProperties(componentTemplates.Knowledge)(parseOpen)
        }),
        typeCheckContents: isSchemaKnowledgeIncomingContents,
        finalize: (initialTag: SchemaKnowledgeTag, contents: GenericTree<SchemaTag> ): GenericTreeNodeFiltered<SchemaKnowledgeTag, SchemaTag> => ({
            data: {
                ...initialTag,
                name: legacyContentStructure(compressWhitespace(extractNameFromContents(contents))) as SchemaTaggedMessageLegalContents[],
                render: legacyContentStructure(compressWhitespace(extractDescriptionFromContents(contents))) as SchemaTaggedMessageLegalContents[],
        },
            children: contents,
        })
    },
    Map: {
        initialize: ({ parseOpen }): SchemaMapTag => ({
            tag: 'Map',
            contents: [],
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
        finalize: (initialTag: SchemaMapTag, contents: GenericTree<SchemaTag> ): GenericTreeNodeFiltered<SchemaMapTag, SchemaTag> => ({
            data: {
                ...initialTag,
                name: compressWhitespace(extractNameFromContents(contents)).map(({ data }) => (data)),
                rooms: extractConditionedItemFromContents({
                    contents,
                    typeGuard: isSchemaRoom,
                    transform: ({ key, x, y }) => ({ conditions: [], key, x, y })
                }),
                images: contents.map(({ data }) => (data)).filter(isSchemaImage).map(({ key }) => (key))
            },
            children: contents.filter(({ data }) => (isSchemaMapContents(data))),
        })
    }
}

export const componentPrintMap: Record<string, PrintMapEntry> = {
    Exit: ({ tag, ...args }: PrintMapEntryArguments & { tag: SchemaExitTag }) => {

        const { context } = args.options
        const roomsContextList = context.filter(isSchemaRoom)
        const roomContext: SchemaTag | undefined = roomsContextList.length > 0 ? roomsContextList.slice(-1)[0] : undefined
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
            contents: tag.name ? [tag.name] : [],
        })
    },
    Description: ({ tag, ...args }: PrintMapEntryArguments & { tag: SchemaDescriptionTag }) => (
        tagRender({
            ...args,
            tag: 'Description',
            properties: [],
            contents: tag.contents,
        })
    ),
    Name: ({ tag, ...args }: PrintMapEntryArguments & { tag: SchemaNameTag }) => (
        tagRender({
            ...args,
            tag: 'Name',
            properties: [],
            contents: tag.contents,
        })
    ),
    Room: ({ tag, ...args }: PrintMapEntryArguments & { tag: SchemaRoomTag }) => {
        //
        // Reassemble the contents out of name and description fields
        //
        const roomContents: SchemaTag[] = [
            ...((tag.name ?? []).length ? [{ tag: 'Name' as 'Name', contents: tag.name}] : []),
            ...((tag.render ?? []).length ? [{ tag: 'Description' as 'Description', contents: tag.render }] : []),
            ...tag.contents.filter((childTag) => (!(isSchemaName(childTag) || isSchemaDescription(childTag))))
        ]
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
            contents: roomContents,
        })

    },
    Feature: ({ tag, ...args }: PrintMapEntryArguments & { tag: SchemaFeatureTag }) => {
        //
        // Reassemble the contents out of name and description fields
        //
        const featureContents: SchemaTag[] = [
            ...((tag.name ?? []).length ? [{ tag: 'Name' as 'Name', contents: tag.name}] : []),
            ...((tag.render ?? []).length ? [{ tag: 'Description' as 'Description', contents: tag.render }] : []),
            ...tag.contents.filter((childTag) => (!(isSchemaName(childTag) || isSchemaDescription(childTag))))
        ]
        return tagRender({
            ...args,
            tag: 'Feature',
            properties: [
                { key: 'key', type: 'key', value: tag.key },
                { key: 'from', type: 'key', value: tag.from },
                { key: 'as', type: 'key', value: tag.as }
            ],
            contents: featureContents,
        })
    },
    Knowledge: ({ tag, ...args }: PrintMapEntryArguments & { tag: SchemaKnowledgeTag }) => {
        //
        // Reassemble the contents out of name and description fields
        //
        const knowledgeContents: SchemaTag[] = [
            ...((tag.name ?? []).length ? [{ tag: 'Name' as 'Name', contents: tag.name}] : []),
            ...((tag.render ?? []).length ? [{ tag: 'Description' as 'Description', contents: tag.render }] : []),
            ...tag.contents.filter((childTag) => (!(isSchemaName(childTag) || isSchemaDescription(childTag))))
        ]
        return tagRender({
            ...args,
            tag: 'Knowledge',
            properties: [
                { key: 'key', type: 'key', value: tag.key },
                { key: 'from', type: 'key', value: tag.from },
                { key: 'as', type: 'key', value: tag.as }
            ],
            contents: knowledgeContents,
        })
    },
    Bookmark: ({ tag, ...args }: PrintMapEntryArguments & { tag: SchemaBookmarkTag }) => (
        tagRender({
            ...args,
            tag: 'Bookmark',
            properties: [
                { key: 'key', type: 'key', value: tag.key },
            ],
            contents: tag.contents,
        })
    ),
    Map: ({ tag, ...args }: PrintMapEntryArguments & { tag: SchemaMapTag }) => {
        const mapContents: SchemaTag[] = mergeOrderedConditionalTrees(
            [
                ...(tag.name.length ? [{ tag: 'Name' as 'Name', contents: tag.name}] : []),
                ...((tag.images || []).map((key) => ({ tag: 'Image' as 'Image', key,  contents: []}))),
            ],
            tag.rooms.map((room) => ({
                tag: 'If',
                conditions: room.conditions,
                contents: [{
                    tag: 'Room',
                    key: room.key,
                    x: room.x,
                    y: room.y,
                    contents: []
                }]
            })) as SchemaConditionTag[]
        )
        return tagRender({
            ...args,
            tag: 'Map',
            properties: [
                { key: 'key', type: 'key', value: tag.key },
                { key: 'from', type: 'key', value: tag.from },
                { key: 'as', type: 'key', value: tag.as }
            ],
            contents: mapContents,
        })
    }
}