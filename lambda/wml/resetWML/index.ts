import AssetWorkspace, { AssetWorkspaceAddress } from "@tonylb/mtw-asset-workspace";
import { dbRegister } from "../serialize/dbRegister";

export type ResetWMLArguments = {
    key: string;
    address: AssetWorkspaceAddress;
}

//
// Reset clears all contents of a given asset
//
export const resetWML = async (args: ResetWMLArguments) => {
    const workspace = new AssetWorkspace(args.address)
    await workspace.setWML(`<Asset key=(${args.key}) />`)

    //
    // Reload the new schema and new address over the existing data, and push to S3
    //
    await Promise.all([
        workspace.pushJSON(),
        workspace.pushWML(),
        dbRegister(workspace)
    ])

}