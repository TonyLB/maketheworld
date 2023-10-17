import { SchemaCharacterLegalContents, SchemaCharacterTag, SchemaFirstImpressionTag, SchemaOneCoolThingTag, SchemaOutfitTag, SchemaPronounsTag, SchemaStringTag, SchemaTag, isSchemaCharacterContents, isSchemaFirstImpression, isSchemaName, isSchemaOneCoolThing, isSchemaOutfit, isSchemaPronouns, isSchemaString } from "../../schema/baseClasses"
import { ParsePropertyTypes } from "../../simpleParser/baseClasses"
import { ConverterMapEntry } from "./baseClasses"
import { validateProperties } from "./utils"

const characterTemplates = {
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
    }
} as const

export const characterConverters: Record<string, ConverterMapEntry> = {
    Pronouns: {
        initialize: ({ parseOpen }): SchemaPronounsTag => ({
            tag: 'Pronouns',
            ...validateProperties(characterTemplates.Pronouns)(parseOpen)
        })
    },
    FirstImpression: {
        initialize: ({ parseOpen }): SchemaFirstImpressionTag => ({
            tag: 'FirstImpression',
            contents: [],
            value: '',
            ...validateProperties(characterTemplates.FirstImpression)(parseOpen)
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
            ...validateProperties(characterTemplates.OneCoolThing)(parseOpen)
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
            ...validateProperties(characterTemplates.Outfit)(parseOpen)
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
            ...validateProperties(characterTemplates.Character)(parseOpen)
        }),
        legalContents: isSchemaCharacterContents,
        finalize: (initialTag: SchemaCharacterTag, contents: SchemaCharacterLegalContents[]): SchemaCharacterTag => {
            const { tag, ...Pronouns } = [{ tag: '', ...initialTag.Pronouns }, ...contents.filter(isSchemaPronouns)].slice(-1)[0]
            return {
                ...initialTag,
                Name: contents.filter(isSchemaName).map(({ contents }) => (contents)).flat(1).filter(isSchemaString).map(({ value }) => (value)).join(''),
                Pronouns,
                FirstImpression: (contents as SchemaTag[]).filter(isSchemaFirstImpression).length ? (contents as SchemaTag[]).filter(isSchemaFirstImpression).map(({ value }) => (value)).join('') : undefined,
                OneCoolThing: (contents as SchemaTag[]).filter(isSchemaOneCoolThing).length ? (contents as SchemaTag[]).filter(isSchemaOneCoolThing).map(({ value }) => (value)).join('') : undefined,
                Outfit: (contents as SchemaTag[]).filter(isSchemaOutfit).length ? (contents as SchemaTag[]).filter(isSchemaOutfit).map(({ value }) => (value)).join('') : undefined,
                contents
            }
        }
    }
}
