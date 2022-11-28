import { ParseAssetLegalContents, ParseAssetTag, ParseStoryTag } from "../parser/baseClasses";
import { BaseConverter, Constructor, SimpleParseConverterMixinFactory } from "./functionMixins";

const ParseAssetTagMixin = SimpleParseConverterMixinFactory<ParseAssetTag, ParseAssetLegalContents>({
    tag: 'Asset',
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
        legal: ['Action', 'Computed', 'If', 'Else', 'ElseIf', 'Exit', 'Feature', 'Bookmark', 'Import', 'Room', 'Variable', 'Map'],
        ignore: ['Whitespace', 'Comment']
    }
})

const ParseStoryMixin = SimpleParseConverterMixinFactory<ParseStoryTag, ParseAssetLegalContents>({
    tag: 'Story',
    properties: {
        required: {
            key: ['key']
        },
        optional: {
            fileName: ['literal'],
            zone: ['literal'],
            subFolder: ['literal'],
            player: ['literal'],
            instance: ['boolean']
        }
    },
    contents: {
        legal: ['Action', 'Computed', 'If', 'Else', 'ElseIf', 'Exit', 'Feature', 'Bookmark', 'Import', 'Room', 'Variable', 'Map'],
        ignore: ['Whitespace', 'Comment']
    }
})

export const ParseAssetsMixin = <C extends Constructor<BaseConverter>>(Base: C) => (
    ParseStoryMixin(
    ParseAssetTagMixin(
        Base
    ))
)

export default ParseAssetsMixin