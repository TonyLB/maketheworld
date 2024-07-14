import AssetWorkspace, { AssetWorkspaceAddress } from "@tonylb/mtw-asset-workspace"
import { isSchemaAsset, isSchemaCharacter } from "@tonylb/mtw-wml/ts/schema/baseClasses"
import { Schema, schemaToWML } from "@tonylb/mtw-wml/ts/schema";
import { treeNodeTypeguard } from "@tonylb/mtw-wml/ts/tree/baseClasses"

type CopyWMLArguments = {
    key: string;
    from: AssetWorkspaceAddress;
    to: AssetWorkspaceAddress;
}

export const copyWML = async (args: CopyWMLArguments) => {
    const fromWorkspace = new AssetWorkspace(args.from)
    await fromWorkspace.loadWML()
    //
    // TODO: Load the JSON to find meta-data like image files
    //
    const { wml } = fromWorkspace
    if (!wml) {
        throw new Error('Empty source in copyWML')
    }
    const schema = new Schema()
    schema.loadWML(wml)
    const schemaRaw = schema.schema[0]
    if (!(treeNodeTypeguard(isSchemaAsset)(schemaRaw) || treeNodeTypeguard(isSchemaCharacter)(schemaRaw))) {
        throw new Error('Invalid WML source in copyWML')
    }
    const toWorkspace = new AssetWorkspace(args.to)
    schema._schema = [{ ...schema.schema[0], data: { ...schemaRaw.data, key: args.key } }]
    await toWorkspace.setWML(schemaToWML(schema.schema))
    await toWorkspace.pushWML()
    //
    // TODO: PushWML and JSON to the new address
    //
}

export default copyWML
