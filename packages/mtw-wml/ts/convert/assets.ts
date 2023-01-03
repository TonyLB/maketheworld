import { isParseAsset, isParseStory, ParseAssetLegalContents, ParseAssetTag, ParseStackTagEntry, ParseStoryTag, ParseTagFactoryPropsLimited } from "../parser/baseClasses";
import { isSchemaAsset, SchemaAssetLegalContents, SchemaAssetTag, SchemaStoryTag, SchemaTag } from "../schema/baseClasses";
import { BaseConverter, Constructor, parseConverterMixin, isTypedParseTagOpen, MixinInheritedParseParameters, MixinInheritedParseReturn, MixinInheritedSchemaParameters, MixinInheritedSchemaContents, MixinInheritedSchemaReturn, SchemaToWMLOptions } from "./functionMixins";
import { tagRender } from "./utils/tagRender";

export const ParseAssetsMixin = <C extends Constructor<BaseConverter>>(Base: C) => {
    return class ParseAssetsMixin extends Base {
        override parseConvert(value: ParseTagFactoryPropsLimited<'Asset'>): ParseStackTagEntry<ParseAssetTag>
        override parseConvert(value: ParseTagFactoryPropsLimited<'Story'>): ParseStackTagEntry<ParseStoryTag>
        override parseConvert(value: MixinInheritedParseParameters<C> | ParseTagFactoryPropsLimited<'Asset'> | ParseTagFactoryPropsLimited<'Story'>): ParseStackTagEntry<ParseAssetTag> | ParseStackTagEntry<ParseStoryTag> | MixinInheritedParseReturn<C> {
            //
            // Convert Asset tag-opens
            //
            if (isTypedParseTagOpen('Asset')(value)) {
                return parseConverterMixin<ParseAssetTag, ParseAssetLegalContents>({
                    tag: 'Asset',
                    properties: {
                        required: {
                            key: ['key']
                        },
                        optional: {
                            fileName: ['literal'],
                            zone: ['literal'],
                            subFolder: ['literal'],
                            player: ['literal']
                        }
                    },
                    contents: {
                        legal: ['Action', 'Computed', 'If', 'Else', 'ElseIf', 'Exit', 'Feature', 'Bookmark', 'Import', 'Room', 'Variable', 'Map', 'Message', 'Moment'],
                        ignore: ['Whitespace', 'Comment']
                    }
                })(value)
            }
            //
            // Convert Story tag-opens
            //
            else if (isTypedParseTagOpen('Story')(value)) {
                return parseConverterMixin<ParseStoryTag, ParseAssetLegalContents>({
                    tag: 'Story',
                    properties: {
                        required: {
                            key: ['key']
                        },
                        optional: {
                            fileName: ['literal'],
                            zone: ['literal'],
                            subFolder: ['literal'],
                            player: ['literal'],
                            instance: ['boolean']
                        }
                    },
                    contents: {
                        legal: ['Action', 'Computed', 'If', 'Else', 'ElseIf', 'Exit', 'Feature', 'Bookmark', 'Import', 'Room', 'Variable', 'Map', 'Message', 'Moment'],
                        ignore: ['Whitespace', 'Comment']
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

        override schemaConvert(item: ParseAssetTag, siblings: SchemaTag[], contents: SchemaTag[]): SchemaAssetTag
        override schemaConvert(item: ParseStoryTag, siblings: SchemaTag[], contents: SchemaTag[]): SchemaStoryTag
        override schemaConvert(
                item: MixinInheritedSchemaParameters<C> | ParseAssetTag | ParseStoryTag,
                siblings: SchemaTag[],
                contents: MixinInheritedSchemaContents<C> | SchemaTag[]
            ): MixinInheritedSchemaReturn<C> | SchemaAssetTag | SchemaStoryTag {
            if (isParseAsset(item)) {
                return {
                    tag: 'Asset',
                    Story: undefined,
                    key: item.key,
                    contents: contents as SchemaAssetLegalContents[],
                    fileName: item.fileName,
                    zone: item.zone,
                    subFolder: item.subFolder,
                    player: item.player,
                    parse: item
                }            
            }
            else if (isParseStory(item)) {
                return {
                    tag: 'Story',
                    Story: true,
                    key: item.key,
                    contents: contents as SchemaAssetLegalContents[],
                    fileName: item.fileName,
                    zone: item.zone,
                    subFolder: item.subFolder,
                    player: item.player,
                    instance: item.instance,
                    parse: item
                }            
            }
            else {
                const returnValue = (super.schemaConvert as any)(item, siblings, contents)
                if (!Boolean(returnValue)) {
                    throw new Error('Invalid parameter')
                }
                return returnValue as MixinInheritedSchemaReturn<C>
            }
        }

        override schemaToWML(value: SchemaTag, options: SchemaToWMLOptions): string {
            const schemaToWML = (value: SchemaTag, passedOptions: SchemaToWMLOptions) => (this.schemaToWML(value, { ...passedOptions, indent: options.indent + 1, context: [ ...options.context, value ] }))
            if (isSchemaAsset(value)) {
                return tagRender({
                    ...options,
                    schemaToWML,
                    tag: 'Asset',
                    properties: [
                        { key: 'key', type: 'key', value: value.key },
                        { key: 'Story', type: 'boolean', value: value.Story }
                    ],
                    contents: value.contents,
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

export default ParseAssetsMixin