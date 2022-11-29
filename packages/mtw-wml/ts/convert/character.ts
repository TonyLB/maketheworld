import { ParseCharacterTag, ParseImageTag, ParseNameTag, ParseOneCoolThingTag, ParseOutfitTag, ParsePronounsTag, ParseStackTagEntry, ParseStringTag, ParseTagFactoryPropsLimited } from "../parser/baseClasses"
import { BaseConverter, Constructor, converterMixin, isTypedParseTagOpen, MixinInheritedParameters, MixinInheritedReturn } from "./functionMixins"

const stringLiteralPostProcess = ({ contents = [] }) => ({
    contents,
    value: contents.map(({ value }) => (value)).join(' ')
})

export const ParseCharacterMixin = <C extends Constructor<BaseConverter>>(Base: C) => {
    return class ParseCharacterMixin extends Base {
        override convert(value: ParseTagFactoryPropsLimited<'Character'>): ParseStackTagEntry<ParseCharacterTag>
        override convert(value: ParseTagFactoryPropsLimited<'Pronouns'>): ParseStackTagEntry<ParsePronounsTag>
        override convert(value: ParseTagFactoryPropsLimited<'OneCoolThing'>): ParseStackTagEntry<ParseOneCoolThingTag>
        override convert(value: ParseTagFactoryPropsLimited<'Outfit'>): ParseStackTagEntry<ParseOutfitTag>
        override convert(value: MixinInheritedParameters<C>
                | ParseTagFactoryPropsLimited<'Character'>
                | ParseTagFactoryPropsLimited<'Pronouns'>
                | ParseTagFactoryPropsLimited<'OneCoolThing'>
                | ParseTagFactoryPropsLimited<'Outfit'>
                ): MixinInheritedReturn<C>
                | ParseStackTagEntry<ParseCharacterTag>
                | ParseStackTagEntry<ParsePronounsTag>
                | ParseStackTagEntry<ParseOneCoolThingTag>
                | ParseStackTagEntry<ParseOutfitTag>
                {
            //
            // Convert Character tag-opens
            //
            if (isTypedParseTagOpen('Character')(value)) {
                return converterMixin<ParseCharacterTag, ParseNameTag | ParsePronounsTag | ParseOutfitTag | ParseOneCoolThingTag | ParseImageTag>({
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
                return converterMixin<ParsePronounsTag, never>({
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
                return converterMixin<ParseOneCoolThingTag, ParseStringTag>({
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
                return converterMixin<ParseOutfitTag, ParseStringTag>({
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
                const returnValue = (super.convert as any)(value)
                if (!Boolean(returnValue)) {
                    throw new Error('Invalid parameter')
                }
                return returnValue as MixinInheritedReturn<C>
            }
        }
    }
}

export default ParseCharacterMixin
