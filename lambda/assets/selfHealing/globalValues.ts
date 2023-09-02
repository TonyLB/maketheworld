import { assetDB, connectionDB } from "@tonylb/mtw-utilities/dist/dynamoDB"
import { asyncSuppressExceptions } from "@tonylb/mtw-utilities/dist/errors"
import { splitType } from "@tonylb/mtw-utilities/dist/types"
import { ebClient } from "../clients"
import { PutEventsCommand } from "@aws-sdk/client-eventbridge"
import internalCache from "../internalCache"

export const healGlobalValues = async ({ shouldHealConnections = true, shouldHealGlobalAssets = true }) => {
    return await asyncSuppressExceptions(async () => {
        const healConnections = async () => {
            const Items = await connectionDB.query({
                IndexName: 'DataCategoryIndex',
                Key: {
                    DataCategory: 'Meta::Connection'
                },
                ProjectionFields: ['ConnectionId', 'player']
            })
        
            const connectionMap = Items
                .map(({ ConnectionId, player }) => ({ Player: player, Connection: splitType(ConnectionId)[1]}))
                .reduce((previous, { Player, Connection }) => ({ ...previous, [Connection]: Player }), {})
        
            await connectionDB.putItem({
                ConnectionId: 'Global',
                DataCategory: 'Connections',
                connections: connectionMap
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
            
            console.log(`canonGraph: ${JSON.stringify(canonGraph.nodes, null, 4)} x ${JSON.stringify(canonGraph.edges, null, 4)}`)
            const globalAssetsSorted = canonGraph.reverse().topologicalSort().flat()
            console.log(`globalAssetsSorted: ${JSON.stringify(globalAssetsSorted, null, 4)}`)

            await ebClient.send(new PutEventsCommand({
                Entries: [{
                    EventBusName: process.env.EVENT_BUS_NAME,
                    Source: 'mtw.coordination',
                    DetailType: 'Set Canon Assets',
                    Detail: JSON.stringify({ assetIds: globalAssetsSorted })
                }]
            }))
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
