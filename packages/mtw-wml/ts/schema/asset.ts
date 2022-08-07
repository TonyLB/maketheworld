import { SchemaAssetLegalContents, SchemaAssetTag, SchemaStoryTag } from "./baseClasses";
import { ParseAssetTag, ParseStoryTag } from "../parser/baseClasses";

export const schemaFromAsset = (item: ParseAssetTag, contents: SchemaAssetLegalContents[]): SchemaAssetTag => ({
    tag: 'Asset',
    Story: undefined,
    key: item.key,
    contents,
    fileName: item.fileName,
    zone: item.zone,
    subFolder: item.subFolder,
    player: item.player,
    parse: item
})

export const schemaFromStory = (item: ParseStoryTag, contents: SchemaAssetLegalContents[]): SchemaStoryTag => ({
    tag: 'Story',
    Story: true,
    key: item.key,
    contents,
    fileName: item.fileName,
    zone: item.zone,
    subFolder: item.subFolder,
    player: item.player,
    instance: item.instance,
    parse: item
})

export default schemaFromAsset
