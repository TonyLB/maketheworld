import AssetWorkspace, { AssetWorkspaceAddress } from "@tonylb/mtw-asset-workspace"
import { isSchemaAsset, isSchemaCharacter } from "@tonylb/mtw-wml/ts/schema/baseClasses"
import { Schema, schemaToWML } from "@tonylb/mtw-wml/ts/schema";
import { treeNodeTypeguard } from "@tonylb/mtw-wml/ts/tree/baseClasses"
import { dbRegister } from "../serialize/dbRegister";

export type BackupWMLArguments = {
    from: AssetWorkspaceAddress;
}

//
// backupWML takes the WML and associated files from a certain address, and saves them to another
// location in compressed tar.gz format.
//
export const backupWML = async (args: BackupWMLArguments) => {
    //
    // Fetch all information you will need in order to change the internal structure of the file
    //
    const fromWorkspace = new AssetWorkspace(args.from)

    await fromWorkspace.loadJSON()

    console.log(`File associations: ${JSON.stringify(fromWorkspace.properties, null, 4)}`)

    //
    // TODO: Open streams for WML and file associations
    //

    //
    // TODO: Pipe streams into tar-stream
    //

    //
    // TODO: Pipe resulting tar-stream through zlib
    //

    //
    // TODO: Pipe resulting tar.gz stream to S3 Upload
    //
}

export default backupWML
