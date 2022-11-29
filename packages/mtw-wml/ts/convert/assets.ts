import { ParseAssetLegalContents, ParseAssetTag, ParseStackTagEntry, ParseStoryTag, ParseTagFactoryPropsLimited } from "../parser/baseClasses";
import { BaseConverter, Constructor, converterMixin, isTypedParseTagOpen, MixinInheritedParameters, MixinInheritedReturn } from "./functionMixins";

export const ParseAssetsMixin = <C extends Constructor<BaseConverter>>(Base: C) => {
    return class ParseAssetsMixin extends Base {
        override convert(value: ParseTagFactoryPropsLimited<'Asset'>): ParseStackTagEntry<ParseAssetTag>
        override convert(value: ParseTagFactoryPropsLimited<'Story'>): ParseStackTagEntry<ParseStoryTag>
        override convert(value: MixinInheritedParameters<C> | ParseTagFactoryPropsLimited<'Asset'> | ParseTagFactoryPropsLimited<'Story'>): ParseStackTagEntry<ParseAssetTag> | ParseStackTagEntry<ParseStoryTag> | MixinInheritedReturn<C> {
            //
            // Convert Asset tag-opens
            //
            if (isTypedParseTagOpen('Asset')(value)) {
                return converterMixin<ParseAssetTag, ParseAssetLegalContents>({
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
                return converterMixin<ParseStoryTag, ParseAssetLegalContents>({
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
                const returnValue = (super.convert as any)(value)
                if (!Boolean(returnValue)) {
                    throw new Error('Invalid parameter')
                }
                return returnValue as MixinInheritedReturn<C>
            }
        }
    }
}

export default ParseAssetsMixin