import AssetWorkspace, { AssetWorkspaceAddress } from "@tonylb/mtw-asset-workspace/ts"
import { Schema, schemaToWML } from "@tonylb/mtw-wml/ts/schema";
import { treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { dbRegister } from "../serialize/dbRegister";
import { isSchemaAsset } from "@tonylb/mtw-base/ts/schema";

export type CopyWMLArguments = {
    uuid: string;  // Asset UUID without ASSET# prefix
    from: AssetWorkspaceAddress;
    to: AssetWorkspaceAddress;
}

//
// copyWML takes the WML and JSON files from a certain address, renames the asset, and writes
// the updated files to a second address
//
export const copyWML = async (args: CopyWMLArguments) => {
    //
    // Fetch all information you will need in order to change the internal structure of the file
    //
    const fromWorkspace = new AssetWorkspace(args.from)
    await fromWorkspace.loadWML()
    await fromWorkspace.loadJSON()

    //
    // Load and parse the WML into schema format
    //
    const { wml } = fromWorkspace
    if (!wml) {
        throw new Error('Empty source in copyWML')
    }
    const schema = new Schema()
    schema.loadWML(wml)

    //
    // Update the uuid of the outermost element of the schema
    //
    const schemaRaw = schema.schema[0]
    if (!treeNodeTypeguard(isSchemaAsset)(schemaRaw)) {
        throw new Error('Invalid WML source in copyWML')
    }
    schema._schema = [{ ...schema.schema[0], data: { ...schemaRaw.data, uuid: `ASSET#${args.uuid}` } }]

    //
    // Reload the new schema and new address over the existing data, and push to S3
    //
    await fromWorkspace.setWML(schemaToWML(schema.schema))
    fromWorkspace.changeAddress(args.to)
    await Promise.all([
        fromWorkspace.pushJSON(),
        fromWorkspace.pushWML(),
        dbRegister(fromWorkspace)
    ])

}

export default copyWML
