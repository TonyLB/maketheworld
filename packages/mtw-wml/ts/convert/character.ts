import { ParseCharacterTag, ParseImageTag, ParseNameTag, ParseOneCoolThingTag, ParseOutfitTag, ParsePronounsTag, ParseStackTagEntry, ParseStringTag, ParseTagFactoryPropsLimited } from "../parser/baseClasses"
import { BaseConverter, Constructor, parseConverterMixin, isTypedParseTagOpen, MixinInheritedParseParameters, MixinInheritedParseReturn } from "./functionMixins"

const stringLiteralPostProcess = ({ contents = [] }) => ({
    contents,
    value: contents.map(({ value }) => (value)).join(' ')
})

export const ParseCharacterMixin = <C extends Constructor<BaseConverter>>(Base: C) => {
    return class ParseCharacterMixin extends Base {
        override parseConvert(value: ParseTagFactoryPropsLimited<'Character'>): ParseStackTagEntry<ParseCharacterTag>
        override parseConvert(value: ParseTagFactoryPropsLimited<'Pronouns'>): ParseStackTagEntry<ParsePronounsTag>
        override parseConvert(value: ParseTagFactoryPropsLimited<'OneCoolThing'>): ParseStackTagEntry<ParseOneCoolThingTag>
        override parseConvert(value: ParseTagFactoryPropsLimited<'Outfit'>): ParseStackTagEntry<ParseOutfitTag>
        override parseConvert(value: MixinInheritedParseParameters<C>
                | ParseTagFactoryPropsLimited<'Character'>
                | ParseTagFactoryPropsLimited<'Pronouns'>
                | ParseTagFactoryPropsLimited<'OneCoolThing'>
                | ParseTagFactoryPropsLimited<'Outfit'>
                ): MixinInheritedParseReturn<C>
                | ParseStackTagEntry<ParseCharacterTag>
                | ParseStackTagEntry<ParsePronounsTag>
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
                        legal: ['Name', 'Pronouns', 'Outfit', 'OneCoolThing', 'Image'],
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
    }
}

export default ParseCharacterMixin
