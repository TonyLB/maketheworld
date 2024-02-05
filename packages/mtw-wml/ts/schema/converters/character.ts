import { SchemaCharacterLegalContents, SchemaCharacterTag, SchemaFirstImpressionTag, SchemaOneCoolThingTag, SchemaOutfitTag, SchemaPronounsTag, SchemaStringTag, SchemaTag, isSchemaCharacter, isSchemaCharacterContents, isSchemaFirstImpression, isSchemaImage, isSchemaImport, isSchemaName, isSchemaOneCoolThing, isSchemaOutfit, isSchemaPronouns, isSchemaString } from "../baseClasses"
import { ParsePropertyTypes } from "../../simpleParser/baseClasses"
import { ConverterMapEntry, PrintMapEntry, PrintMapEntryArguments } from "./baseClasses"
import { tagRender } from "./tagRender"
import { validateProperties } from "./utils"
import { GenericTree, GenericTreeFiltered, GenericTreeNode, GenericTreeNodeFiltered } from "../../tree/baseClasses"

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
            value: '',
            ...validateProperties(characterTemplates.FirstImpression)(parseOpen)
        }),
        typeCheckContents: isSchemaString,
        finalize: (initialTag: SchemaTag, children: GenericTree<SchemaTag>): GenericTreeNodeFiltered<SchemaFirstImpressionTag, SchemaTag> => {
            if (!isSchemaFirstImpression(initialTag)) {
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
    OneCoolThing: {
        initialize: ({ parseOpen }): SchemaOneCoolThingTag => ({
            tag: 'OneCoolThing',
            value: '',
            ...validateProperties(characterTemplates.OneCoolThing)(parseOpen)
        }),
        typeCheckContents: isSchemaString,
        finalize: (initialTag: SchemaTag, children: GenericTree<SchemaTag>): GenericTreeNodeFiltered<SchemaOneCoolThingTag, SchemaTag> => {
            if (!isSchemaOneCoolThing(initialTag)) {
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
    Outfit: {
        initialize: ({ parseOpen }): SchemaOutfitTag => ({
            tag: 'Outfit',
            value: '',
            ...validateProperties(characterTemplates.Outfit)(parseOpen)
        }),
        typeCheckContents: isSchemaString,
        finalize: (initialTag: SchemaTag, children: GenericTree<SchemaTag>): GenericTreeNodeFiltered<SchemaOutfitTag, SchemaTag> => {
            if (!isSchemaOutfit(initialTag)) {
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
    Character: {
        initialize: ({ parseOpen }): SchemaCharacterTag => ({
            tag: 'Character',
            Pronouns: {
                subject: 'they',
                object: 'them',
                possessive: 'their',
                adjective: 'theirs',
                reflexive: 'themself'
            },
            ...validateProperties(characterTemplates.Character)(parseOpen)
        }),
        typeCheckContents: isSchemaCharacterContents,
        finalize: (initialTag: SchemaTag, contents: GenericTree<SchemaTag>): GenericTreeNodeFiltered<SchemaCharacterTag, SchemaTag> => {
            if (!isSchemaCharacter(initialTag)) {
                throw new Error('Type mismatch on schema finalize')
            }
            const { tag, ...Pronouns } = [{ tag: '', ...initialTag.Pronouns }, ...contents.map(({ data }) => (data)).filter(isSchemaPronouns)].slice(-1)[0]
            return {
                data: {
                    ...initialTag,
                    Pronouns
                },
                children: contents
            }
        }
    }
}

const tagRenderLiteral = (tag: SchemaTag, args: PrintMapEntryArguments): string => (
    (isSchemaFirstImpression(tag) || isSchemaOneCoolThing(tag) || isSchemaOutfit(tag))
        ? tagRender({
            ...args,
            tag: tag.tag,
            properties: [],
            contents: [{ data: { tag: 'String' as 'String', value: tag.value }, children: [] }]
        })
        : ''
)

export const characterPrintMap: Record<string, PrintMapEntry> = {
    Character: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments) => (
        isSchemaCharacter(tag)
            ? tagRender({
                ...args,
                tag: 'Character',
                properties: [
                    { key: 'key', type: 'key', value: tag.key }
                ],
                contents: children,
            })
            : ''
    ),
    FirstImpression: (args: PrintMapEntryArguments) => (tagRenderLiteral(args.tag.data, args)),
    OneCoolThing: (args: PrintMapEntryArguments) => (tagRenderLiteral(args.tag.data, args)),
    Outfit: (args: PrintMapEntryArguments) => (tagRenderLiteral(args.tag.data, args)),
    Pronouns: ({ tag: { data: tag }, ...args }: PrintMapEntryArguments) => (
        isSchemaPronouns(tag)
            ? tagRender({
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
            : ''
    )
}