import { dbRegister } from "../serialize/dbRegister"
import { asyncSuppressExceptions } from '@tonylb/mtw-utilities/dist/errors'
import AssetWorkspace, { parseAssetWorkspaceAddress } from "@tonylb/mtw-asset-workspace/dist/"
import { sfnClient } from "../clients"
import { assetWorkspaceFromAssetId } from "../utilities/assets"
import { StartExecutionCommand } from "@aws-sdk/client-sfn"

export const healAsset = async (fileName: string) => {
    const address = parseAssetWorkspaceAddress(fileName.replace(/\.wml$/, ''))
    return asyncSuppressExceptions(async () => {
        const assetWorkspace = new AssetWorkspace(address)
        await assetWorkspace.loadJSON()
        if (assetWorkspace.status.json !== 'Clean') {
            return
        }
        if (assetWorkspace.address.fileName === 'primitives' && assetWorkspace.address.zone === 'Canon') {
            assetWorkspace._isGlobal = true
        }
        assetWorkspace.setWorkspaceLookup(assetWorkspaceFromAssetId)
        await assetWorkspace.loadWML()
        await Promise.all([
            ...((assetWorkspace.status.json !== 'Clean') ? [assetWorkspace.pushJSON()] : []),
            dbRegister(assetWorkspace)
        ])

        await sfnClient.send(new StartExecutionCommand({
            stateMachineArn: process.env.CACHE_ASSETS_SFN,
            input: JSON.stringify({
                addresses: [assetWorkspace.address],
                updateOnly: !Boolean(assetWorkspace._isGlobal)
            })
        }))
        return {
            scopeMap: assetWorkspace.namespaceIdToDB
        }
    }, async () => {})
}
