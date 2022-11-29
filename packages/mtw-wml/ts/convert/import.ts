import { ParseImportTag, ParseStackTagEntry, ParseTagFactoryPropsLimited, ParseUseTag } from "../parser/baseClasses";
import { BaseConverter, Constructor, parseConverterMixin, isTypedParseTagOpen, MixinInheritedParameters, MixinInheritedReturn } from "./functionMixins";

export const ParseImportMixin = <C extends Constructor<BaseConverter>>(Base: C) => {
    return class ParseImportsMixin extends Base {
        override parseConvert(value: ParseTagFactoryPropsLimited<'Import'>): ParseStackTagEntry<ParseImportTag>
        override parseConvert(value: ParseTagFactoryPropsLimited<'Use'>): ParseStackTagEntry<ParseUseTag>
        override parseConvert(value: MixinInheritedParameters<C> | ParseTagFactoryPropsLimited<'Import'> | ParseTagFactoryPropsLimited<'Use'>): ParseStackTagEntry<ParseImportTag> | ParseStackTagEntry<ParseUseTag> | MixinInheritedReturn<C> {
            //
            // Convert Import tag-opens
            //
            if (isTypedParseTagOpen('Import')(value)) {
                return parseConverterMixin<ParseImportTag, ParseUseTag>({
                    tag: 'Import',
                    properties: {
                        required: { from: ['key'] },
                        optional: {}
                    },
                    contents: {
                        legal: ['Use'],
                        ignore: ['Whitespace', 'Comment']
                    }
                })(value)
            }
            //
            // Convert Use tag-opens
            //
            else if (isTypedParseTagOpen('Use')(value)) {
                return parseConverterMixin<ParseUseTag, never>({
                    tag: 'Use',
                    properties: {
                        required: { key: ['key'] },
                        optional: {
                            as: ['key'],
                            type: ['literal']
                        }
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
export default ParseImportMixin
