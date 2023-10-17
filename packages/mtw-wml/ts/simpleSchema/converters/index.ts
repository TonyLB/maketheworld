import { extractDependenciesFromJS } from "../../convert/utils";
import { isLegalParseConditionContextTag } from "../../parser/baseClasses";
import {
    SchemaActionTag,
    SchemaAfterTag,
    SchemaAssetLegalContents,
    SchemaAssetTag,
    SchemaBeforeTag,
    SchemaBookmarkTag,
    SchemaComputedTag,
    SchemaConditionTag,
    SchemaDescriptionTag,
    SchemaExitTag,
    SchemaFeatureLegalContents,
    SchemaFeatureTag,
    SchemaImageTag,
    SchemaImportTag,
    SchemaKnowledgeLegalContents,
    SchemaKnowledgeTag,
    SchemaLineBreakTag,
    SchemaLinkTag,
    SchemaMapLegalContents,
    SchemaMapTag,
    SchemaMessageLegalContents,
    SchemaMessageTag,
    SchemaMomentTag,
    SchemaNameTag,
    SchemaReplaceTag,
    SchemaRoomLegalIncomingContents,
    SchemaRoomTag,
    SchemaSpacerTag,
    SchemaStoryTag,
    SchemaStringTag,
    SchemaTag,
    SchemaTaggedMessageIncomingContents,
    SchemaTaggedMessageLegalContents,
    SchemaUseTag,
    SchemaVariableTag,
    isSchemaAssetContents,
    isSchemaCondition,
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
import { translateTaggedMessageContents } from "../../schema/taggedMessage";
import { extractConditionedItemFromContents, extractDescriptionFromContents, extractNameFromContents } from "../../schema/utils"
import { ParsePropertyTypes } from "../../simpleParser/baseClasses"
import { SchemaContextItem } from "../baseClasses"
import { ConverterMapEntry } from "./baseClasses"
import { validateProperties } from "./utils"
import { characterConverters } from "./character";

const validationTemplates = {
    Asset: {
        key: { required: true, type: ParsePropertyTypes.Key }
    },
    Story: {
        key: { required: true, type: ParsePropertyTypes.Key },
        instance: { required: true, type: ParsePropertyTypes.Boolean }
    },
    Image: {
        key: { required: true, type: ParsePropertyTypes.Key }
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
    Use: {
        key: { required: true, type: ParsePropertyTypes.Key },
        as: { type: ParsePropertyTypes.Key },
        type: { type: ParsePropertyTypes.Literal }
    },
    Import: {
        from: { required: true, type: ParsePropertyTypes.Key },
    },
    If: {
        DEFAULT: { required: true, type: ParsePropertyTypes.Expression },
    },
    ElseIf: {
        DEFAULT: { required: true, type: ParsePropertyTypes.Expression },
    },
    Else: {},
    Exit: {
        from: { type: ParsePropertyTypes.Key },
        to: { type: ParsePropertyTypes.Key }
    },
    Link: {
        to: { required: true, type: ParsePropertyTypes.Key }
    },
    Description: {},
    After: {},
    Before: {},
    Replace: {},
    Bookmark: {
        key: { required: true, type: ParsePropertyTypes.Key },
        display: { type: ParsePropertyTypes.Literal }
    },
    br: {},
    Space: {},
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

export const conditionalSiblingsConditions = (contextStack: SchemaContextItem[]) => {
    if (contextStack.length === 0) {
        throw new Error('ElseIf cannot be a top-level component')
    }
    const siblings = contextStack.slice(-1)[0].contents
    if (siblings.length === 0) {
        throw new Error('ElseIf must follow an If or ElseIf tag')
    }
    const nearestSibling = siblings.slice(-1)[0]
    if (isSchemaCondition(nearestSibling)) {
        if (nearestSibling.conditions.slice(-1)[0].not) {
            throw new Error('ElseIf must follow an If or ElseIf tag')
        }
    }
    else {
        throw new Error('ElseIf must follow an If or ElseIf tag')
    }
    return nearestSibling.conditions
}

export const conditionLegalContents = (item, contextStack) => {
    const legalContextStack = contextStack.map(({ tag }) => (tag.tag)).filter(isLegalParseConditionContextTag)
    if (legalContextStack.length === 0) {
        throw new Error('Conditional items cannot be top-level')
    }
    const nearestLegalContext = legalContextStack.slice(-1)[0]
    switch(nearestLegalContext) {
        case 'Asset': return isSchemaAssetContents(item)
        case 'Bookmark':
        case 'Description': return isSchemaTaggedMessageLegalContents(item)
        case 'Feature': return isSchemaFeatureIncomingContents(item)
        case 'Knowledge': return isSchemaKnowledgeIncomingContents(item)
        case 'Map': return isSchemaMapContents(item)
        case 'Room': return isSchemaRoomIncomingContents(item)
        default: return false
    }
}

export const conditionFinalize = (initialTag: SchemaConditionTag, contents: SchemaTag[], contextStack: SchemaContextItem[]): SchemaConditionTag => {
    const legalContextStack = contextStack.map(({ tag }) => (tag.tag)).filter(isLegalParseConditionContextTag)
    if (legalContextStack.length === 0) {
        throw new Error('Conditional items cannot be top-level')
    }
    const nearestLegalContext = legalContextStack.slice(-1)[0]
    return {
        ...initialTag,
        contextTag: nearestLegalContext === 'Bookmark' ? 'Description' : nearestLegalContext,
        contents: (['Bookmark', 'Description'].includes(nearestLegalContext))
            ? translateTaggedMessageContents(contents as SchemaTaggedMessageIncomingContents[])
            : contents as any
    }
}

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
    Image: {
        initialize: ({ parseOpen }): SchemaImageTag => ({
            tag: 'Image',
            ...validateProperties(validationTemplates.Image)(parseOpen)
        })
    },
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
    Use: {
        initialize: ({ parseOpen }): SchemaUseTag => ({
            tag: 'Use',
            ...validateProperties(validationTemplates.Use)(parseOpen)
        })
    },
    Import: {
        initialize: ({ parseOpen }): SchemaImportTag => ({
            tag: 'Import',
            mapping: {},
            ...validateProperties(validationTemplates.Import)(parseOpen)
        }),
        legalContents: isSchemaUse,
        finalize: (initialTag: SchemaImportTag, contents: SchemaUseTag[] ): SchemaImportTag => ({
            ...initialTag,
            mapping: contents.reduce((previous, { key, as, type }) => ({
                ...previous,
                [as || key]: { key, type }
            }), {})
        })
    },
    If: {
        initialize: ({ parseOpen }): SchemaConditionTag => {
            const validatedProperties = validateProperties(validationTemplates.If)(parseOpen)
            return {
                tag: 'If',
                contextTag: 'Asset',
                contents: [],
                conditions: [{ if: validatedProperties.DEFAULT, dependencies: extractDependenciesFromJS(validatedProperties.DEFAULT) }]
            }
        },
        legalContents: conditionLegalContents,
        finalize: conditionFinalize
    },
    ElseIf: {
        initialize: ({ parseOpen, contextStack }): SchemaConditionTag => {
            const siblingConditions = conditionalSiblingsConditions(contextStack)
            const validatedProperties = validateProperties(validationTemplates.ElseIf)(parseOpen)
            return {
                tag: 'If',
                contextTag: 'Asset',
                contents: [],
                conditions: [...(siblingConditions.map((condition) => ({ ...condition, not: true }))), { if: validatedProperties.DEFAULT, dependencies: extractDependenciesFromJS(validatedProperties.DEFAULT) }],
            }
        },
        legalContents: conditionLegalContents,
        finalize: conditionFinalize
    },
    Else: {
        initialize: ({ parseOpen, contextStack }): SchemaConditionTag => {
            const siblingConditions = conditionalSiblingsConditions(contextStack)
            validateProperties(validationTemplates.Else)(parseOpen)
            return {
                tag: 'If',
                contextTag: 'Asset',
                contents: [],
                conditions: siblingConditions.map((condition) => ({ ...condition, not: true }))
            }
        },
        legalContents: conditionLegalContents,
        finalize: conditionFinalize
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
    Link: {
        initialize: ({ parseOpen }): SchemaLinkTag => ({
            tag: 'Link',
            text: '',
            ...validateProperties(validationTemplates.Link)(parseOpen)
        }),
        legalContents: isSchemaString,
        finalize: (initialTag: SchemaLinkTag, contents: SchemaStringTag[]) => ({
            ...initialTag,
            text: contents.map(({ value }) => (value)).join('')
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
    After: {
        initialize: ({ parseOpen }): SchemaAfterTag => ({
            tag: 'After',
            contents: [],
            ...validateProperties(validationTemplates.After)(parseOpen)
        })
    },
    Before: {
        initialize: ({ parseOpen }): SchemaBeforeTag => ({
            tag: 'Before',
            contents: [],
            ...validateProperties(validationTemplates.Before)(parseOpen)
        })
    },
    Replace: {
        initialize: ({ parseOpen }): SchemaReplaceTag => ({
            tag: 'Replace',
            contents: [],
            ...validateProperties(validationTemplates.Replace)(parseOpen)
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
    br: {
        initialize: ({ parseOpen }): SchemaLineBreakTag => ({
            tag: 'br',
            ...validateProperties(validationTemplates.br)(parseOpen)
        })
    },
    Space: {
        initialize: ({ parseOpen }): SchemaSpacerTag => ({
            tag: 'Space',
            ...validateProperties(validationTemplates.Space)(parseOpen)
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
