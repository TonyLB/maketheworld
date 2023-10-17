import { extractDependenciesFromJS } from "../../convert/utils";
import {
    SchemaActionTag,
    SchemaAssetLegalContents,
    SchemaAssetTag,
    SchemaBookmarkTag,
    SchemaComputedTag,
    SchemaDescriptionTag,
    SchemaExitTag,
    SchemaFeatureLegalContents,
    SchemaFeatureTag,
    SchemaImageTag,
    SchemaImportTag,
    SchemaKnowledgeLegalContents,
    SchemaKnowledgeTag,
    SchemaMapLegalContents,
    SchemaMapTag,
    SchemaMessageLegalContents,
    SchemaMessageTag,
    SchemaMomentTag,
    SchemaNameTag,
    SchemaRoomLegalIncomingContents,
    SchemaRoomTag,
    SchemaStoryTag,
    SchemaStringTag,
    SchemaTag,
    SchemaTaggedMessageLegalContents,
    SchemaUseTag,
    SchemaVariableTag,
    isSchemaAssetContents,
    isSchemaFeatureIncomingContents,
    isSchemaImage,
    isSchemaKnowledgeIncomingContents,
    isSchemaMapContents,
    isSchemaMessage,
    isSchemaMessageContents,
    isSchemaName,
    isSchemaRoom,
    isSchemaRoomContents,
    isSchemaRoomIncomingContents,
    isSchemaString,
    isSchemaTaggedMessageLegalContents,
    isSchemaUse
} from "../../schema/baseClasses"
import { extractConditionedItemFromContents, extractDescriptionFromContents, extractNameFromContents } from "../../schema/utils"
import { ParsePropertyTypes } from "../../simpleParser/baseClasses"
import { ConverterMapEntry } from "./baseClasses"
import { validateProperties } from "./utils"
import { characterConverters } from "./character"
import { conditionalConverters } from "./conditionals"
import { importExportConverters } from "./importExport";
import { taggedMessageConverters } from "./taggedMessages"

const validationTemplates = {
    Asset: {
        key: { required: true, type: ParsePropertyTypes.Key }
    },
    Story: {
        key: { required: true, type: ParsePropertyTypes.Key },
        instance: { required: true, type: ParsePropertyTypes.Boolean }
    },
    Variable: {
        key: { required: true, type: ParsePropertyTypes.Key },
        default: { type: ParsePropertyTypes.Expression }
    },
    Computed: {
        key: { required: true, type: ParsePropertyTypes.Key },
        src: { required: true, type: ParsePropertyTypes.Expression }
    },
    Action: {
        key: { required: true, type: ParsePropertyTypes.Key },
        src: { required: true, type: ParsePropertyTypes.Expression }
    },
    Exit: {
        from: { type: ParsePropertyTypes.Key },
        to: { type: ParsePropertyTypes.Key }
    },
    Description: {},
    Bookmark: {
        key: { required: true, type: ParsePropertyTypes.Key },
        display: { type: ParsePropertyTypes.Literal }
    },
    Name: {},
    Room: {
        key: { required: true, type: ParsePropertyTypes.Key },
        display: { type: ParsePropertyTypes.Literal },
        x: { type: ParsePropertyTypes.Literal },
        y: { type: ParsePropertyTypes.Literal }
    },
    Feature: {
        key: { required: true, type: ParsePropertyTypes.Key },
    },
    Knowledge: {
        key: { required: true, type: ParsePropertyTypes.Key },
    },
    Map: {
        key: { required: true, type: ParsePropertyTypes.Key },
    },
    Message: {
        key: { required: true, type: ParsePropertyTypes.Key },
    },
    Moment: {
        key: { required: true, type: ParsePropertyTypes.Key },
    },
} as const

export const converterMap: Record<string, ConverterMapEntry> = {
    Asset: {
        initialize: ({ parseOpen }): SchemaAssetTag => ({
            tag: 'Asset',
            contents: [],
            Story: undefined,
            ...validateProperties(validationTemplates.Asset)(parseOpen)
        }),
        legalContents: isSchemaAssetContents,
        finalize: (initialTag: SchemaAssetTag, contents: SchemaAssetLegalContents[] ): SchemaAssetTag => ({
            ...initialTag,
            contents
        })
    },
    Story: {
        initialize: ({ parseOpen }): SchemaStoryTag => ({
            tag: 'Story',
            contents: [],
            Story: true,
            ...validateProperties(validationTemplates.Story)(parseOpen)
        }),
        legalContents: isSchemaAssetContents,
        finalize: (initialTag: SchemaAssetTag, contents: SchemaAssetLegalContents[] ): SchemaAssetTag => ({
            ...initialTag,
            contents
        })
    },
    ...characterConverters,
    ...conditionalConverters,
    ...importExportConverters,
    ...taggedMessageConverters,
    Variable: {
        initialize: ({ parseOpen }): SchemaVariableTag => ({
            tag: 'Variable',
            ...validateProperties(validationTemplates.Variable)(parseOpen)
        })
    },
    Computed: {
        initialize: ({ parseOpen }): SchemaComputedTag => {
            const validatedProperties = validateProperties(validationTemplates.Computed)(parseOpen)
            return {
                tag: 'Computed',
                dependencies: extractDependenciesFromJS(validatedProperties.src),
                ...validatedProperties
            }
        }
    },
    Action: {
        initialize: ({ parseOpen }): SchemaActionTag => ({
            tag: 'Action',
            ...validateProperties(validationTemplates.Action)(parseOpen)
        })
    },
    Exit: {
        initialize: ({ parseOpen, contextStack }): SchemaExitTag => {
            const roomContextList = contextStack.map(({ tag }) => (tag)).filter(isSchemaRoom)
            const roomContext = roomContextList.length > 0 ? roomContextList.slice(-1)[0] : undefined
            const { from, to, ...rest } = validateProperties(validationTemplates.Exit)(parseOpen)
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
        legalContents: isSchemaString,
        finalize: (initialTag: SchemaExitTag, contents: SchemaStringTag[]): SchemaExitTag => ({
            ...initialTag,
            name: contents.map(({ value }) => (value)).join(''),
            contents
        })
    },
    Description: {
        initialize: ({ parseOpen }): SchemaDescriptionTag => ({
            tag: 'Description',
            contents: [],
            ...validateProperties(validationTemplates.Description)(parseOpen)
        }),
        legalContents: isSchemaTaggedMessageLegalContents,
        finalize: (initialTag: SchemaDescriptionTag, contents: SchemaTaggedMessageLegalContents[] ): SchemaDescriptionTag => ({
            ...initialTag,
            contents
        })
    },
    Bookmark: {
        initialize: ({ parseOpen }): SchemaBookmarkTag => {
            const { display, ...rest } = validateProperties(validationTemplates.Bookmark)(parseOpen)
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
        legalContents: isSchemaTaggedMessageLegalContents,
        finalize: (initialTag: SchemaBookmarkTag, contents: SchemaTaggedMessageLegalContents[] ): SchemaBookmarkTag => ({
            ...initialTag,
            contents
        })
    },
    Name: {
        initialize: ({ parseOpen }): SchemaNameTag => ({
            tag: 'Name',
            contents: [],
            ...validateProperties(validationTemplates.Name)(parseOpen)
        }),
        legalContents: isSchemaTaggedMessageLegalContents,
        finalize: (initialTag: SchemaNameTag, contents: SchemaTaggedMessageLegalContents[] ): SchemaNameTag => ({
            ...initialTag,
            contents
        })
    },
    Room: {
        initialize: ({ parseOpen }): SchemaRoomTag => {
            const { x, y, ...rest } = validateProperties(validationTemplates.Room)(parseOpen)
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
        legalContents: isSchemaRoomIncomingContents,
        finalize: (initialTag: SchemaRoomTag, contents: SchemaRoomLegalIncomingContents[] ): SchemaRoomTag => ({
            ...initialTag,
            contents: contents.filter(isSchemaRoomContents),
            name: extractNameFromContents(contents),
            render: extractDescriptionFromContents(contents)
        })
    },
    Feature: {
        initialize: ({ parseOpen }): SchemaFeatureTag => ({
            tag: 'Feature',
            contents: [],
            render: [],
            name: [],
            ...validateProperties(validationTemplates.Feature)(parseOpen)
        }),
        legalContents: isSchemaFeatureIncomingContents,
        finalize: (initialTag: SchemaFeatureTag, contents: SchemaFeatureLegalContents[] ): SchemaFeatureTag => ({
            ...initialTag,
            contents,
            name: extractNameFromContents(contents),
            render: extractDescriptionFromContents(contents)
        })
    },
    Knowledge: {
        initialize: ({ parseOpen }): SchemaKnowledgeTag => ({
            tag: 'Knowledge',
            contents: [],
            render: [],
            name: [],
            ...validateProperties(validationTemplates.Knowledge)(parseOpen)
        }),
        legalContents: isSchemaKnowledgeIncomingContents,
        finalize: (initialTag: SchemaKnowledgeTag, contents: SchemaKnowledgeLegalContents[] ): SchemaKnowledgeTag => ({
            ...initialTag,
            name: extractNameFromContents(contents),
            render: extractDescriptionFromContents(contents)
        })
    },
    Map: {
        initialize: ({ parseOpen }): SchemaMapTag => ({
            tag: 'Map',
            contents: [],
            name: [],
            rooms: [],
            images: [],
            ...validateProperties(validationTemplates.Map)(parseOpen)
        }),
        legalContents: (item) => (isSchemaMapContents(item) || isSchemaName(item)),
        finalize: (initialTag: SchemaMapTag, contents: SchemaMapLegalContents[] ): SchemaMapTag => ({
            ...initialTag,
            contents: contents.filter(isSchemaMapContents),
            name: extractNameFromContents(contents),
            rooms: extractConditionedItemFromContents({
                contents: contents as SchemaMapLegalContents[],
                typeGuard: isSchemaRoom,
                transform: ({ key, x, y }) => ({ conditions: [], key, x, y })
            }),
            images: (contents as SchemaTag[]).filter(isSchemaImage).map(({ key }) => (key))
        })
    },
    Message: {
        initialize: ({ parseOpen }): SchemaMessageTag => ({
            tag: 'Message',
            contents: [],
            render: [],
            rooms: [],
            ...validateProperties(validationTemplates.Message)(parseOpen)
        }),
        legalContents: isSchemaMessageContents,
        finalize: (initialTag: SchemaMessageTag, contents: SchemaMessageLegalContents[] ): SchemaMessageTag => ({
            ...initialTag,
            render: contents.filter(isSchemaTaggedMessageLegalContents),
            contents: contents.filter(isSchemaRoom),
            rooms: contents.reduce((previous, room) => (
                isSchemaRoom(room)
                    ? [
                        ...previous,
                        { key: room.key }
                    ]
                    : previous
            ), [])
        })
    },
    Moment: {
        initialize: ({ parseOpen }): SchemaMomentTag => ({
            tag: 'Moment',
            contents: [],
            ...validateProperties(validationTemplates.Moment)(parseOpen)
        }),
        legalContents: isSchemaMessage,
        finalize: (initialTag: SchemaMomentTag, contents: SchemaMessageTag[] ): SchemaMomentTag => ({
            ...initialTag,
            contents
        })
    },
}

export default converterMap
