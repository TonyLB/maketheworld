import { SchemaCharacterLegalContents, SchemaCharacterTag, SchemaFirstImpressionTag, SchemaOneCoolThingTag, SchemaOutfitTag, SchemaPronounsTag, SchemaStringTag, SchemaTag, isSchemaCharacterContents, isSchemaFirstImpression, isSchemaImage, isSchemaImport, isSchemaName, isSchemaOneCoolThing, isSchemaOutfit, isSchemaPronouns, isSchemaString } from "../baseClasses"
import { ParsePropertyTypes } from "../../simpleParser/baseClasses"
import { ConverterMapEntry, PrintMapEntry, PrintMapEntryArguments } from "./baseClasses"
import { tagRender } from "./tagRender"
import { validateProperties } from "./utils"
import { GenericTree, GenericTreeFiltered, GenericTreeNode, GenericTreeNodeFiltered } from "../../sequence/tree/baseClasses"

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
        typeCheckContents: isSchemaString,
        finalize: (initialTag: SchemaFirstImpressionTag, contents: GenericTreeFiltered<SchemaStringTag, SchemaTag>): GenericTreeNodeFiltered<SchemaFirstImpressionTag, SchemaTag> => ({
            data: {
                ...initialTag,
                value: contents.map(({ data: { value } }) => (value)).join('')
            },
            children: []
        })
    },
    OneCoolThing: {
        initialize: ({ parseOpen }): SchemaOneCoolThingTag => ({
            tag: 'OneCoolThing',
            contents: [],
            value: '',
            ...validateProperties(characterTemplates.OneCoolThing)(parseOpen)
        }),
        typeCheckContents: isSchemaString,
        finalize: (initialTag: SchemaOneCoolThingTag, contents: GenericTreeFiltered<SchemaStringTag, SchemaTag>): GenericTreeNodeFiltered<SchemaOneCoolThingTag, SchemaTag> => ({
            data: {
                ...initialTag,
                value: contents.map(({ data: { value } }) => (value)).join('')
            },
            children: []
        })
    },
    Outfit: {
        initialize: ({ parseOpen }): SchemaOutfitTag => ({
            tag: 'Outfit',
            contents: [],
            value: '',
            ...validateProperties(characterTemplates.Outfit)(parseOpen)
        }),
        typeCheckContents: isSchemaString,
        finalize: (initialTag: SchemaOutfitTag, contents: GenericTreeFiltered<SchemaStringTag, SchemaTag>): GenericTreeNodeFiltered<SchemaOutfitTag, SchemaTag> => ({
            data: {
                ...initialTag,
                value: contents.map(({ data: { value } }) => (value)).join('')
            },
            children: []
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
        typeCheckContents: isSchemaCharacterContents,
        finalize: (initialTag: SchemaCharacterTag, contents: GenericTreeFiltered<SchemaCharacterLegalContents, SchemaTag>): GenericTreeNodeFiltered<SchemaCharacterTag, SchemaTag> => {
            const { tag, ...Pronouns } = [{ tag: '', ...initialTag.Pronouns }, ...contents.map(({ data }) => (data)).filter(isSchemaPronouns)].slice(-1)[0]
            return {
                data: {
                    ...initialTag,
                    Name: contents.filter(({ data }) => (isSchemaName(data))).map(({ children }) => (children)).flat(1).map(({ data }) => (data)).filter(isSchemaString).map(({ value }) => (value)).join(''),
                    Pronouns,
                    FirstImpression: (contents.map(({ data }) => (data)) as SchemaTag[]).filter(isSchemaFirstImpression).length ? (contents.map(({ data }) => (data)) as SchemaTag[]).filter(isSchemaFirstImpression).map(({ value }) => (value)).join('') : undefined,
                    OneCoolThing: (contents.map(({ data }) => (data)) as SchemaTag[]).filter(isSchemaOneCoolThing).length ? (contents.map(({ data }) => (data)) as SchemaTag[]).filter(isSchemaOneCoolThing).map(({ value }) => (value)).join('') : undefined,
                    Outfit: (contents.map(({ data }) => (data)) as SchemaTag[]).filter(isSchemaOutfit).length ? (contents.map(({ data }) => (data)) as SchemaTag[]).filter(isSchemaOutfit).map(({ value }) => (value)).join('') : undefined,
                    contents: []
                },
                children: contents
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