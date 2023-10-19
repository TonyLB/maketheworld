import { SchemaCharacterLegalContents, SchemaCharacterTag, SchemaFirstImpressionTag, SchemaOneCoolThingTag, SchemaOutfitTag, SchemaPronounsTag, SchemaStringTag, SchemaTag, isSchemaCharacterContents, isSchemaFirstImpression, isSchemaImage, isSchemaImport, isSchemaName, isSchemaOneCoolThing, isSchemaOutfit, isSchemaPronouns, isSchemaString } from "../baseClasses"
import { ParsePropertyTypes } from "../../simpleParser/baseClasses"
import { ConverterMapEntry, PrintMapEntry, PrintMapEntryArguments } from "./baseClasses"
import { tagRender } from "./tagRender"
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

const stringToLiteral = (value: string | undefined, tag: 'FirstImpression' | 'Outfit' | 'OneCoolThing'): SchemaTag[] => (
    value ? [{ tag, value, contents: [{ tag: 'String' as 'String', value }] }] : []
)

const tagRenderLiteral = (tag: 'FirstImpression' | 'Outfit' | 'OneCoolThing', value: string, args: PrintMapEntryArguments): string => (
    tagRender({
        ...args,
        tag,
        properties: [],
        contents: [{ tag: 'String' as 'String', value }]
    })
)

export const characterPrintMap: Record<string, PrintMapEntry> = {
    Character: ({ tag, ...args }: PrintMapEntryArguments & { tag: SchemaCharacterTag }) => (
        tagRender({
            ...args,
            tag: 'Character',
            properties: [
                { key: 'key', type: 'key', value: tag.key }
            ],
            contents: [
                ...(tag.Name ? [{ tag: 'Name' as 'Name', contents: [{ tag: 'String' as 'String', value: tag.Name }] }] : []),
                ...(tag.Pronouns ? [{
                    ...tag.Pronouns,
                    tag: 'Pronouns' as 'Pronouns'
                }] : []),
                ...stringToLiteral(tag.FirstImpression, 'FirstImpression'),
                ...stringToLiteral(tag.Outfit, 'Outfit'),
                ...stringToLiteral(tag.OneCoolThing, 'OneCoolThing'),
                ...tag.contents.filter((value) => (isSchemaImage(value) || isSchemaImport(value)))
            ],
        })
    ),
    FirstImpression: (args: PrintMapEntryArguments & { tag: SchemaFirstImpressionTag }) => (tagRenderLiteral('FirstImpression', args.tag.value, args)),
    OneCoolThing: (args: PrintMapEntryArguments & { tag: SchemaOneCoolThingTag }) => (tagRenderLiteral('OneCoolThing', args.tag.value, args)),
    Outfit: (args: PrintMapEntryArguments & { tag: SchemaOutfitTag }) => (tagRenderLiteral('Outfit', args.tag.value, args)),
    Pronouns: ({ tag, ...args }: PrintMapEntryArguments & { tag: SchemaPronounsTag }) => (
        tagRender({
            ...args,
            tag: 'Pronouns',
            properties: [
                { key: 'subject', type: 'literal', value: tag.subject},
                { key: 'object', type: 'literal', value: tag.object},
                { key: 'possessive', type: 'literal', value: tag.possessive},
                { key: 'adjective', type: 'literal', value: tag.adjective},
                { key: 'reflexive', type: 'literal', value: tag.reflexive}
            ],
            contents: []
        })
    )
}