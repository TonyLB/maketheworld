import { ParseException, ParseExitTag, ParseImageTag, ParseStackTagEntry, ParseStringTag, ParseTagFactoryPropsLimited } from "../parser/baseClasses";
import { BaseConverter, Constructor, converterMixin, isTypedParseTagOpen, MixinInheritedParameters, MixinInheritedReturn } from "./functionMixins";

export const ParseMiscellaneousMixin = <C extends Constructor<BaseConverter>>(Base: C) => {
    return class ParseAssetsMixin extends Base {
        override convert(value: ParseTagFactoryPropsLimited<'Exit'>): ParseStackTagEntry<ParseExitTag>
        override convert(value: ParseTagFactoryPropsLimited<'Image'>): ParseStackTagEntry<ParseImageTag>
        override convert(value: MixinInheritedParameters<C> | ParseTagFactoryPropsLimited<'Exit'> | ParseTagFactoryPropsLimited<'Image'>): ParseStackTagEntry<ParseExitTag> | ParseStackTagEntry<ParseImageTag> | MixinInheritedReturn<C> {
            //
            // Convert Exit tag-opens
            //
            if (isTypedParseTagOpen('Exit')(value)) {
                return converterMixin<ParseExitTag, ParseStringTag>({
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
                return converterMixin<ParseImageTag, never>({
                    tag: 'Image',
                    properties: {
                        required: { key: ['key'] },
                        optional: { fileURL: ['literal'] }
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

export default ParseMiscellaneousMixin
