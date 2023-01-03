import { isParseImport, isParseUse, ParseImportTag, ParseStackTagEntry, ParseTagFactoryPropsLimited, ParseUseTag } from "../parser/baseClasses";
import { isSchemaImport, isSchemaUse, SchemaImportTag, SchemaTag, SchemaUseTag } from "../schema/baseClasses";
import { BaseConverter, Constructor, parseConverterMixin, isTypedParseTagOpen, MixinInheritedParseParameters, MixinInheritedParseReturn, MixinInheritedSchemaParameters, MixinInheritedSchemaContents, MixinInheritedSchemaReturn, SchemaToWMLOptions } from "./functionMixins";
import { tagRender } from "./utils/tagRender";

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

        override schemaToWML(value: SchemaTag, options: SchemaToWMLOptions): string {
            const schemaToWML = (value: SchemaTag, passedOptions: SchemaToWMLOptions) => (this.schemaToWML(value, { ...passedOptions, indent: options.indent + 1, context: [ ...options.context, value ] }))
            if (isSchemaImport(value)) {
                return tagRender({
                    ...options,
                    schemaToWML,
                    tag: 'Import',
                    properties: [
                        { key: 'from', type: 'key', value: value.from },
                    ],
                    contents: Object.entries(value.mapping).map(([as, { key, type }]): SchemaUseTag => ({
                        tag: 'Use',
                        as: (as !== key) ? as : undefined,
                        key,
                        type
                    })),
                })
            }
            else if (isSchemaUse(value)) {
                return tagRender({
                    ...options,
                    schemaToWML,
                    tag: 'Use',
                    properties: [
                        { key: 'key', type: 'key', value: value.key },
                        { key: 'as', type: 'key', value: value.as },
                        { key: 'type', type: 'literal', value: value.type }
                    ],
                    contents: [],
                })
            }
            else {
                const returnValue = (super.schemaToWML as any)(value, options)
                if (!(typeof returnValue === 'string')) {
                    throw new Error('Invalid parameter')
                }
                return returnValue
            }
        }

    }
}

export default ParseImportMixin
