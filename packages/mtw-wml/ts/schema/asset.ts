import { LegalAssetContents, SchemaAssetTag } from "../baseClasses";
import { ParseAssetTag } from "../parser/baseClasses";

export const schemaFromAsset = (item: ParseAssetTag, contents: LegalAssetContents[]): SchemaAssetTag => ({
    tag: 'Asset',
    key: item.key,
    contents,
    fileName: item.fileName,
    zone: item.zone,
    subFolder: item.subFolder,
    player: item.player
})

export default schemaFromAsset
