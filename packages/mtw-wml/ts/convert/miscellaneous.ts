import { isParseExit, isParseImage, ParseException, ParseExitTag, ParseImageTag, ParseStackTagEntry, ParseStringTag, ParseTagFactoryPropsLimited } from "../parser/baseClasses"
import { isSchemaExit, isSchemaImage, SchemaExitTag, SchemaImageTag, SchemaStringTag, SchemaTag } from "../schema/baseClasses"
import { BaseConverter, Constructor, parseConverterMixin, isTypedParseTagOpen, MixinInheritedParseParameters, MixinInheritedParseReturn, MixinInheritedSchemaParameters, MixinInheritedSchemaReturn, MixinInheritedSchemaContents, SchemaToWMLOptions } from "./functionMixins"
import { tagRender } from "./utils/tagRender"

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
                        optional: {}
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

        override schemaConvert(value: ParseImageTag, siblings: SchemaTag[], contents: SchemaTag[]): SchemaImageTag
        override schemaConvert(value: ParseExitTag, siblings: SchemaTag[], contents: SchemaTag[]): SchemaExitTag
        override schemaConvert(
                value: MixinInheritedSchemaParameters<C> | ParseImageTag | ParseExitTag,
                siblings: SchemaTag[],
                contents: MixinInheritedSchemaContents<C> | SchemaStringTag[] | any[]
            ): MixinInheritedSchemaReturn<C> | SchemaImageTag | SchemaExitTag {
            if (isParseImage(value)) {
                return {
                    tag: 'Image',
                    key: value.key,
                    parse: value
                }            
            }
            else if (isParseExit(value)) {
                return {
                    tag: 'Exit',
                    name: (contents as SchemaStringTag[]).map(({ value }) => (value)).join(''),
                    key: value.key,
                    from: value.from,
                    to: value.to,
                    parse: value,
                    contents: contents as SchemaStringTag[]
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
            if (isSchemaImage(value)) {
                return tagRender({
                    ...options,
                    tag: 'Image',
                    properties: [
                        { key: 'key', type: 'key', value: value.key },
                    ],
                    contents: [],
                })
            }
            else if (isSchemaExit(value)) {
                return tagRender({
                    ...options,
                    tag: 'Exit',
                    properties: [
                        { key: 'key', type: 'key', value: value.key },
                        { key: 'from', type: 'key', value: value.from },
                        { key: 'to', type: 'key', value: value.to },
                    ],
                    contents: value.name ? [value.name] : [],
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

export default ParseMiscellaneousMixin
