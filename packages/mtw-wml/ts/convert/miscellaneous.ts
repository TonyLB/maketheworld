import { ParseException, ParseExitTag, ParseImageTag, ParseStackTagEntry, ParseStringTag, ParseTagFactoryPropsLimited } from "../parser/baseClasses";
import { BaseConverter, Constructor, parseConverterMixin, isTypedParseTagOpen, MixinInheritedParseParameters, MixinInheritedParseReturn } from "./functionMixins";

export const ParseMiscellaneousMixin = <C extends Constructor<BaseConverter>>(Base: C) => {
    return class ParseAssetsMixin extends Base {
        override parseConvert(value: ParseTagFactoryPropsLimited<'Exit'>): ParseStackTagEntry<ParseExitTag>
        override parseConvert(value: ParseTagFactoryPropsLimited<'Image'>): ParseStackTagEntry<ParseImageTag>
        override parseConvert(value: MixinInheritedParseParameters<C> | ParseTagFactoryPropsLimited<'Exit'> | ParseTagFactoryPropsLimited<'Image'>): ParseStackTagEntry<ParseExitTag> | ParseStackTagEntry<ParseImageTag> | MixinInheritedParseReturn<C> {
            //
            // Convert Exit tag-opens
            //
            if (isTypedParseTagOpen('Exit')(value)) {
                return parseConverterMixin<ParseExitTag, ParseStringTag>({
                    tag: 'Exit',
                    properties: {
                        required: {},
                        optional: {
                            to: ['key'],
                            from: ['key']
                        }
                    },
                    contents: {
                        legal: ['String'],
                        ignore: ['Whitespace', 'Comment']
                    },
                    postProcess: ({ properties, contents, startTagToken, endTagToken }) => {
                        if (!properties.to && !properties.from) {
                            throw new ParseException(`Exit must include either a 'to' or 'from' property`, startTagToken, endTagToken)
                        }
                        return { contents }
                    }
                })(value)
            }
            //
            // Convert Image tag-opens
            //
            else if (isTypedParseTagOpen('Image')(value)) {
                return parseConverterMixin<ParseImageTag, never>({
                    tag: 'Image',
                    properties: {
                        required: { key: ['key'] },
                        optional: { fileURL: ['literal'] }
                    }
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

export default ParseMiscellaneousMixin
