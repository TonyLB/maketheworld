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
        await assetWorkspace.loadWML()
        await Promise.all([
            assetWorkspace.pushJSON(),
            dbRegister(assetWorkspace)
        ])
        return {
            scopeMap: assetWorkspace.namespaceIdToDB
        }
    }, async () => {})
}
