import { isParseCharacter, isParseFirstImpression, isParseOneCoolThing, isParseOutfit, isParsePronouns, ParseCharacterTag, ParseFirstImpressionTag, ParseImageTag, ParseNameTag, ParseOneCoolThingTag, ParseOutfitTag, ParsePronounsTag, ParseStackTagEntry, ParseStringTag, ParseTagFactoryPropsLimited } from "../parser/baseClasses"
import { isSchemaCharacter, isSchemaFirstImpression, isSchemaImage, isSchemaName, isSchemaOneCoolThing, isSchemaOutfit, isSchemaPronouns, SchemaCharacterLegalContents, SchemaCharacterTag, SchemaFirstImpressionTag, SchemaLiteralLegalContents, SchemaOneCoolThingTag, SchemaOutfitTag, SchemaPronounsTag, SchemaStringTag, SchemaTag } from "../schema/baseClasses"
import { BaseConverter, Constructor, parseConverterMixin, isTypedParseTagOpen, MixinInheritedParseParameters, MixinInheritedParseReturn, MixinInheritedSchemaParameters, MixinInheritedSchemaContents, MixinInheritedSchemaReturn, SchemaToWMLOptions } from "./functionMixins"
import { tagRender } from "./utils/tagRender"

const stringLiteralPostProcess = ({ contents = [] }) => ({
    contents,
    value: contents.map(({ value }) => (value)).join(' ')
})

export const ParseCharacterMixin = <C extends Constructor<BaseConverter>>(Base: C) => {
    return class ParseCharacterMixin extends Base {
        override parseConvert(value: ParseTagFactoryPropsLimited<'Character'>): ParseStackTagEntry<ParseCharacterTag>
        override parseConvert(value: ParseTagFactoryPropsLimited<'Pronouns'>): ParseStackTagEntry<ParsePronounsTag>
        override parseConvert(value: ParseTagFactoryPropsLimited<'FirstImpression'>): ParseStackTagEntry<ParseFirstImpressionTag>
        override parseConvert(value: ParseTagFactoryPropsLimited<'OneCoolThing'>): ParseStackTagEntry<ParseOneCoolThingTag>
        override parseConvert(value: ParseTagFactoryPropsLimited<'Outfit'>): ParseStackTagEntry<ParseOutfitTag>
        override parseConvert(value: MixinInheritedParseParameters<C>
                | ParseTagFactoryPropsLimited<'Character'>
                | ParseTagFactoryPropsLimited<'Pronouns'>
                | ParseTagFactoryPropsLimited<'FirstImpression'>
                | ParseTagFactoryPropsLimited<'OneCoolThing'>
                | ParseTagFactoryPropsLimited<'Outfit'>
                ): MixinInheritedParseReturn<C>
                | ParseStackTagEntry<ParseCharacterTag>
                | ParseStackTagEntry<ParsePronounsTag>
                | ParseStackTagEntry<ParseFirstImpressionTag>
                | ParseStackTagEntry<ParseOneCoolThingTag>
                | ParseStackTagEntry<ParseOutfitTag>
                {
            //
            // Convert Character tag-opens
            //
            if (isTypedParseTagOpen('Character')(value)) {
                return parseConverterMixin<ParseCharacterTag, ParseNameTag | ParsePronounsTag | ParseOutfitTag | ParseOneCoolThingTag | ParseImageTag>({
                    tag: 'Character',
                    properties: {
                        required: {
                            key: ['key']
                        },
                        optional: {
                            fileName: ['literal'],
                            zone: ['literal'],
                            subFolder: ['literal'],
                            player: ['literal']
                        }
                    },
                    contents: {
                        legal: ['Name', 'Pronouns', 'Outfit', 'OneCoolThing', 'Image', 'FirstImpression'],
                        ignore: ['Whitespace', 'Comment']
                    }
                })(value)
            }
            //
            // Convert Pronouns tag-opens
            //
            else if (isTypedParseTagOpen('Pronouns')(value)) {
                return parseConverterMixin<ParsePronounsTag, never>({
                    tag: 'Pronouns',
                    properties: {
                        required: {
                            subject: ['literal'],
                            object: ['literal'],
                            possessive: ['literal'],
                            adjective: ['literal'],
                            reflexive: ['literal']
                        },
                        optional: {}
                    }
                })(value)
            }
            //
            // Convert OneCoolThing tag-opens
            //
            else if (isTypedParseTagOpen('FirstImpression')(value)) {
                return parseConverterMixin<ParseFirstImpressionTag, ParseStringTag>({
                    tag: 'FirstImpression',
                    properties: {
                        required: {},
                        optional: {}
                    },
                    contents: {
                        legal: ['String'],
                        ignore: ['Whitespace', 'Comment']
                    },
                    postProcess: stringLiteralPostProcess
                })(value)
            }
            //
            // Convert OneCoolThing tag-opens
            //
            else if (isTypedParseTagOpen('OneCoolThing')(value)) {
                return parseConverterMixin<ParseOneCoolThingTag, ParseStringTag>({
                    tag: 'OneCoolThing',
                    properties: {
                        required: {},
                        optional: {}
                    },
                    contents: {
                        legal: ['String'],
                        ignore: ['Whitespace', 'Comment']
                    },
                    postProcess: stringLiteralPostProcess
                })(value)
            }
            //
            // Convert Outfit tag-opens
            //
            else if (isTypedParseTagOpen('Outfit')(value)) {
                return parseConverterMixin<ParseOutfitTag, ParseStringTag>({
                    tag: 'Outfit',
                    properties: {
                        required: {},
                        optional: {}
                    },
                    contents: {
                        legal: ['String'],
                        ignore: ['Whitespace', 'Comment']
                    },
                    postProcess: stringLiteralPostProcess
                })(value)
            }
            else {
                const returnValue = (super.parseConvert as any)(value)
                if (!Boolean(returnValue)) {
                    throw new Error('Invalid parameter')
                }
                return returnValue as MixinInheritedParseReturn<C>
            }
        }

        override schemaConvert(item: ParsePronounsTag, siblings: SchemaTag[], contents: SchemaTag[]): SchemaPronounsTag
        override schemaConvert(item: ParseFirstImpressionTag, siblings: SchemaTag[], contents: SchemaTag[]): SchemaFirstImpressionTag
        override schemaConvert(item: ParseOneCoolThingTag, siblings: SchemaTag[], contents: SchemaTag[]): SchemaOneCoolThingTag
        override schemaConvert(item: ParseOutfitTag, siblings: SchemaTag[], contents: SchemaTag[]): SchemaOutfitTag
        override schemaConvert(item: ParseCharacterTag, siblings: SchemaTag[], contents: SchemaTag[]): SchemaCharacterTag
        override schemaConvert(
                item: MixinInheritedSchemaParameters<C>
                    | ParsePronounsTag
                    | ParseFirstImpressionTag
                    | ParseOneCoolThingTag
                    | ParseOutfitTag
                    | ParseCharacterTag,
                siblings: SchemaTag[],
                contents: MixinInheritedSchemaContents<C> | SchemaTag[]
            ): MixinInheritedSchemaReturn<C>
                | SchemaPronounsTag
                | SchemaFirstImpressionTag
                | SchemaOneCoolThingTag
                | SchemaOutfitTag
                | SchemaCharacterTag {
            if (isParsePronouns(item)) {
                return {
                    tag: 'Pronouns',
                    subject: item.subject,
                    object: item.object,
                    possessive: item.possessive,
                    adjective: item.adjective,
                    reflexive: item.reflexive,
                    parse: item
                }            
            }
            else if (isParseFirstImpression(item)) {
                return {
                    tag: 'FirstImpression',
                    value: item.value,
                    parse: item,
                    contents: contents as SchemaLiteralLegalContents[]
                }            
            }
            else if (isParseOneCoolThing(item)) {
                return {
                    tag: 'OneCoolThing',
                    value: item.value,
                    parse: item,
                    contents: contents as SchemaLiteralLegalContents[]
                }            
            }
            else if (isParseOutfit(item)) {
                return {
                    tag: 'Outfit',
                    value: item.value,
                    parse: item,
                    contents: contents as SchemaLiteralLegalContents[]
                }            
            }
            else if (isParseCharacter(item)) {
                return {
                    tag: 'Character',
                    key: item.key,
                    fileName: item.fileName,
                    zone: item.zone,
                    subFolder: item.subFolder,
                    player: item.player,
                    //
                    // TODO: Extend Character Name to render more complicated TaggedMessage predicates
                    //
                    Name: (contents as SchemaTag[]).filter(isSchemaName)
                        .map(({ contents }) => (contents))
                        .reduce((previous, item) => ([ ...previous, ...item ]), [])
                        .filter((item): item is SchemaStringTag => (item.tag === 'String'))
                        .map(({ value }) => (value))
                        .join(''),
                    Pronouns: (contents as SchemaTag[]).filter(isSchemaPronouns).reduce((previous, { tag, parse, ...rest }) => (rest), {
                        subject: 'they',
                        object: 'them',
                        possessive: 'theirs',
                        adjective: 'their',
                        reflexive: 'themself'
                    }),
                    FirstImpression: (contents as SchemaTag[]).filter(isSchemaFirstImpression).length ? (contents as SchemaTag[]).filter(isSchemaFirstImpression).map(({ value }) => (value)).join('') : undefined,
                    OneCoolThing: (contents as SchemaTag[]).filter(isSchemaOneCoolThing).length ? (contents as SchemaTag[]).filter(isSchemaOneCoolThing).map(({ value }) => (value)).join('') : undefined,
                    Outfit: (contents as SchemaTag[]).filter(isSchemaOutfit).length ? (contents as SchemaTag[]).filter(isSchemaOutfit).map(({ value }) => (value)).join('') : undefined,
                    contents: contents as SchemaCharacterLegalContents[],
                    parse: item
                } as SchemaCharacterTag
            }
            else {
                const returnValue = (super.schemaConvert as any)(item, siblings, contents)
                if (!Boolean(returnValue)) {
                    throw new Error('Invalid parameter')
                }
                return returnValue as MixinInheritedSchemaReturn<C>
            }
        }

        override schemaToWML(value: SchemaTag, options: SchemaToWMLOptions): string {
            const stringToLiteral = (value: string | undefined, tag: 'FirstImpression' | 'Outfit' | 'OneCoolThing'): SchemaTag[] => (
                value ? [{ tag, value, contents: [{ tag: 'String' as 'String', value }] }] : []
            )
            const schemaToWML = (value: SchemaTag) => (this.schemaToWML(value, { indent: options.indent + 1 }))
            const tagRenderLiteral = (tag: 'FirstImpression' | 'Outfit' | 'OneCoolThing', value: string, options: SchemaToWMLOptions): string => (
                tagRender({
                    ...options,
                    schemaToWML,
                    tag,
                    properties: [],
                    contents: [{ tag: 'String' as 'String', value }]
                })
            )
            if (isSchemaCharacter(value)) {
                return tagRender({
                    ...options,
                    schemaToWML,
                    tag: 'Character',
                    properties: [
                        { key: 'key', type: 'key', value: value.key }
                    ],
                    contents: [
                        ...(value.Name ? [{ tag: 'Name' as 'Name', contents: [{ tag: 'String' as 'String', value: value.Name }] }] : []),
                        ...(value.Pronouns ? [{
                            ...value.Pronouns,
                            tag: 'Pronouns' as 'Pronouns'
                        }] : []),
                        ...stringToLiteral(value.FirstImpression, 'FirstImpression'),
                        ...stringToLiteral(value.Outfit, 'Outfit'),
                        ...stringToLiteral(value.OneCoolThing, 'OneCoolThing'),
                        //
                        // TODO: Refactor how Character WML stores image, and write out
                        // an Image element here if needed
                        //
                    ],
                })
            }
            else if (isSchemaFirstImpression(value)) {
                return tagRenderLiteral('FirstImpression', value.value, options)
            }
            else if (isSchemaOutfit(value)) {
                return tagRenderLiteral('Outfit', value.value, options)
            }
            else if (isSchemaOneCoolThing(value)) {
                return tagRenderLiteral('OneCoolThing', value.value, options)
            }
            else if (isSchemaPronouns(value)) {
                return tagRender({
                    ...options,
                    schemaToWML,
                    tag: 'Pronouns',
                    properties: [
                        { key: 'subject', type: 'literal', value: value.subject},
                        { key: 'object', type: 'literal', value: value.object},
                        { key: 'possessive', type: 'literal', value: value.possessive},
                        { key: 'adjective', type: 'literal', value: value.adjective},
                        { key: 'reflexive', type: 'literal', value: value.reflexive}
                    ],
                    contents: []
                })
            }
            else {
                const returnValue = (super.schemaToWML as any)(value, options)
                if (!(typeof returnValue === 'string')) {
                    throw new Error('Invalid parameter')
                }
                return returnValue
            }
        }

    }
}

export default ParseCharacterMixin
