import { ParseLineBreakTag, ParseLinkLegalContents, ParseLinkTag, ParseSpacerTag, ParseStackTagEntry, ParseTagFactoryPropsLimited } from "../parser/baseClasses";
import { BaseConverter, Constructor, converterMixin, isTypedParseTagOpen, MixinInheritedParameters, MixinInheritedReturn } from "./functionMixins";

export const ParseTaggedMessageMixin = <C extends Constructor<BaseConverter>>(Base: C) => {
    return class ParseTaggedMessageMixin extends Base {
        override convert(value: ParseTagFactoryPropsLimited<'br'>): ParseStackTagEntry<ParseLineBreakTag>
        override convert(value: ParseTagFactoryPropsLimited<'Space'>): ParseStackTagEntry<ParseSpacerTag>
        override convert(value: ParseTagFactoryPropsLimited<'Link'>): ParseStackTagEntry<ParseLinkTag>
        override convert(value: MixinInheritedParameters<C>
            | ParseTagFactoryPropsLimited<'br'>
            | ParseTagFactoryPropsLimited<'Space'>
            | ParseTagFactoryPropsLimited<'Link'>
            ): MixinInheritedReturn<C>
            | ParseStackTagEntry<ParseLineBreakTag>
            | ParseStackTagEntry<ParseSpacerTag>
            | ParseStackTagEntry<ParseLinkTag>
            {
            //
            // Convert LineBreak tag-opens
            //
            if (isTypedParseTagOpen('br')(value)) {
                return converterMixin<ParseLineBreakTag, never>({
                    tag: 'br',
                    properties: {
                        required: {},
                        optional: {}
                    }
                })(value)
            }
            //
            // Convert Spacer tag-opens
            //
            else if (isTypedParseTagOpen('Space')(value)) {
                return converterMixin<ParseSpacerTag, never>({
                    tag: 'Space',
                    properties: {
                        required: {},
                        optional: {}
                    }
                })(value)
            }
            //
            // Convert Link tag-opens
            //
            else if (isTypedParseTagOpen('Link')(value)) {
                return converterMixin<ParseLinkTag, ParseLinkLegalContents>({
                    tag: 'Link',
                    properties: {
                        required: {
                            to: ['key']
                        },
                        optional: {}
                    },
                    contents: {
                        legal: ['Whitespace', 'String'],
                        ignore: ['Comment']
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

export default ParseTaggedMessageMixin
