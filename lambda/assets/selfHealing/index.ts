import { dbRegister } from "../serialize/dbRegister"
import { asyncSuppressExceptions } from '@tonylb/mtw-utilities/dist/errors'
import AssetWorkspace, { parseAssetWorkspaceAddress } from "@tonylb/mtw-asset-workspace/dist/"
import { ebClient } from "../clients"
import { PutEventsCommand } from "@aws-sdk/client-eventbridge"

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
            ...((assetWorkspace.status.json !== 'Clean') ? [assetWorkspace.pushJSON()] : []),
            dbRegister(assetWorkspace)
        ])
        await ebClient.send(new PutEventsCommand({
            Entries: [{
                EventBusName: process.env.EVENT_BUS_NAME,
                Source: 'mtw.coordination',
                DetailType: 'Cache Asset',
                Detail: JSON.stringify({
                    ...assetWorkspace.address,
                    updateOnly: true
                })
            }]
        }))
        return {
            scopeMap: assetWorkspace.namespaceIdToDB
        }
    }, async () => {})
}
