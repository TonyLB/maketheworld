import { SchemaAssetLegalContents, SchemaAssetTag } from "./baseClasses";
import { ParseAssetTag } from "../parser/baseClasses";

export const schemaFromAsset = (item: ParseAssetTag, contents: SchemaAssetLegalContents[]): SchemaAssetTag => ({
    tag: 'Asset',
    key: item.key,
    contents,
    fileName: item.fileName,
    zone: item.zone,
    subFolder: item.subFolder,
    player: item.player
})

export default schemaFromAsset
