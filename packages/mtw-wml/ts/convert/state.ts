import { ParseActionTag, ParseComputedTag, ParseStackTagEntry, ParseTagFactoryPropsLimited, ParseVariableTag } from "../parser/baseClasses";
import { BaseConverter, Constructor, converterMixin, isTypedParseTagOpen, MixinInheritedParameters, MixinInheritedReturn } from "./functionMixins";
import { extractDependenciesFromJS } from "./utils";

export const ParseStateMixin = <C extends Constructor<BaseConverter>>(Base: C) => {
    return class ParseStateMixin extends Base {
        override parseConvert(value: ParseTagFactoryPropsLimited<'Action'>): ParseStackTagEntry<ParseActionTag>
        override parseConvert(value: ParseTagFactoryPropsLimited<'Variable'>): ParseStackTagEntry<ParseVariableTag>
        override parseConvert(value: ParseTagFactoryPropsLimited<'Computed'>): ParseStackTagEntry<ParseComputedTag>
        override parseConvert(value: MixinInheritedParameters<C>
            | ParseTagFactoryPropsLimited<'Action'>
            | ParseTagFactoryPropsLimited<'Variable'>
            | ParseTagFactoryPropsLimited<'Computed'>
            ): MixinInheritedReturn<C>
            | ParseStackTagEntry<ParseActionTag>
            | ParseStackTagEntry<ParseVariableTag>
            | ParseStackTagEntry<ParseComputedTag>
            {
            //
            // Convert Action tag-opens
            //
            if (isTypedParseTagOpen('Action')(value)) {
                return converterMixin<ParseActionTag, never>({
                    tag: 'Action',
                    properties: {
                        required: {
                            key: ['key'],
                            src: ['expression']
                        },
                        optional: {}
                    }
                })(value)
            }
            //
            // Convert Variable tag-opens
            //
            else if (isTypedParseTagOpen('Variable')(value)) {
                return converterMixin<ParseVariableTag, never>({
                    tag: 'Variable',
                    properties: {
                        required: {
                            key: ['key'],
                        },
                        optional: {
                            default: ['expression']
                        }
                    }
                })(value)
            }
            //
            // Convert Computed tag-opens
            //
            else if (isTypedParseTagOpen('Computed')(value)) {
                return converterMixin<ParseComputedTag, never>({
                    tag: 'Computed',
                    properties: {
                        required: {
                            key: ['key'],
                            src: ['expression']
                        },
                        optional: {}
                    },
                    postProcess: ({ properties }) => ({
                        dependencies: extractDependenciesFromJS(properties.src)
                    })
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

export default ParseStateMixin
