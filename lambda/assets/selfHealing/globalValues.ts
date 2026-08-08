import { assetDB } from "@tonylb/mtw-utilities/ts/dynamoDB"
import { asyncSuppressExceptions } from "@tonylb/mtw-utilities/ts/errors"
import { eventBridgeClient } from '@tonylb/mtw-utilities/ts/eventBridge'
import internalCache from "../internalCache"

export const healGlobalValues = async ({ shouldHealGlobalAssets = true }) => {
    return await asyncSuppressExceptions(async () => {
        const healGlobalAssets = async () => {
            const Items = await assetDB.query({
                IndexName: 'DataCategoryIndex',
                Key: {
                    DataCategory: 'Meta::Asset'
                },
                FilterExpression: "zone = :canon",
                ExpressionAttributeValues: {
                    ':canon': 'Canon'
                },
                ProjectionFields: ['AssetId', 'zone']
            })
            const canonGraph = await internalCache.Graph.get(Items.map(({ AssetId }) => (AssetId)), 'back')
            const globalAssetsSorted = canonGraph.reverse().topologicalSort().flat()

            await eventBridgeClient.send([{
                Source: 'mtw.assets',
                DetailType: 'Canon Updated',
                Detail: { assetIds: globalAssetsSorted }
            }])
        }

        if (shouldHealGlobalAssets) {
            await healGlobalAssets()
        }
        return
    }, async () => ({}))
}
