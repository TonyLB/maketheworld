import { isParseLineBreak, isParseLink, isParseSpacer, isParseString, isParseWhitespace, ParseLineBreakTag, ParseLinkLegalContents, ParseLinkTag, ParseSpacerTag, ParseStackTagEntry, ParseStringTag, ParseTagFactoryPropsLimited, ParseWhitespaceTag } from "../parser/baseClasses";
import { isSchemaLineBreak, isSchemaLink, isSchemaSpacer, isSchemaString, isSchemaWhitespace, SchemaLineBreakTag, SchemaLinkTag, SchemaSpacerTag, SchemaStringTag, SchemaTag, SchemaWhitespaceTag } from "../schema/baseClasses";
import { BaseConverter, Constructor, parseConverterMixin, isTypedParseTagOpen, MixinInheritedParseParameters, MixinInheritedParseReturn, MixinInheritedSchemaParameters, MixinInheritedSchemaContents, MixinInheritedSchemaReturn, SchemaToWMLOptions } from "./functionMixins";
import { tagRender } from "./utils/tagRender"

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

        override schemaConvert(value: ParseStringTag, siblings: SchemaTag[], contents: SchemaTag[]): SchemaStringTag
        override schemaConvert(value: ParseWhitespaceTag, siblings: SchemaTag[], contents: SchemaTag[]): SchemaWhitespaceTag
        override schemaConvert(value: ParseSpacerTag, siblings: SchemaTag[], contents: SchemaTag[]): SchemaSpacerTag
        override schemaConvert(value: ParseLineBreakTag, siblings: SchemaTag[], contents: SchemaTag[]): SchemaLineBreakTag
        override schemaConvert(value: ParseLinkTag, siblings: SchemaTag[], contents: SchemaTag[]): SchemaLinkTag
        override schemaConvert(
                value: MixinInheritedSchemaParameters<C> | ParseStringTag | ParseWhitespaceTag | ParseSpacerTag | ParseLineBreakTag | ParseLinkTag,
                siblings: SchemaTag[],
                contents: MixinInheritedSchemaContents<C> | SchemaTag[] | any[]
            ): MixinInheritedSchemaReturn<C> | SchemaStringTag | SchemaWhitespaceTag | SchemaSpacerTag | SchemaLineBreakTag | SchemaLinkTag {
            if (isParseWhitespace(value)) {
                return { tag: 'Whitespace' }
            }
            if (isParseSpacer(value)) {
                return { tag: 'Space' }
            }
            if (isParseLineBreak(value)) {
                return { tag: 'br' }
            }
            if (isParseString(value)) {
                return {
                    tag: 'String',
                    value: value.value
                }
            }
            if (isParseLink(value)) {
                return {
                    tag: 'Link',
                    to: value.to,
                    text: (contents as SchemaTag[]).filter((item): item is SchemaStringTag => (item.tag === 'String')).map(({ value }) => (value)).join('')
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
            if (isSchemaString(value)) {
                return value.value
            }
            else if (isSchemaLink(value)) {
                return tagRender({
                    ...options,
                    schemaToWML,
                    tag: 'Link',
                    properties: [{ key: 'to', type: 'key', value: value.to }],
                    contents: [value.text],
                })
            }
            else if (isSchemaLineBreak(value)) {
                return `<br />`
            }
            else if (isSchemaWhitespace(value)) {
                return ' '
            }
            else if (isSchemaSpacer(value)) {
                return '<Space />'
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

export default ParseTaggedMessageMixin
