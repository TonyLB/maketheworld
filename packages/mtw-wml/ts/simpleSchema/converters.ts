import { SchemaActionTag, SchemaAfterTag, SchemaAssetLegalContents, SchemaAssetTag, SchemaBeforeTag, SchemaBookmarkTag, SchemaCharacterLegalContents, SchemaCharacterTag, SchemaComputedTag, SchemaConditionTag, SchemaDescriptionTag, SchemaExitTag, SchemaFeatureLegalContents, SchemaFeatureTag, SchemaFirstImpressionTag, SchemaImageTag, SchemaImportTag, SchemaKnowledgeLegalContents, SchemaKnowledgeTag, SchemaLineBreakTag, SchemaLinkTag, SchemaMapLegalContents, SchemaMapTag, SchemaMessageLegalContents, SchemaMessageTag, SchemaMomentTag, SchemaNameTag, SchemaOneCoolThingTag, SchemaOutfitTag, SchemaPronounsTag, SchemaReplaceTag, SchemaRoomLegalContents, SchemaRoomLegalIncomingContents, SchemaRoomTag, SchemaSpacerTag, SchemaStoryTag, SchemaStringTag, SchemaTag, SchemaTaggedMessageLegalContents, SchemaUseTag, SchemaVariableTag, isSchemaAssetContents, isSchemaCharacterContents, isSchemaFeatureContents, isSchemaFeatureIncomingContents, isSchemaFirstImpression, isSchemaImage, isSchemaKnowledgeContents, isSchemaKnowledgeIncomingContents, isSchemaMapContents, isSchemaMessage, isSchemaMessageContents, isSchemaName, isSchemaOneCoolThing, isSchemaOutfit, isSchemaPronouns, isSchemaRoom, isSchemaRoomContents, isSchemaRoomIncomingContents, isSchemaString, isSchemaTag, isSchemaTaggedMessageLegalContents, isSchemaUse } from "../schema/baseClasses"
import { extractConditionedItemFromContents, extractDescriptionFromContents, extractNameFromContents } from "../schema/utils";
import { ParsePropertyTypes, ParseTagOpen, ParseTagSelfClosure } from "../simpleParser/baseClasses"
import { SchemaContextItem } from "./baseClasses";

export type SchemaConverterArguments = {
    parseOpen: ParseTagOpen | ParseTagSelfClosure;
    contextStack: SchemaContextItem[];
}

export type SchemaInitialConverter = {
    (args: SchemaConverterArguments): SchemaTag
}

type ValidationTemplateItem = {
    required?: boolean;
    type: ParsePropertyTypes;
}

type ValidationTemplate = Record<string, ValidationTemplateItem>

type ValidationTemplateRemap<V extends ValidationTemplate>  ={
    [K in keyof V]: V[K] extends { type: ParsePropertyTypes.Boolean } ? boolean : string
}

type ValidationRequiredKeys<V extends ValidationTemplate> = {[K in keyof V]: V[K] extends { required: true } ? K : never}[keyof V]

type ValidationTemplateOutput<V extends ValidationTemplate> = 
    Partial<ValidationTemplateRemap<V>> &
    Pick<ValidationTemplateRemap<V>, ValidationRequiredKeys<V>>

const validateProperties = <V extends ValidationTemplate>(template: V) => (parse: ParseTagOpen | ParseTagSelfClosure): ValidationTemplateOutput<V> => {
    const unmatchedKey = parse.properties.find(({ key }) => (!((key ?? 'DEFAULT') in template)))
    if (unmatchedKey) {
        throw new Error(`Property '${unmatchedKey.key}' is not allowed in '${parse.tag}' items.`)
    }
    const remap = Object.assign({}, ...Object.entries(template).map(([key, { required, type }]) => {
        const matchedKey = parse.properties.find(({ key: checkKey }) => ((checkKey || 'DEFAULT') === key))
        if (required && !matchedKey) {
            throw new Error(`Property '${key}' is required in '${parse.tag}' items.`)
        }
        if (matchedKey && matchedKey.type !== type) {
            const typeLabel = type === ParsePropertyTypes.Boolean ? 'Boolean' : type === ParsePropertyTypes.Expression ? 'Expression' : type === ParsePropertyTypes.Literal ? 'Literal' : 'Key'
            throw new Error(`Property '${key}' must be of ${typeLabel} type in '${parse.tag}' items.`)
        }
        if (matchedKey) {
            return { [key]: matchedKey.value }
        }
        else {
            return {}
        }
    })) as ValidationTemplateOutput<V>
    return remap
}

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
    Pronouns: {
        subject: { required: true, type: ParsePropertyTypes.Literal },
        object: { required: true, type: ParsePropertyTypes.Literal },
        possessive: { required: true, type: ParsePropertyTypes.Literal },
        adjective: { required: true, type: ParsePropertyTypes.Literal },
        reflexive: { required: true, type: ParsePropertyTypes.Literal }
    },
    FirstImpression: {},
    OneCoolThing: {},
    Outfit: {},
    Character: {
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

type ConverterMapEntry = {
    initialize: SchemaInitialConverter;
    legalContents?: (item: SchemaTag) => boolean;
    finalize?: (initialTag: SchemaTag, contents: SchemaTag[]) => SchemaTag;
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
    Image: {
        initialize: ({ parseOpen }): SchemaImageTag => ({
            tag: 'Image',
            ...validateProperties(validationTemplates.Image)(parseOpen)
        })
    },
    Pronouns: {
        initialize: ({ parseOpen }): SchemaPronounsTag => ({
            tag: 'Pronouns',
            ...validateProperties(validationTemplates.Pronouns)(parseOpen)
        })
    },
    FirstImpression: {
        initialize: ({ parseOpen }): SchemaFirstImpressionTag => ({
            tag: 'FirstImpression',
            contents: [],
            value: '',
            ...validateProperties(validationTemplates.FirstImpression)(parseOpen)
        }),
        legalContents: isSchemaString,
        finalize: (initialTag: SchemaFirstImpressionTag, contents: SchemaStringTag[]): SchemaFirstImpressionTag => ({
            ...initialTag,
            value: contents.map(({ value }) => (value)).join('')
        })
    },
    OneCoolThing: {
        initialize: ({ parseOpen }): SchemaOneCoolThingTag => ({
            tag: 'OneCoolThing',
            contents: [],
            value: '',
            ...validateProperties(validationTemplates.OneCoolThing)(parseOpen)
        }),
        legalContents: isSchemaString,
        finalize: (initialTag: SchemaFirstImpressionTag, contents: SchemaStringTag[]): SchemaFirstImpressionTag => ({
            ...initialTag,
            value: contents.map(({ value }) => (value)).join('')
        })
    },
    Outfit: {
        initialize: ({ parseOpen }): SchemaOutfitTag => ({
            tag: 'Outfit',
            contents: [],
            value: '',
            ...validateProperties(validationTemplates.Outfit)(parseOpen)
        }),
        legalContents: isSchemaString,
        finalize: (initialTag: SchemaFirstImpressionTag, contents: SchemaStringTag[]): SchemaFirstImpressionTag => ({
            ...initialTag,
            value: contents.map(({ value }) => (value)).join('')
        })
    },
    Character: {
        initialize: ({ parseOpen }): SchemaCharacterTag => ({
            tag: 'Character',
            contents: [],
            Pronouns: {
                subject: 'they',
                object: 'them',
                possessive: 'their',
                adjective: 'theirs',
                reflexive: 'themself'
            },
            Name: '',
            ...validateProperties(validationTemplates.Character)(parseOpen)
        }),
        legalContents: isSchemaCharacterContents,
        finalize: (initialTag: SchemaCharacterTag, contents: SchemaCharacterLegalContents[]): SchemaCharacterTag => ({
            ...initialTag,
            Name: contents.filter(isSchemaName).map(({ contents }) => (contents)).flat(1).filter(isSchemaString).map(({ value }) => (value)).join(''),
            Pronouns: [initialTag.Pronouns, ...contents.filter(isSchemaPronouns)].slice(-1)[0],
            FirstImpression: (contents as SchemaTag[]).filter(isSchemaFirstImpression).length ? (contents as SchemaTag[]).filter(isSchemaFirstImpression).map(({ value }) => (value)).join('') : undefined,
            OneCoolThing: (contents as SchemaTag[]).filter(isSchemaOneCoolThing).length ? (contents as SchemaTag[]).filter(isSchemaOneCoolThing).map(({ value }) => (value)).join('') : undefined,
            Outfit: (contents as SchemaTag[]).filter(isSchemaOutfit).length ? (contents as SchemaTag[]).filter(isSchemaOutfit).map(({ value }) => (value)).join('') : undefined,
            contents
        })
    },
    Variable: {
        initialize: ({ parseOpen }): SchemaVariableTag => ({
            tag: 'Variable',
            ...validateProperties(validationTemplates.Variable)(parseOpen)
        })
    },
    Computed: {
        initialize: ({ parseOpen }): SchemaComputedTag => ({
            tag: 'Computed',
            dependencies: [],
            ...validateProperties(validationTemplates.Computed)(parseOpen)
        })
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
        //
        // TODO: If will require much more complicated initialization, because of the
        // degree to which is depends upon its positioning relative to other If clauses.
        //
        // LIKELY: Separate conversions for If/ElseIf/Else ParseOpenTags.
        //
        initialize: ({ parseOpen }): SchemaConditionTag => {
            const validatedProperties = validateProperties(validationTemplates.If)(parseOpen)
            return {
                tag: 'If',
                contextTag: 'Asset',
                contents: [],
                conditions: [{ if: validatedProperties.DEFAULT, dependencies: [] }]
            }
        }
    },
    ElseIf: {
        initialize: ({ parseOpen }): SchemaConditionTag => {
            const validatedProperties = validateProperties(validationTemplates.ElseIf)(parseOpen)
            return {
                tag: 'If',
                contextTag: 'Asset',
                contents: [],
                conditions: [{ if: validatedProperties.DEFAULT, dependencies: [] }]
            }
        }
    },
    Else: {
        initialize: ({ parseOpen }): SchemaConditionTag => {
            return {
                tag: 'If',
                contextTag: 'Asset',
                contents: [],
                conditions: [],
                ...validateProperties(validationTemplates.Else)(parseOpen)
            }
        }
    },
    Exit: {
        //
        // TODO: Exit will require more complicated initialization, because of the
        // degree to which it derives defaults for to/from out of the context in
        // which it exists.
        //
        // MAYBE: Extend initialize function to receive a context list?
        //
        initialize: ({ parseOpen }): SchemaExitTag => ({
            tag: 'Exit',
            name: '',
            contents: [],
            key: '',
            from: '',
            to: '',
            ...validateProperties(validationTemplates.Exit)(parseOpen)
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
            contents,
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
        legalContents: isSchemaMapContents,
        finalize: (initialTag: SchemaMapTag, contents: SchemaMapLegalContents[] ): SchemaMapTag => ({
            ...initialTag,
            contents,
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
