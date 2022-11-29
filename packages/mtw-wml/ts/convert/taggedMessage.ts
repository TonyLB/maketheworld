import { ParseLineBreakTag, ParseLinkLegalContents, ParseLinkTag, ParseSpacerTag, ParseStackTagEntry, ParseTagFactoryPropsLimited } from "../parser/baseClasses";
import { BaseConverter, Constructor, parseConverterMixin, isTypedParseTagOpen, MixinInheritedParseParameters, MixinInheritedParseReturn } from "./functionMixins";

export const ParseTaggedMessageMixin = <C extends Constructor<BaseConverter>>(Base: C) => {
    return class ParseTaggedMessageMixin extends Base {
        override parseConvert(value: ParseTagFactoryPropsLimited<'br'>): ParseStackTagEntry<ParseLineBreakTag>
        override parseConvert(value: ParseTagFactoryPropsLimited<'Space'>): ParseStackTagEntry<ParseSpacerTag>
        override parseConvert(value: ParseTagFactoryPropsLimited<'Link'>): ParseStackTagEntry<ParseLinkTag>
        override parseConvert(value: MixinInheritedParseParameters<C>
            | ParseTagFactoryPropsLimited<'br'>
            | ParseTagFactoryPropsLimited<'Space'>
            | ParseTagFactoryPropsLimited<'Link'>
            ): MixinInheritedParseReturn<C>
            | ParseStackTagEntry<ParseLineBreakTag>
            | ParseStackTagEntry<ParseSpacerTag>
            | ParseStackTagEntry<ParseLinkTag>
            {
            //
            // Convert LineBreak tag-opens
            //
            if (isTypedParseTagOpen('br')(value)) {
                return parseConverterMixin<ParseLineBreakTag, never>({
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
                return parseConverterMixin<ParseSpacerTag, never>({
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
                return parseConverterMixin<ParseLinkTag, ParseLinkLegalContents>({
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
                const returnValue = (super.parseConvert as any)(value)
                if (!Boolean(returnValue)) {
                    throw new Error('Invalid parameter')
                }
                return returnValue as MixinInheritedParseReturn<C>
            }
        }
    }
}

export default ParseTaggedMessageMixin
