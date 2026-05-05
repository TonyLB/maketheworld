import { assetDB, connectionDB, META_SESSION_PK, sessionIdFromMetaSortKey } from "@tonylb/mtw-utilities/ts/dynamoDB"
import { asyncSuppressExceptions } from "@tonylb/mtw-utilities/ts/errors"
import { eventBridgeClient } from '@tonylb/mtw-utilities/ts/eventBridge'
import internalCache from "../internalCache"

export const healGlobalValues = async ({ shouldHealConnections = true, shouldHealGlobalAssets = true }) => {
    return await asyncSuppressExceptions(async () => {
        const healConnections = async () => {
            const Items = await connectionDB.query({
                Key: {
                    ConnectionId: META_SESSION_PK
                },
                KeyConditionExpression: 'begins_with(DataCategory, :prefix)',
                ExpressionAttributeValues: {
                    ':prefix': 'SESSION#'
                },
                ProjectionFields: ['DataCategory', 'player'],
                ConsistentRead: true
            })
        
            const sessionMap = Items
                .map(({ DataCategory, player }) => {
                    const Session = sessionIdFromMetaSortKey(DataCategory)
                    return Session ? { Player: player, Session } : null
                })
                .filter((row): row is { Player: string | undefined; Session: string } => row !== null)
                .reduce((previous, { Player, Session }) => ({ ...previous, [Session]: Player }), {})
        
            await connectionDB.putItem({
                ConnectionId: 'Global',
                DataCategory: 'Sessions',
                sessions: sessionMap
            })
        }

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

        if (shouldHealConnections) {
            const [connections] = await Promise.all([
                healConnections(),
                ...(shouldHealGlobalAssets ? [healGlobalAssets()] : [])
            ])
            return connections    
        }
        else {
            if (shouldHealGlobalAssets) {
                await healGlobalAssets()
            }
        }
        return
    }, async () => ({}))
}
