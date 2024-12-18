import { assetDB, connectionDB } from "@tonylb/mtw-utilities/ts/dynamoDB"
import { asyncSuppressExceptions } from "@tonylb/mtw-utilities/ts/errors"
import { splitType } from "@tonylb/mtw-utilities/ts/types"
import { eventBridgeClient } from '@tonylb/mtw-utilities/ts/eventBridge'
import internalCache from "../internalCache"

export const healGlobalValues = async ({ shouldHealConnections = true, shouldHealGlobalAssets = true }) => {
    return await asyncSuppressExceptions(async () => {
        const healConnections = async () => {
            const Items = await connectionDB.query({
                IndexName: 'DataCategoryIndex',
                Key: {
                    DataCategory: 'Meta::Session'
                },
                ProjectionFields: ['ConnectionId', 'player']
            })
        
            const sessionMap = Items
                .map(({ ConnectionId, player }) => ({ Player: player, Session: splitType(ConnectionId)[1]}))
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
                DetailType: 'Update Canon',
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
