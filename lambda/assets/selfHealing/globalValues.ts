import { assetDB, connectionDB } from "@tonylb/mtw-utilities/dist/dynamoDB"
import { asyncSuppressExceptions } from "@tonylb/mtw-utilities/dist/errors"
import { splitType } from "@tonylb/mtw-utilities/dist/types"
import { ebClient } from "../clients"
import { PutEventsCommand } from "@aws-sdk/client-eventbridge"

export const healGlobalValues = async ({ shouldHealConnections = true, shouldHealGlobalAssets = true }) => {
    return await asyncSuppressExceptions(async () => {
        const healConnections = async () => {
            const Items = await connectionDB.query({
                IndexName: 'DataCategoryIndex',
                DataCategory: 'Meta::Connection',
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
                ProjectionFields: ['AssetId', 'importTree', 'zone']
            })
            const globalAssets = Items
                .map(({ AssetId, importTree }) => ({ AssetId: splitType(AssetId)[1], importTree }))
                .filter(({ AssetId }) => (AssetId))
                .map(({ AssetId, importTree }) => ({ [AssetId]: importTree }))

            //
            // TODO: As part of moving fetchImportDefaults into asset lambda, figure out how the ancestry should
            // be sorted
            //
            const unencumberedImports = (tree: Record<string, any>, excludeList: string[] = [], depth = 0) => {
                if (depth > 200) {
                    return []
                }
                const directImports = Object.entries(tree)
                    .filter(([key]) => (!excludeList.includes(key)))
                const unencumbered = directImports
                    .map(([key, imports = {}]) => ({ key, imports: Object.keys(imports)}))
                    .map(({ key, imports }: { key: string, imports: string[] }) => ([
                        key,
                        imports.filter((dependency) => (!excludeList.includes(dependency)))
                    ]))
                const unencumberedImportsAll = [
                    ...unencumbered.filter(([key, imports]) => (imports.length === 0)).map(([key]) => key),
                    ...Object.values(tree).map((recurse = {}) => (unencumberedImports(recurse, excludeList, depth + 1))).reduce((previous, list) => ([...previous, ...list]), [])
                ]
                return [...(new Set(unencumberedImportsAll))]
            }
            
            const sortImportTree = (tree: Record<string, any>, currentList: string[] = []): string[] => {
                const readyImports = unencumberedImports(tree, currentList)
                if (readyImports.length > 0) {
                    return [
                        ...readyImports.sort((a, b) => (a.localeCompare(b))),
                        ...sortImportTree(tree, [...currentList, ...readyImports])
                    ]
                }
                else {
                    return []
                }
            }
            const globalAssetsSorted = sortImportTree(Object.assign({}, ...globalAssets))

            await ebClient.send(new PutEventsCommand({
                Entries: [{
                    EventBusName: process.env.EVENT_BUS_NAME,
                    Source: 'mtw.coordination',
                    DetailType: 'Set Canon Assets',
                    Detail: JSON.stringify({ assetIds: globalAssetsSorted.map((assetId) => (`ASSET#${assetId}`)) })
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
