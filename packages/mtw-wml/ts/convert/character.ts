import { ParseCharacterTag, ParseImageTag, ParseNameTag, ParseOneCoolThingTag, ParseOutfitTag, ParsePronounsTag, ParseStringTag } from "../parser/baseClasses"
import { BaseConverter, Constructor, SimpleParseConverterMixinFactory } from "./functionMixins"

const ParseCharacterTagMixin = SimpleParseConverterMixinFactory<ParseCharacterTag, ParseNameTag | ParsePronounsTag | ParseOutfitTag | ParseOneCoolThingTag | ParseImageTag>({
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
})

const stringLiteralPostProcess = ({ contents = [] }) => ({
    contents,
    value: contents.map(({ value }) => (value)).join(' ')
})

const ParseOneCoolThingMixin = SimpleParseConverterMixinFactory<ParseOneCoolThingTag, ParseStringTag>({
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
})

const ParseOutfitMixin = SimpleParseConverterMixinFactory<ParseOutfitTag, ParseStringTag>({
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
})

const ParsePronounsMixin = SimpleParseConverterMixinFactory<ParsePronounsTag, ParseStringTag>({
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
})

export const ParseCharacterMixin = <C extends Constructor<BaseConverter>>(Base: C) => (
    ParseCharacterTagMixin(
    ParseOneCoolThingMixin(
    ParseOutfitMixin(
    ParsePronounsMixin(
        Base
    ))))
)

export default ParseCharacterMixin
