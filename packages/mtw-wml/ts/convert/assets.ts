import { ParseAssetLegalContents, ParseAssetTag, ParseStackTagEntry, ParseStoryTag, ParseTagFactoryPropsLimited } from "../parser/baseClasses";
import { BaseConverter, Constructor, parseConverterMixin, isTypedParseTagOpen, MixinInheritedParameters, MixinInheritedReturn } from "./functionMixins";

export const ParseAssetsMixin = <C extends Constructor<BaseConverter>>(Base: C) => {
    return class ParseAssetsMixin extends Base {
        override parseConvert(value: ParseTagFactoryPropsLimited<'Asset'>): ParseStackTagEntry<ParseAssetTag>
        override parseConvert(value: ParseTagFactoryPropsLimited<'Story'>): ParseStackTagEntry<ParseStoryTag>
        override parseConvert(value: MixinInheritedParameters<C> | ParseTagFactoryPropsLimited<'Asset'> | ParseTagFactoryPropsLimited<'Story'>): ParseStackTagEntry<ParseAssetTag> | ParseStackTagEntry<ParseStoryTag> | MixinInheritedReturn<C> {
            //
            // Convert Asset tag-opens
            //
            if (isTypedParseTagOpen('Asset')(value)) {
                return parseConverterMixin<ParseAssetTag, ParseAssetLegalContents>({
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
                })(value)
            }
            //
            // Convert Story tag-opens
            //
            else if (isTypedParseTagOpen('Story')(value)) {
                return parseConverterMixin<ParseStoryTag, ParseAssetLegalContents>({
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
                })(value)
            }
            else {
                const returnValue = (super.parseConvert as any)(value)
                if (!Boolean(returnValue)) {
                    throw new Error('Invalid parameter')
                }
                return returnValue as MixinInheritedReturn<C>
            }
        }
    }
}

export default ParseAssetsMixin