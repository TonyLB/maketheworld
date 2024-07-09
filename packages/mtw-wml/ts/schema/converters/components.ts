import {
    SchemaThemeTag,
    SchemaBookmarkTag,
    SchemaDescriptionTag,
    SchemaExitTag,
    SchemaFeatureTag,
    SchemaKnowledgeTag,
    SchemaMapTag,
    SchemaNameTag,
    SchemaPositionTag,
    SchemaPromptTag,
    SchemaRoomTag,
    SchemaShortNameTag,
    SchemaSummaryTag,
    SchemaTag,
    isSchemaTheme,
    isSchemaBookmark,
    isSchemaDescription,
    isSchemaExit,
    isSchemaFeature,
    isSchemaKnowledge,
    isSchemaMap,
    isSchemaMapContents,
    isSchemaName,
    isSchemaPosition,
    isSchemaPrompt,
    isSchemaRoom,
    isSchemaShortName,
    isSchemaString,
    isSchemaSummary,
    isSchemaTaggedMessageLegalContents
} from "../baseClasses"
import { compressWhitespace } from "../utils/schemaOutput/compressWhitespace"
import { ParsePropertyTypes } from "../../simpleParser/baseClasses"
import { ConverterMapEntry, PrintMapEntry, PrintMapEntryArguments, PrintMode } from "./baseClasses"
import { tagRender } from "./tagRender"
import { validateProperties } from "./utils"
import { GenericTree, GenericTreeNodeFiltered } from "../../tree/baseClasses"

const componentTemplates = {
    Exit: {
        to: { type: ParsePropertyTypes.Key }
    },
    Description: {},
    Summary: {},
    Bookmark: {
        key: { required: true, type: ParsePropertyTypes.Key },
        display: { type: ParsePropertyTypes.Literal },
        from: { type: ParsePropertyTypes.Key },
        as: { type: ParsePropertyTypes.Key }
    },
    Name: {},
    ShortName: {},
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
    Position: {
        x: { required: true, type: ParsePropertyTypes.Literal },
        y: { required: true, type: ParsePropertyTypes.Literal },
    },
    Map: {
        key: { required: true, type: ParsePropertyTypes.Key },
        from: { type: ParsePropertyTypes.Key },
        as: { type: ParsePropertyTypes.Key }
    },
    Theme: {
        key: { required: true, type: ParsePropertyTypes.Key },
        from: { type: ParsePropertyTypes.Key },
        as: { type: ParsePropertyTypes.Key }
    },
    Prompt: {}
} as const

export const componentConverters: Record<string, ConverterMapEntry> = {
    Exit: {
        initialize: ({ parseOpen, contextStack }): SchemaExitTag => {
            const roomContextList = contextStack.map(({ data }) => (data)).filter(isSchemaRoom)
            const roomContext = roomContextList.length > 0 ? roomContextList.slice(-1)[0] : undefined
            const { to, ...rest } = validateProperties(componentTemplates.Exit)(parseOpen)
            return {
                tag: 'Exit',
                key: `${roomContext?.key}#${to}`,
                from: roomContext?.key ?? '',
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
    Description: {
        initialize: ({ parseOpen }): SchemaDescriptionTag => ({
            tag: 'Description',
            ...validateProperties(componentTemplates.Description)(parseOpen)
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
            ...validateProperties(componentTemplates.Summary)(parseOpen)
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
    Bookmark: {
        initialize: ({ parseOpen }): SchemaBookmarkTag => {
            const { display, ...rest } = validateProperties(componentTemplates.Bookmark)(parseOpen)
            if (display && !(display === 'after' || display === 'replace')) {
                throw new Error(`Display property must be one of 'after', 'replace'`)
            }
            return {
                tag: 'Bookmark',
                display: display as 'after' | 'replace',
                ...rest
            }
        },
        typeCheckContents: isSchemaTaggedMessageLegalContents,
        finalize: (initialTag: SchemaTag, children: GenericTree<SchemaTag> ): GenericTreeNodeFiltered<SchemaBookmarkTag, SchemaTag> => {
            if (!isSchemaBookmark(initialTag)) {
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
            ...validateProperties(componentTemplates.Name)(parseOpen)
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
    ShortName: {
        initialize: ({ parseOpen }): SchemaShortNameTag => ({
            tag: 'ShortName',
            ...validateProperties(componentTemplates.ShortName)(parseOpen)
        }),
        typeCheckContents: isSchemaTaggedMessageLegalContents,
        finalize: (initialTag: SchemaTag, children: GenericTree<SchemaTag> ): GenericTreeNodeFiltered<SchemaShortNameTag, SchemaTag> => {
            if (!isSchemaShortName(initialTag)) {
                throw new Error('Type mismatch on schema finalize')
            }
            return {
                data: initialTag,
                children: compressWhitespace(children)
            }
        }
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
        })
    },
    Knowledge: {
        initialize: ({ parseOpen }): SchemaKnowledgeTag => ({
            tag: 'Knowledge',
            ...validateProperties(componentTemplates.Knowledge)(parseOpen)
        })
    },
    Position: {
        initialize: ({ parseOpen }): SchemaPositionTag => {
            const { x, y, ...rest } = validateProperties(componentTemplates.Position)(parseOpen)
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
    Theme: {
        initialize: ({ parseOpen }): SchemaThemeTag => ({
            tag: 'Theme',
            ...validateProperties(componentTemplates.Theme)(parseOpen)
        }),
        finalize: (initialTag: SchemaTag, children: GenericTree<SchemaTag> ): GenericTreeNodeFiltered<SchemaThemeTag, SchemaTag> => {
            if (!isSchemaTheme(initialTag)) {
                throw new Error('Type mismatch on schema finalize')
            }
            return {
                data: initialTag,
                children
            }
        }
    },
    Prompt: {
        initialize: ({ parseOpen }): SchemaPromptTag => ({
            tag: 'Prompt',
            value: '',
            ...validateProperties(componentTemplates.Prompt)(parseOpen)
        }),
        typeCheckContents: isSchemaString,
        finalize: (initialTag: SchemaTag, children: GenericTree<SchemaTag>): GenericTreeNodeFiltered<SchemaPromptTag, SchemaTag> => {
            if (!isSchemaPrompt(initialTag)) {
                throw new Error('Type mismatch on schema finalize')
            }
            return {
                data: {
                    ...initialTag,
                    value: children.map(({ data }) => (data)).filter(isSchemaString).map(({ value }) => (value)).join('')
                },
                children: []
            }
        }
    },
    Map: {
        initialize: ({ parseOpen }): SchemaMapTag => ({
            tag: 'Map',
            ...validateProperties(componentTemplates.Map)(parseOpen)
        }),
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
                ...((!tag.from || (roomContext && roomContext.key === tag.from)) ? [] : [{ key: 'from', type: 'key' as 'key', value: tag.from }]),
                ...((!tag.to || (roomContext && roomContext.key === tag.to)) ? [] : [{ key: 'to', type: 'key' as 'key', value: tag.to }]),
            ],
            node: { data: tag, children }
        })
    },
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
    ShortName: ({ tag: { data, children }, ...args }: PrintMapEntryArguments) => (
        tagRender({
            ...args,
            tag: 'ShortName',
            properties: [],
            node: { data, children }
        })
    ),
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
                { key: 'key', type: 'key', value: tag.key },
                //
                // Render x/y properties from integers into strings
                //
                { key: 'x', type: 'literal', value: typeof tag.x !== 'undefined' ? `${tag.x}` : '' },
                { key: 'y', type: 'literal', value: typeof tag.y !== 'undefined' ? `${tag.y}` : '' },
                { key: 'from', type: 'key', value: tag.from ?? '' },
                { key: 'as', type: 'key', value: tag.as ?? '' }
            ],
            node: { data: tag, children }
        })

    },
    Theme: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments) => {
        //
        // Reassemble the contents out of name and description fields
        //
        if (!isSchemaTheme(tag)) {
            return [{ printMode: PrintMode.naive, output: '' }]
        }
        return tagRender({
            ...args,
            tag: 'Theme',
            properties: [
                { key: 'key', type: 'key', value: tag.key },
                { key: 'from', type: 'key', value: tag.from ?? '' },
                { key: 'as', type: 'key', value: tag.as ?? '' }
            ],
            node: { data: tag, children }
        })
    },
    Prompt: (args: PrintMapEntryArguments) => {
        const tag = args.tag.data
        if (isSchemaPrompt(tag)) {
            return tagRender({
                ...args,
                tag: tag.tag,
                properties: [],
                node: { data: tag, children: [{ data: { tag: 'String' as 'String', value: tag.value }, children: [] }] }
            })
        }
        return [{ printMode: PrintMode.naive, output: '' }]
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
                { key: 'key', type: 'key', value: tag.key },
                { key: 'from', type: 'key', value: tag.from ?? '' },
                { key: 'as', type: 'key', value: tag.as ?? '' }
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
                { key: 'key', type: 'key', value: tag.key },
                { key: 'from', type: 'key', value: tag.from ?? '' },
                { key: 'as', type: 'key', value: tag.as ?? '' }
            ],
            node: { data: tag, children }
        })
    },
    Bookmark: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments) => (
        isSchemaBookmark(tag)
            ? tagRender({
                ...args,
                tag: 'Bookmark',
                properties: [
                    { key: 'key', type: 'key', value: tag.key },
                ],
                node: { data: tag, children }
            })
            : [{ printMode: PrintMode.naive, output: '' }]
    ),
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
                { key: 'key', type: 'key', value: tag.key },
                { key: 'from', type: 'key', value: tag.from ?? '' },
                { key: 'as', type: 'key', value: tag.as ?? '' }
            ],
            node: { data: tag, children }
        })
    }
}