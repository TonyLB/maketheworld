import { isParseImport, isParseUse, ParseImportTag, ParseStackTagEntry, ParseTagFactoryPropsLimited, ParseUseTag } from "../parser/baseClasses";
import { SchemaImportTag, SchemaTag, SchemaUseTag } from "../schema/baseClasses";
import { BaseConverter, Constructor, parseConverterMixin, isTypedParseTagOpen, MixinInheritedParseParameters, MixinInheritedParseReturn, MixinInheritedSchemaParameters, MixinInheritedSchemaContents, MixinInheritedSchemaReturn } from "./functionMixins";

export const ParseImportMixin = <C extends Constructor<BaseConverter>>(Base: C) => {
    return class ParseImportsMixin extends Base {
        override parseConvert(value: ParseTagFactoryPropsLimited<'Import'>): ParseStackTagEntry<ParseImportTag>
        override parseConvert(value: ParseTagFactoryPropsLimited<'Use'>): ParseStackTagEntry<ParseUseTag>
        override parseConvert(value: MixinInheritedParseParameters<C> | ParseTagFactoryPropsLimited<'Import'> | ParseTagFactoryPropsLimited<'Use'>): ParseStackTagEntry<ParseImportTag> | ParseStackTagEntry<ParseUseTag> | MixinInheritedParseReturn<C> {
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
                return returnValue as MixinInheritedParseReturn<C>
            }
        }

        override schemaConvert(value: ParseImportTag, siblings: SchemaTag[], contents: SchemaTag[]): SchemaImportTag
        override schemaConvert(value: ParseUseTag, siblings: SchemaTag[], contents: SchemaTag[]): SchemaUseTag
        override schemaConvert(
                value: MixinInheritedSchemaParameters<C> | ParseImportTag | ParseUseTag,
                siblings: SchemaTag[],
                contents: MixinInheritedSchemaContents<C> | SchemaTag[]
            ): MixinInheritedSchemaReturn<C> | SchemaImportTag | SchemaUseTag {
            if (isParseImport(value)) {
                return {
                    tag: 'Import',
                    from: value.from,
                    mapping: (contents as SchemaUseTag[]).reduce((previous, { key, as, type }) => ({
                        ...previous,
                        [as || key]: {
                            key,
                            type
                        }
                    }), {}),
                    parse: value
                }            
            }
            else if (isParseUse(value)) {
                return {
                    tag: 'Use',
                    key: value.key,
                    as: value.as,
                    type: value.type,
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

export default ParseImportMixin
