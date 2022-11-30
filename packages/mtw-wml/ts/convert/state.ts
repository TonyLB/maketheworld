import { isParseAction, isParseComputed, isParseVariable, ParseActionTag, ParseComputedTag, ParseStackTagEntry, ParseTagFactoryPropsLimited, ParseVariableTag } from "../parser/baseClasses";
import { SchemaActionTag, SchemaComputedTag, SchemaTag, SchemaVariableTag } from "../schema/baseClasses";
import { BaseConverter, Constructor, parseConverterMixin, isTypedParseTagOpen, MixinInheritedParseParameters, MixinInheritedParseReturn, MixinInheritedSchemaParameters, MixinInheritedSchemaContents, MixinInheritedSchemaReturn } from "./functionMixins";
import { extractDependenciesFromJS } from "./utils";

export const ParseStateMixin = <C extends Constructor<BaseConverter>>(Base: C) => {
    return class ParseStateMixin extends Base {
        override parseConvert(value: ParseTagFactoryPropsLimited<'Action'>): ParseStackTagEntry<ParseActionTag>
        override parseConvert(value: ParseTagFactoryPropsLimited<'Variable'>): ParseStackTagEntry<ParseVariableTag>
        override parseConvert(value: ParseTagFactoryPropsLimited<'Computed'>): ParseStackTagEntry<ParseComputedTag>
        override parseConvert(value: MixinInheritedParseParameters<C>
            | ParseTagFactoryPropsLimited<'Action'>
            | ParseTagFactoryPropsLimited<'Variable'>
            | ParseTagFactoryPropsLimited<'Computed'>
            ): MixinInheritedParseReturn<C>
            | ParseStackTagEntry<ParseActionTag>
            | ParseStackTagEntry<ParseVariableTag>
            | ParseStackTagEntry<ParseComputedTag>
            {
            //
            // Convert Action tag-opens
            //
            if (isTypedParseTagOpen('Action')(value)) {
                return parseConverterMixin<ParseActionTag, never>({
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
                return parseConverterMixin<ParseVariableTag, never>({
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
                return parseConverterMixin<ParseComputedTag, never>({
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
                return returnValue as MixinInheritedParseReturn<C>
            }
        }

        override schemaConvert(value: ParseActionTag, siblings: SchemaTag[], contents: SchemaTag[]): SchemaActionTag
        override schemaConvert(value: ParseVariableTag, siblings: SchemaTag[], contents: SchemaTag[]): SchemaVariableTag
        override schemaConvert(value: ParseComputedTag, siblings: SchemaTag[], contents: SchemaTag[]): SchemaComputedTag
        override schemaConvert(
                value: MixinInheritedSchemaParameters<C> | ParseActionTag | ParseVariableTag | ParseComputedTag,
                siblings: SchemaTag[],
                contents: MixinInheritedSchemaContents<C> | SchemaTag[]
            ): MixinInheritedSchemaReturn<C> | SchemaActionTag | SchemaVariableTag | SchemaComputedTag {
            if (isParseAction(value)) {
                return {
                    tag: 'Action',
                    key: value.key,
                    src: value.src,
                    parse: value            
                }
            }
            else if (isParseVariable(value)) {
                return {
                    tag: 'Variable',
                    key: value.key,
                    default: value.default,
                    parse: value
                }
            }
            else if (isParseComputed(value)) {
                return {
                    tag: 'Computed',
                    key: value.key,
                    src: value.src,
                    dependencies: value.dependencies,
                    parse: value
                }
            }
            else {
                const returnValue = (super.schemaConvert as any)(value, siblings, contents)
                if (!Boolean(returnValue)) {
                    throw new Error('Invalid parameter')
                }
                return returnValue as MixinInheritedSchemaReturn<C>
            }
        }

    }
}

export default ParseStateMixin
