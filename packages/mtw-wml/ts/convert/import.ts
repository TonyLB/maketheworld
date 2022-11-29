import { ParseImportTag, ParseStackTagEntry, ParseTagFactoryPropsLimited, ParseUseTag } from "../parser/baseClasses";
import { BaseConverter, Constructor, converterMixin, isTypedParseTagOpen, MixinInheritedParameters, MixinInheritedReturn } from "./functionMixins";

export const ParseImportMixin = <C extends Constructor<BaseConverter>>(Base: C) => {
    return class ParseImportsMixin extends Base {
        override convert(value: ParseTagFactoryPropsLimited<'Import'>): ParseStackTagEntry<ParseImportTag>
        override convert(value: ParseTagFactoryPropsLimited<'Use'>): ParseStackTagEntry<ParseUseTag>
        override convert(value: MixinInheritedParameters<C> | ParseTagFactoryPropsLimited<'Import'> | ParseTagFactoryPropsLimited<'Use'>): ParseStackTagEntry<ParseImportTag> | ParseStackTagEntry<ParseUseTag> | MixinInheritedReturn<C> {
            //
            // Convert Import tag-opens
            //
            if (isTypedParseTagOpen('Import')(value)) {
                return converterMixin<ParseImportTag, ParseUseTag>({
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
                return converterMixin<ParseUseTag, never>({
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
                const returnValue = (super.convert as any)(value)
                if (!Boolean(returnValue)) {
                    throw new Error('Invalid parameter')
                }
                return returnValue as MixinInheritedReturn<C>
            }
        }
    }
}
export default ParseImportMixin
