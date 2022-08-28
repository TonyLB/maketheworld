import { dbRegister } from "../serialize/dbRegister"
import { asyncSuppressExceptions } from '@tonylb/mtw-utilities/dist/errors'
import AssetWorkspace, { parseAssetWorkspaceAddress } from "@tonylb/mtw-asset-workspace/dist/"

export const healAsset = async (fileName: string) => {
    const address = parseAssetWorkspaceAddress(fileName.replace(/\.wml$/, ''))
    return asyncSuppressExceptions(async () => {
        const assetWorkspace = new AssetWorkspace(address)
        await assetWorkspace.loadJSON()
        if (assetWorkspace.status.json !== 'Clean') {
            return
        }
        //
        // TODO (ISS1380):  LoadWML and check whether the JSON file needs to be updated
        //
        await dbRegister(assetWorkspace)
        return {
            scopeMap: assetWorkspace.namespaceIdToDB
        }
    }, async () => {})
}
